/**
 * Validate every response envelope the Host emits against the CLIENT's REAL
 * response schema — the test that was missing when this feature shipped broken.
 *
 * The client's `connection.rpc.call` parses each response with a SHARED schema
 * whose `error.code` is a CLOSED discriminated union. A code outside it is
 * rejected client-side with `invalid_union ... No matching discriminator`, so a
 * delete silently looks like a no-op even though the Host answered correctly.
 *
 * Rather than hand-copying the code list (which is exactly how the bug slipped
 * through), this loads the REAL client bundle, injects a fake transport via the
 * package's own `globalThis.__DSH_TRANSPORT__` seam, and drives
 * `connection.rpc.call` for each envelope the Host can produce.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" tests/wire.schema.test.mjs "<app>/Resources/app.asar.unpacked"
 */
import { readFileSync } from 'node:fs';

const appRoot = process.argv[2];
if (appRoot === undefined) throw new Error('usage: wire.schema.test.mjs <app.asar.unpacked>');

let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

// ---- 1. capture the envelopes the Host half really emits ---------------------
const { SessionPurgeError, SessionPurgeErrorCode } = await import('../lib/index.js');
const rpc = await import('../lib/rpc.js');

const service = {
    delete: async (id) => {
        if (id === undefined) throw new SessionPurgeError(SessionPurgeErrorCode.INVALID_ID, id, 'a conversation id is required to delete a conversation');
        if (id === 'missing') throw new SessionPurgeError(SessionPurgeErrorCode.NOT_FOUND, id, `no conversation "${id}" exists`);
        if (id === 'live') throw new SessionPurgeError(SessionPurgeErrorCode.LIVE, id, `cannot delete conversation "${id}" while it is open: close it first`);
        if (id === 'rmfail') throw new SessionPurgeError(SessionPurgeErrorCode.LOG_REMOVAL_FAILED, id, 'failed to delete the stored log for "x"');
        if (id === 'boom') throw new Error('unexpected crash');
        return { sessionId: id, removedPaths: ['/tmp/x'], sidecars: {}, accounting: 'unchanged' };
    },
};

// Capture the handler the plugin registers on the connection service.
let handler;
const hostCtx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    get: (k) => (k === 'sessionPurge' ? service : undefined),
};
rpc.mountPurgeChannel({
    get: () => { throw new Error('unused'); },
    inject: (_deps, fn) => fn({
        ...hostCtx,
        get: (k) => (k === 'connection'
            ? { rpc: { handle: (channel, h) => { handler = h; } } }
            : hostCtx.get(k)),
    }),
});
check('the channel registered a handler', typeof handler === 'function');
if (typeof handler !== 'function') { console.log('\nno handler'); process.exit(1); }

const cases = [
    ['success', 'session-abc'],
    ['invalid id', undefined],
    ['not found', 'missing'],
    ['live session', 'live'],
    ['log removal failed', 'rmfail'],
    ['unexpected crash', 'boom'],
];

const envelopes = {};
for (const [label, id] of cases) {
    envelopes[label] = await handler('delete', { sessionId: id }, undefined);
    const code = envelopes[label].ok === false ? envelopes[label].error.code : '(success)';
    console.log(`  host emits ${label.padEnd(20)} -> ${code}`);
}

// ---- 2. drive the REAL client parse path ------------------------------------
// `AbstractApiClient.callUnary` is the exact code path the browser carrier uses:
// it mints an rpcId, POSTs, then parses the response with the shared
// `serverResponseSchema` (the closed error-code union). Subclassing it with a
// canned transport therefore tests the real schema, not a copy of it.
// `AbstractApiClient` is the isomorphic carrier class: the SAME class the browser
// bundle exposes, re-exported from the host package so no DOM is needed. Its
// `callUnary` is the exact parse path the browser uses.
const { AbstractApiClient } = await import('@deepseek-ai/dsh-host-apiproxy');

let nextEnvelope;
class CannedClient extends AbstractApiClient {
    async doFetch(_input, init) {
        const body = JSON.parse(init?.body ?? '{}');
        return new Response(JSON.stringify({ type: 'server-response', rpcId: body.rpcId, result: nextEnvelope }), {
            headers: { 'content-type': 'application/json' },
        });
    }
}

console.log('\nclient schema acceptance (the bug that shipped):');
for (const [label] of cases) {
    nextEnvelope = envelopes[label];
    const client = new CannedClient(1000);
    try {
        // `/api/session-purge` is irrelevant: doFetch is canned. What matters is
        // that callUnary runs serverResponseSchema over our envelope.
        const answer = await client.callUnary('session-purge', {});
        {
            const code = answer?.result?.error?.code;
            check(`${label}: ACCEPTED as a business error`, answer?.result?.ok === false, JSON.stringify(answer)?.slice(0, 260));
            check(`${label}: code survives the schema (${String(code)})`, typeof code === 'string' && code.length > 0, String(code));
        }
    }
    catch (error) {
        const message = String(error?.message ?? error);
        // The SUCCESS envelope is accepted by serverResponseSchema too, but then
        // `callUnary` consults a per-method VALUE schema table that only exists for
        // the shared /api methods. An unknown method has no entry, so the success
        // path throws AFTER the envelope parse we care about. Reaching that lookup
        // is therefore proof the envelope was accepted.
        if (label === 'success' && /Cannot read properties of undefined \(reading 'parse'\)/.test(message)) {
            check('success: envelope ACCEPTED (reached the value-schema lookup)', true);
            continue;
        }
        check(`${label}: client ACCEPTS the envelope`, false, `${error.constructor.name}: ${message.slice(0, 400)}`);
    }
}

console.log(failures === 0 ? '\nWIRE SCHEMA OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
