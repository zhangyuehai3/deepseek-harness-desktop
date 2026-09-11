/**
 * dsh-session-purge — Host RPC half.
 *
 * Exposes the purge service over a DEDICATED connection channel rather than
 * extending the shared `/api` unary table, and still travels over the same
 * authenticated `/api`-trusted transport.
 *
 * CRITICAL WIRE CONSTRAINT: `connection.rpc.call` on the browser side parses
 * EVERY response with the shared `serverResponseSchema`, whose `error.code` is a
 * CLOSED discriminated union (`bad-request`, `cancelled`, `session-not-found`,
 * `session-conflict`, ..., `internal`). A response carrying any other code is
 * rejected client-side with `invalid_union ... "No matching discriminator"`
 * BEFORE the plugin's own code sees it — the request never even appears to have
 * happened. A private channel only decouples the OUTBOUND table; the INBOUND
 * envelope schema is still shared.
 *
 * So this module maps its precise internal codes onto that closed vocabulary:
 *
 *   SESSION_PURGE_NOT_FOUND      -> `session-not-found`  (details.sessionId)
 *   SESSION_PURGE_LIVE           -> `session-conflict`   (details.sessionId + cwd)
 *   SESSION_PURGE_INVALID_ID     -> `bad-request`        (details.issues)
 *   everything else              -> `internal`           (details empty)
 *
 * The precise cause is preserved in the message and, where the vocabulary has no
 * room for it, in the message text — never lost.
 *
 * @module dsh-session-purge/rpc
 */
import { SessionPurgeError, SessionPurgeErrorCode } from "./index.js";

/** The private RPC channel this plugin owns. */
export const PURGE_CHANNEL = '/session-purge';

/** The one endpoint on {@link PURGE_CHANNEL}. */
export const PURGE_ENDPOINT = 'delete';

/** Envelope vocabulary mirrored from the upstream RPC carrier. */
const CLIENT_REQUEST_TYPE = 'client-request';
const SERVER_RESPONSE_TYPE = 'server-response';

/**
 * Wire a successful result into a `server-response` envelope.
 *
 * @param rpcId - the request's rpc id, echoed verbatim.
 * @param value - the JSON-serializable success value.
 * @returns the response envelope.
 */
function success(rpcId, value) {
    return { type: SERVER_RESPONSE_TYPE, rpcId, result: { ok: true, value } };
}

/**
 * Wire a business failure into a `server-response` envelope.
 *
 * @param rpcId - the request's rpc id, echoed verbatim.
 * @param code - a code from the CLIENT's closed error union (see the module note).
 * @param message - product-user-visible detail.
 * @param details - structured context matching that code's declared shape.
 * @returns the response envelope.
 */
function failure(rpcId, code, message, details = {}) {
    return { type: SERVER_RESPONSE_TYPE, rpcId, result: { ok: false, error: { code, message, details } } };
}

/**
 * Translate one purge failure into the client's closed error vocabulary.
 *
 * Each arm is deliberate: the code must exist in the shared union AND its
 * `details` must match that code's declared shape, or the client rejects the
 * whole response and the delete silently looks like a no-op.
 *
 * @param error - the thrown purge failure.
 * @param sessionId - the requested session id, for context.
 * @returns `{ code, message, details }` ready for {@link failure}.
 */
function wireError(error, sessionId) {
    const id = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'unknown';

    if (error instanceof SessionPurgeError) {
        switch (error.code) {
            case SessionPurgeErrorCode.INVALID_ID:
                // `bad-request` requires details.issues as an array.
                return {
                    code: 'bad-request',
                    message: error.message,
                    details: { issues: [{ path: ['sessionId'], message: 'a non-empty conversation id is required' }] },
                };
            case SessionPurgeErrorCode.NOT_FOUND:
                // `session-not-found` requires details.sessionId.
                return { code: 'session-not-found', message: error.message, details: { sessionId: id } };
            case SessionPurgeErrorCode.LIVE:
                // `session-conflict` requires sessionId + requestedCwd; a live session
                // has no cwd to report here, so an empty string keeps the shape valid
                // while the message carries the real reason.
                return {
                    code: 'session-conflict',
                    message: error.message,
                    details: { sessionId: id, requestedCwd: '' },
                };
            default:
                // LOG_REMOVAL_FAILED / ACCOUNTING_FAILED are infrastructure faults.
                // `internal` requires details to be an EMPTY object, so the precise
                // code rides in the message where it stays visible to the user.
                return {
                    code: 'internal',
                    message: `[${error.code}] ${error.message}`,
                    details: {},
                };
        }
    }

    return { code: 'internal', message: String(error), details: {} };
}

/**
 * Handle one decoded endpoint call.
 *
 * @param ctx - the Host plugin context.
 * @param endpoint - the decoded endpoint name.
 * @param payload - the decoded request payload.
 * @param _signal - the carrier's cancellation signal (purges are not cancellable
 *   once the log removal has begun, so it is deliberately unused).
 * @returns the response envelope's `result`.
 */
async function dispatch(ctx, endpoint, payload, _signal) {
    if (endpoint !== PURGE_ENDPOINT) {
        // `bad-request` is the only client-valid way to reject an unknown endpoint,
        // and its details.issues must be an array.
        return { ok: false, error: { code: 'bad-request', message: `unknown session-purge endpoint "${endpoint}"`, details: { issues: [] } } };
    }
    const sessionId = payload !== null && typeof payload === 'object' ? payload.sessionId : undefined;
    const purge = ctx.get('sessionPurge');
    if (purge === undefined) {
        return { ok: false, error: { code: 'internal', message: 'session delete is unavailable: the session-purge service is not mounted', details: {} } };
    }
    try {
        const report = await purge.delete(sessionId);
        ctx.logger?.info?.(`[session-purge] deleted "${String(sessionId)}": ${JSON.stringify(report)}`);
        return { ok: true, value: report };
    }
    catch (error) {
        const wire = wireError(error, sessionId);
        if (wire.code === 'internal') {
            // Log the stack: an internal error is a deployment fault worth a trace.
            ctx.logger?.error?.(`[session-purge] ${wire.message}\n${error instanceof Error ? error.stack : ''}`);
        }
        else {
            ctx.logger?.warn?.(`[session-purge] delete refused for "${String(sessionId)}": ${wire.message}`);
        }
        return { ok: false, error: wire };
    }
}

/**
 * Mount the purge channel on the Host connection service.
 *
 * The channel registers under the caller's fiber, so unloading this plugin
 * unregisters the endpoint and drops every pending request with it.
 *
 * @param ctx - the Host plugin context.
 */
export function mountPurgeChannel(ctx) {
    // `connection` is mounted by the transport layer (desktop/web carrier); this
    // plugin has no opinion on when, so the registration waits for it.
    ctx.inject(['connection'], (connectionCtx) => {
        const connection = connectionCtx.get('connection');
        if (connection === undefined) return;
        // `authority: 'trusted-host'` matches the shared /api channel's guard, so
        // the deployment's own browser origin passes while a foreign page does not.
        connection.rpc.handle(PURGE_CHANNEL, async (endpoint, payload, signal) => dispatch(connectionCtx, endpoint, payload, signal), { authority: 'trusted-host' });
    });
}

export { success, failure, CLIENT_REQUEST_TYPE, SERVER_RESPONSE_TYPE };
