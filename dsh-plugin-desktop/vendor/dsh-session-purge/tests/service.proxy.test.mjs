/**
 * Regression test: the purge service MUST work through the cordis service proxy.
 *
 * This is the bug that shipped in the first version. Cordis hands consumers a
 * service proxy that is a DIFFERENT object from the constructed instance:
 *
 *     new SessionPurgeService(ctx)   ->  the instance
 *     ctx.get('sessionPurge')        ->  a proxy, NOT the instance
 *
 * ECMAScript `#private` fields are unreadable through that proxy, so every
 * method touching one threw
 *   "Cannot read private member #inflight from an object whose class did not declare it"
 * the moment the RPC handler reached it via `ctx.get('sessionPurge')`.
 *
 * The unit tests all passed because they called the INSTANCE directly. Every
 * assertion here therefore goes through `ctx.get(...)`, and one check asserts the
 * proxy is genuinely a different object — so if a future edit reintroduces a
 * `#private` member, this test fails loudly instead of the feature silently dying.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" tests/service.proxy.test.mjs
 */
import { mkdtemp, mkdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import { JsonlSessionPersistence } from '@deepseek-ai/dsh-session-persistence-jsonl';
import { SessionPurgeService } from '../lib/index.js';

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

const root = await mkdtemp(join(tmpdir(), 'purge-proxy-'));
console.log(`temp root: ${root}\n`);

try {
    const cwd = join(root, 'proj');
    await mkdir(cwd, { recursive: true });

    const ctx = new Context();
    ctx.provide('sessions', { get: () => undefined, list: () => [] });
    const persistence = new JsonlSessionPersistence(ctx, { root, packChunks: false, compression: 'none' });
    const instance = new SessionPurgeService(ctx);

    // The proxy is the surface every real caller uses.
    const viaCtx = ctx.get('sessionPurge');

    console.log('proxy identity:');
    check('ctx.get returns a service (not undefined)', viaCtx !== undefined);
    check('the proxy is NOT the constructed instance (this is why #private broke)',
        viaCtx !== instance, 'proxy === instance; the proxy assumption changed, revisit the #private rule');

    // --- the failing path: a REAL delete through the proxy -------------------
    console.log('\nreal delete through ctx.get("sessionPurge"):');
    const id = 'session-12345678-aaaa-bbbb-cccc-dddddddddddd';
    await persistence.create({ version: 1, id, createdAt: Date.now(), cwd });
    await persistence.append(id, [{ type: 'turn/start', seq: 0, time: Date.now(), data: { turnId: 't1' } }]);

    check('session listed before delete', (await persistence.list()).some((h) => h.id === id));

    let report;
    let thrown;
    try {
        report = await viaCtx.delete(id);
    } catch (error) {
        thrown = error;
    }

    check('delete() did not throw through the proxy', thrown === undefined,
        thrown === undefined ? undefined : `${thrown.constructor.name}: ${thrown.message}`);
    check('delete() returned a report', report !== undefined && typeof report === 'object');
    check('report names the session', report?.sessionId === id, report?.sessionId);
    check('report lists the removed path', Array.isArray(report?.removedPaths) && report.removedPaths.length === 1,
        JSON.stringify(report?.removedPaths));
    if (Array.isArray(report?.removedPaths) && report.removedPaths[0] !== undefined) {
        check('the log directory is gone', !(await exists(report.removedPaths[0])));
    }
    check('session no longer listed', !(await persistence.list()).some((h) => h.id === id));

    // --- error paths, also through the proxy --------------------------------
    console.log('\nerror paths through the proxy:');
    try {
        await viaCtx.delete('session-no-such-id');
        check('unknown id rejects', false, 'resolved unexpectedly');
    } catch (error) {
        check('unknown id rejects with NOT_FOUND', error?.code === 'SESSION_PURGE_NOT_FOUND', `${error?.code}`);
    }
    try {
        await viaCtx.delete('   ');
        check('blank id rejects', false, 'resolved unexpectedly');
    } catch (error) {
        check('blank id rejects with INVALID_ID', error?.code === 'SESSION_PURGE_INVALID_ID', `${error?.code}`);
    }

    // --- concurrency guard works through the proxy --------------------------
    console.log('\nconcurrency guard through the proxy:');
    const id2 = 'session-87654321-aaaa-bbbb-cccc-dddddddddddd';
    await persistence.create({ version: 1, id: id2, createdAt: Date.now(), cwd });
    await persistence.append(id2, [{ type: 'turn/start', seq: 0, time: Date.now(), data: { turnId: 't2' } }]);
    const both = await Promise.allSettled([viaCtx.delete(id2), viaCtx.delete(id2)]);
    const okCount = both.filter((r) => r.status === 'fulfilled').length;
    check('exactly one of two concurrent deletes succeeded', okCount === 1,
        JSON.stringify(both.map((r) => r.status)));

    await ctx.fiber.dispose();
} finally {
    await rm(root, { recursive: true, force: true });
    console.log(`\ncleaned up ${root}`);
}

console.log(failures === 0 ? '\nPROXY PATH OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
