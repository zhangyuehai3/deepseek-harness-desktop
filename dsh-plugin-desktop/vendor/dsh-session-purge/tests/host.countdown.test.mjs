/**
 * Host integration test for 7-day countdown deletion and restoration.
 */
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { JsonlSessionPersistence } from '@deepseek-ai/dsh-session-persistence-jsonl';
import { SessionPurgeService, SEVEN_DAYS_MS } from '../lib/index.js';

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

async function boot({ root, storageFile, archivedSessionIds = [] }) {
    const ctx = new Context();
    const live = new Map();
    ctx.provide('sessions', {
        get: (id) => live.get(id),
        list: () => [...live.values()],
        flush: async () => true,
    });
    ctx.provide('agents', { get: () => undefined });

    let archived = [...archivedSessionIds];
    const registry = {
        archiveSession: async (id) => {
            if (!archived.includes(id)) archived.push(id);
        },
        unarchiveSession: async (id) => {
            archived = archived.filter((sid) => sid !== id);
        },
        list: () => [],
        get: () => undefined,
        get archivedSessionIds() {
            return [...archived];
        },
    };
    ctx.provide('workspaceRegistry', registry);

    const persistence = new JsonlSessionPersistence(ctx, { root, packChunks: false, compression: 'none' });
    const purge = new SessionPurgeService(ctx, { storageFile, sweepIntervalMs: 0 });
    return { ctx, purge, persistence, registry };
}

async function seedSession(persistence, id) {
    const meta = { version: 1, id, createdAt: Date.now(), cwd: '/tmp' };
    await persistence.create(meta);
    await persistence.append(id, [{
        type: 'turn/start',
        seq: 0,
        time: Date.now(),
        data: { turnId: `${id}-turn-1` },
    }]);
    return meta;
}

const tempDir = await mkdtemp(join(tmpdir(), 'dsh-countdown-test-'));
const storageFile = join(tempDir, 'pending_purges.json');
console.log(`temp root: ${tempDir}`);

try {
    const { purge, persistence, registry } = await boot({ root: tempDir, storageFile });

    await seedSession(persistence, 'session-countdown-1');
    await seedSession(persistence, 'session-countdown-2');

    console.log('\nscenario 1: schedule deletion enters 7-day countdown without immediate deletion');
    const scheduled = await purge.schedule('session-countdown-1');
    check('scheduledAt is recorded', typeof scheduled.scheduledAt === 'number');
    check('deleteAt is exactly 7 days in the future', scheduled.deleteAt - scheduled.scheduledAt === SEVEN_DAYS_MS);

    // CRITICAL: Cannot be deleted immediately!
    const listBefore = await persistence.list();
    check('session is NOT immediately deleted from persistence', listBefore.some((s) => s.id === 'session-countdown-1'));

    const meta = listBefore.find((s) => s.id === 'session-countdown-1');
    const location = persistence.locate(meta);
    check('session file still exists on disk', await exists(location.path));

    check('session is archived to hide from sidebar', registry.archivedSessionIds.includes('session-countdown-1'));

    const pending = await purge.listPending();
    check('session appears in listPending', pending.some((p) => p.sessionId === 'session-countdown-1'));

    console.log('\nscenario 2: restore conversation removes it from pending queue and unarchives');
    const restored = await purge.restore('session-countdown-1');
    check('restore returns confirmation', restored.restored === true);

    const pendingAfterRestore = await purge.listPending();
    check('session no longer in pending list', !pendingAfterRestore.some((p) => p.sessionId === 'session-countdown-1'));
    check('session is unarchived from workspace registry', !registry.archivedSessionIds.includes('session-countdown-1'));

    const listAfterRestore = await persistence.list();
    check('session still fully exists after restore', listAfterRestore.some((s) => s.id === 'session-countdown-1'));

    console.log('\nscenario 3: auto-purge permanently removes session once 7-day countdown has elapsed');
    // Schedule with an already elapsed countdown
    await purge.schedule('session-countdown-2', -1000);
    const pendingExpired = await purge.__loadPending();
    check('expired item recorded in pending queue', pendingExpired.some((p) => p.sessionId === 'session-countdown-2'));

    // Trigger sweep
    const swept = await purge.sweepExpired();
    check('sweepExpired returns the deleted session', swept.includes('session-countdown-2'));

    const listAfterSweep = await persistence.list();
    check('session is now permanently deleted from persistence', !listAfterSweep.some((s) => s.id === 'session-countdown-2'));

    const pendingAfterSweep = await purge.__loadPending();
    check('session is removed from pending queue after sweep', !pendingAfterSweep.some((p) => p.sessionId === 'session-countdown-2'));

} finally {
    await rm(tempDir, { recursive: true, force: true });
    console.log(`\ncleaned up ${tempDir}`);
}

console.log(failures === 0 ? '\nCOUNTDOWN TESTS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
