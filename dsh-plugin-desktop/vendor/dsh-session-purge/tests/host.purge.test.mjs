/**
 * Host-half integration test for dsh-session-purge.
 *
 * Boots a REAL minimal cordis application with the real jsonl persistence
 * backend so the purge runs against genuine service wiring and genuine durable
 * files. The assertions are about observable effects: which paths disappear,
 * what the purge report says, and what the workspace account looks like after.
 *
 * Run from a directory whose node_modules resolves the app's packages:
 *   ln -sfn "<app>/node_modules" node_modules
 *   ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" tests/host.purge.test.mjs
 */
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { JsonlSessionPersistence } from '@deepseek-ai/dsh-session-persistence-jsonl';
import { SessionPurgeService, SessionPurgeError, SessionPurgeErrorCode } from '../lib/index.js';

let failures = 0;
function check(label, condition, detail) {
    if (condition) {
        console.log(`  ok   ${label}`);
    } else {
        failures += 1;
        console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
    }
}

async function exists(path) {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Boot one cordis root per scenario: a real persistence service plus the purge
 * service.
 *
 * `agentStatus` models `ctx.agents.get(id)?.status`, which is the predicate the
 * purge gates on and the same one the sidebar uses to render 进行中/空闲.
 */
async function boot({ root, liveIds = [], runningIds = [], workspaceRegistry }) {
    const ctx = new Context();
    // Live-session stand-in: the purge flushes through `sessions.get/flush`, and
    // the persistence coordinator ALSO installs a write path over the store and
    // reads `session.header.id`, so each live entry carries that shape too.
    const live = new Map(liveIds.map((id) => [id, { id, header: { id }, events: [] }]));
    const running = new Set(runningIds);
    ctx.provide('sessions', {
        get: (id) => live.get(id),
        list: () => [...live.values()],
        // Durability barrier: real stores flush write-behind controllers here.
        flush: async () => true,
    });
    // The agents service is what distinguishes "running" from merely "attached".
    ctx.provide('agents', { get: (id) => (running.has(id) ? { id, status: 'running' } : undefined) });
    if (workspaceRegistry !== undefined) ctx.provide('workspaceRegistry', workspaceRegistry);
    const persistence = new JsonlSessionPersistence(ctx, { root, packChunks: false, compression: 'none' });
    const purge = new SessionPurgeService(ctx);
    return { ctx, purge, persistence };
}

/** Register an optional service on a booted ctx (cordis forbids re-providing). */
function provide(ctx, key, value) {
    ctx.provide(key, value);
    return value;
}

/**
 * Write a session log the way the backend materializes one.
 *
 * `create()` is deliberately lazy (intent only, no artifact), so the log is only
 * materialized by a first append — exactly as a real conversation behaves.
 */
async function seedSession(persistence, { id, cwd }) {
    const meta = { version: 1, id, createdAt: Date.now(), cwd };
    await persistence.create(meta);
    await persistence.append(id, [{
        type: 'turn/start',
        seq: 0,
        time: Date.now(),
        data: { turnId: `${id}-turn-1` },
    }]);
    return meta;
}

/**
 * Materialize a log using a THROWAWAY backend, so the id is already durable
 * before the scenario's own backend mounts.
 *
 * This matters: once a store reports the id as attached, the persistence
 * coordinator adopts that id and `create()` on the scenario's backend would
 * reject with "already exists in this backend".
 */
async function seedCold(root, id, cwd) {
    const seedCtx = new Context();
    seedCtx.provide('sessions', { get: () => undefined, list: () => [] });
    const seed = new JsonlSessionPersistence(seedCtx, { root, packChunks: false, compression: 'none' });
    const meta = await seedSession(seed, { id, cwd });
    await seedCtx.fiber.dispose();
    return meta;
}

const root = await mkdtemp(join(tmpdir(), 'dsh-purge-test-'));
console.log(`temp persistence root: ${root}\n`);

try {
    // ---------------------------------------------------------------- scenario 1
    console.log('scenario 1: delete a cold conversation removes its log directory');
    {
        const cwd = join(root, 'project-a');
        await mkdir(cwd, { recursive: true });
        const { ctx, purge, persistence } = await boot({ root });
        const id = 'session-aaaaaaaa-1111-2222-3333-444444444444';
        await seedSession(persistence, { id, cwd });

        check('session is listed before delete', (await persistence.list()).some((h) => h.id === id));

        const report = await purge.delete(id);
        check('report names the session', report.sessionId === id, JSON.stringify(report));
        check('report lists one removed path', report.removedPaths.length === 1, JSON.stringify(report.removedPaths));
        check('removed directory no longer exists', !(await exists(report.removedPaths[0])));
        check('log file itself is gone', !(await exists(join(report.removedPaths[0], 'session.jsonl'))));

        const after = await persistence.list();
        check('session is NOT listed after delete', !after.some((h) => h.id === id), JSON.stringify(after.map((h) => h.id)));
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 2
    console.log('\nscenario 2: a RUNNING conversation is refused');
    {
        const cwd = join(root, 'project-b');
        await mkdir(cwd, { recursive: true });
        const id = 'session-bbbbbbbb-1111-2222-3333-444444444444';
        await seedCold(root, id, cwd);
        // Attached AND running: an agent holds the session mid-turn.
        const { ctx, purge, persistence } = await boot({ root, liveIds: [id], runningIds: [id] });

        let caught;
        try {
            await purge.delete(id);
        } catch (error) {
            caught = error;
        }
        check('refusal is a SessionPurgeError', caught instanceof SessionPurgeError, String(caught));
        check('refusal code is LIVE', caught?.code === SessionPurgeErrorCode.LIVE, caught?.code);
        check('the refusal message tells the user to stop it', /stop it first/.test(caught?.message ?? ''), caught?.message);
        check('running session log SURVIVED the refusal', (await persistence.list()).some((h) => h.id === id));
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 2b
    console.log('\nscenario 2b: an ATTACHED but IDLE conversation IS deletable');
    {
        // This is the case that shipped broken: the desktop app re-attaches the
        // last opened session on launch, so gating on attachment alone made the
        // user's most likely delete target permanently undeletable while the UI
        // showed it as 空闲/idle.
        const cwd = join(root, 'project-b2');
        await mkdir(cwd, { recursive: true });
        const id = 'session-b2b2b2b2-1111-2222-3333-444444444444';
        await seedCold(root, id, cwd);
        const { ctx, purge, persistence } = await boot({ root, liveIds: [id] });

        check('the session is attached to the store', ctx.get('sessions').get(id) !== undefined);
        check('but no agent reports it running', ctx.get('agents').get(id) === undefined);

        const report = await purge.delete(id);
        check('delete succeeded despite being attached', report.sessionId === id, JSON.stringify(report));
        check('the log directory is gone', !(await exists(report.removedPaths[0])));
        check('session no longer listed', !(await persistence.list()).some((h) => h.id === id));
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 3
    console.log('\nscenario 3: an unknown conversation is reported as NOT_FOUND');
    {
        const { ctx, purge } = await boot({ root });
        let caught;
        try {
            await purge.delete('session-cccccccc-0000-0000-0000-000000000000');
        } catch (error) {
            caught = error;
        }
        check('code is NOT_FOUND', caught?.code === SessionPurgeErrorCode.NOT_FOUND, caught?.code);
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 4
    console.log('\nscenario 4: a blank id is rejected before any I/O');
    {
        const { ctx, purge } = await boot({ root });
        let caught;
        try {
            await purge.delete('   ');
        } catch (error) {
            caught = error;
        }
        check('code is INVALID_ID', caught?.code === SessionPurgeErrorCode.INVALID_ID, caught?.code);
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 5
    console.log('\nscenario 5: workspace accounting is dropped via detachSession');
    {
        const cwd = join(root, 'project-d');
        await mkdir(cwd, { recursive: true });
        const id = 'session-dddddddd-1111-2222-3333-444444444444';
        const touched = [];
        const workspace = { id: 'ws-1', title: 'Project D', sessionIds: [id, 'session-other'] };
        const registry = {
            list: () => [workspace],
            get: (wid) => (wid === 'ws-1'
                ? {
                    detachSession: async (sid) => {
                        touched.push(sid);
                        workspace.sessionIds = workspace.sessionIds.filter((s) => s !== sid);
                    },
                }
                : undefined),
            get archivedSessionIds() { return []; },
        };
        const { ctx, purge, persistence } = await boot({ root, workspaceRegistry: registry });
        await seedSession(persistence, { id, cwd });

        const report = await purge.delete(id);
        check('detachSession called with the id', touched.includes(id), JSON.stringify(touched));
        check('id left the workspace account', !workspace.sessionIds.includes(id), JSON.stringify(workspace.sessionIds));
        check('sibling session kept its slot', workspace.sessionIds.includes('session-other'));
        check('report records accounting', report.accounting === 'workspaces:1', report.accounting);
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 6
    console.log('\nscenario 6: sidecar rows are dropped through the storageDomain facility');
    {
        const cwd = join(root, 'project-e');
        await mkdir(cwd, { recursive: true });
        const id = 'session-eeeeeeee-1111-2222-3333-444444444444';
        const deleted = [];
        const rows = new Map([
            ['message_feedback', new Map([[id, { some: 'feedback' }]])],
            ['session_projcache', new Map([[id, { some: 'checkpoint' }]])],
        ]);
        const { ctx, purge, persistence } = await boot({ root });
        provide(ctx, 'storageDomain', {
            get: (name) => {
                const table = rows.get(name);
                if (table === undefined) return undefined;
                return {
                    table: () => ({
                        get: (key) => table.get(key),
                        delete: async (key) => { deleted.push(`${name}:${key}`); table.delete(key); },
                    }),
                };
            },
        });
        await seedSession(persistence, { id, cwd });

        const report = await purge.delete(id);
        check('feedback row purged', report.sidecars.feedback === 'purged', JSON.stringify(report.sidecars));
        check('projection-cache row purged', report.sidecars.projectionCache === 'purged', JSON.stringify(report.sidecars));
        check('both rows actually deleted', deleted.length === 2, JSON.stringify(deleted));
        check('searchIndex reported absent (not mounted)', report.sidecars.searchIndex === 'absent', report.sidecars.searchIndex);
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 7
    console.log('\nscenario 7: a missing storageDomain is not an error');
    {
        const cwd = join(root, 'project-f');
        await mkdir(cwd, { recursive: true });
        const id = 'session-ffffffff-1111-2222-3333-444444444444';
        const { ctx, purge, persistence } = await boot({ root });
        await seedSession(persistence, { id, cwd });
        const report = await purge.delete(id);
        check('sidecars report absent', report.sidecars.feedback === 'absent' && report.sidecars.projectionCache === 'absent', JSON.stringify(report.sidecars));
        check('delete still succeeded', report.removedPaths.length === 1);
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 8
    console.log('\nscenario 8: deleting one conversation leaves its siblings intact');
    {
        const cwd = join(root, 'project-g');
        await mkdir(cwd, { recursive: true });
        const { ctx, purge, persistence } = await boot({ root });
        const keep = 'session-99999999-1111-2222-3333-444444444444';
        const drop = 'session-88888888-1111-2222-3333-444444444444';
        await seedSession(persistence, { id: keep, cwd });
        await seedSession(persistence, { id: drop, cwd });

        await purge.delete(drop);
        const after = await persistence.list();
        check('sibling survived', after.some((h) => h.id === keep), JSON.stringify(after.map((h) => h.id)));
        check('target removed', !after.some((h) => h.id === drop));
        await ctx.fiber.dispose();
    }

    // ---------------------------------------------------------------- scenario 9
    console.log('\nscenario 9: concurrent deletes of one id are serialized, not raced');
    {
        const cwd = join(root, 'project-h');
        await mkdir(cwd, { recursive: true });
        const id = 'session-77777777-1111-2222-3333-444444444444';
        const { ctx, purge, persistence } = await boot({ root });
        await seedSession(persistence, { id, cwd });

        const results = await Promise.allSettled([purge.delete(id), purge.delete(id)]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');
        check('exactly one delete succeeded', fulfilled.length === 1, JSON.stringify(results.map((r) => r.status)));
        check('the other reported NOT_FOUND', rejected[0]?.reason?.code === SessionPurgeErrorCode.NOT_FOUND, rejected[0]?.reason?.code);
        await ctx.fiber.dispose();
    }
} finally {
    await rm(root, { recursive: true, force: true });
    console.log(`\ncleaned up ${root}`);
}

console.log(failures === 0 ? '\nALL HOST TESTS PASSED' : `\n${failures} HOST TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
