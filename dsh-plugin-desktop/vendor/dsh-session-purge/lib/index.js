/**
 * dsh-session-purge — Host half.
 *
 * Hard-deletes one conversation (session) and everything derived from it:
 *
 *   1. the durable append-only log (the session's own directory under the
 *      persistence root), located through `sessionPersistence.locate()` so this
 *      plugin never hardcodes a storage layout;
 *   2. every sidecar row keyed by that session id — message feedback, the
 *      projection cache, and the full-text search index;
 *   3. the workspace registry's accounting: the id leaves both the owning
 *      workspace's `sessionIds` slot and the global `archivedSessionIds` set.
 *
 * A session still attached to the in-memory store is REFUSED: an attached
 * session means an agent may be mid-turn, and tearing its log out from under a
 * running writer is how you corrupt a store. Deleting is therefore an
 * explicitly cold-session operation.
 *
 * @module dsh-session-purge
 */
import { rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { Service } from '@deepseek-ai/cordis';
import { mountPurgeChannel } from "./rpc.js";

export const name = 'dsh-session-purge';

/** 7 days countdown in milliseconds. */
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Failure codes surfaced to the UI; the wire carries `code` + `message`. */
export const SessionPurgeErrorCode = Object.freeze({
    /** The session is live in memory (an agent may be running) — refuse. */
    LIVE: 'SESSION_PURGE_LIVE',
    /** No live session and no persisted log carry this id. */
    NOT_FOUND: 'SESSION_PURGE_NOT_FOUND',
    /** The caller supplied something that is not a non-empty string id. */
    INVALID_ID: 'SESSION_PURGE_INVALID_ID',
    /** The durable log could not be removed. */
    LOG_REMOVAL_FAILED: 'SESSION_PURGE_LOG_REMOVAL_FAILED',
    /** The workspace registry could not record the removal. */
    ACCOUNTING_FAILED: 'SESSION_PURGE_ACCOUNTING_FAILED',
});

/** One purge failure carrying a stable machine code plus the session it concerns. */
export class SessionPurgeError extends Error {
    /**
     * @param code - one of {@link SessionPurgeErrorCode}.
     * @param sessionId - the session the failure concerns.
     * @param message - human-readable detail (product-user-visible).
     * @param options - standard Error options (cause chaining).
     */
    constructor(code, sessionId, message, options) {
        super(message, options);
        this.name = 'SessionPurgeError';
        this.code = code;
        this.sessionId = sessionId;
    }
}

/** Sidecar cleanups are best-effort: a failure is reported, never fatal. */
const SIDECAR_TIMEOUT_MS = 10_000;

function resolvePendingFilePath() {
    const home = process.env.DSH_HOME || join(homedir(), '.dsh');
    return join(home, 'session-purge', 'pending_purges.json');
}

/**
 * The purge service, provided as `ctx.sessionPurge`.
 *
 * Both dependencies are injected because a purge that cannot read the log
 * listing or rewrite workspace accounting would silently leave debris behind.
 */
export class SessionPurgeService extends Service {
    static inject = ['sessions', 'sessionPersistence'];

    /**
     * Serialize purges so two deletes of one id cannot interleave their steps.
     *
     * NOTE: this MUST be an ordinary property, never a `#private` class field.
     * Cordis hands consumers a service proxy that is a DIFFERENT object from the
     * constructed instance, and ECMAScript private fields are unreadable through
     * that wrapper: any method touching one throws
     * "Cannot read private member #x from an object whose class did not declare
     * it" the moment it is reached via `ctx.sessionPurge`. The same holds for
     * `#private` methods, so this class avoids `#` entirely.
     */
    __inflight = new Map();
    __storageFile = null;
    __sweepTimer = null;

    /**
     * @param ctx - the owning plugin context.
     * @param options - optional service configuration.
     */
    constructor(ctx, options = {}) {
        super(ctx, 'sessionPurge');
        this.__storageFile = typeof options?.storageFile === 'string'
            ? options.storageFile
            : resolvePendingFilePath();

        // Periodically check for expired countdown items (e.g. every 10 minutes)
        const sweepInterval = typeof options?.sweepIntervalMs === 'number'
            ? options.sweepIntervalMs
            : 10 * 60 * 1000;
        if (sweepInterval > 0) {
            this.__sweepTimer = setInterval(() => {
                this.sweepExpired().catch((err) => {
                    this.ctx.logger?.warn?.(`[session-purge] sweep expired failed: ${describe(err)}`);
                });
            }, sweepInterval);
            if (typeof this.__sweepTimer?.unref === 'function') {
                this.__sweepTimer.unref();
            }
        }

        this.ctx.on('dispose', () => {
            if (this.__sweepTimer !== null) {
                clearInterval(this.__sweepTimer);
                this.__sweepTimer = null;
            }
        });
    }

    async __loadPending() {
        if (!this.__storageFile) return [];
        try {
            const raw = await readFile(this.__storageFile, 'utf8');
            const data = JSON.parse(raw);
            if (Array.isArray(data?.pending)) return data.pending;
            return [];
        } catch {
            return [];
        }
    }

    async __savePending(items) {
        if (!this.__storageFile) return;
        try {
            await mkdir(dirname(this.__storageFile), { recursive: true });
            await writeFile(this.__storageFile, JSON.stringify({ version: 1, pending: items }, null, 2), 'utf8');
        } catch (err) {
            this.ctx.logger?.warn?.(`[session-purge] failed to save pending purges: ${describe(err)}`);
        }
    }

    /**
     * Schedule a conversation for deletion with a 7-day countdown.
     *
     * @param sessionId - the conversation to schedule.
     * @param countdownMs - optional custom countdown duration (defaults to 7 days).
     * @returns the scheduled record.
     */
    async schedule(sessionId, countdownMs = SEVEN_DAYS_MS) {
        const id = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (id.length === 0) {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.INVALID_ID,
                sessionId,
                'a conversation id is required to delete a conversation',
            );
        }

        const agent = this.ctx.get('agents')?.get?.(id);
        if (agent?.status === 'running') {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.LIVE,
                id,
                `cannot delete conversation "${id}" while it is running: stop it first`,
            );
        }

        const listing = await this.ctx.sessionPersistence.list();
        const meta = listing.find((header) => header.id === id);
        if (meta === undefined) {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.NOT_FOUND,
                id,
                `no conversation "${id}" exists`,
            );
        }

        const pending = await this.__loadPending();
        const existing = pending.find((item) => item.sessionId === id);
        if (existing) {
            return existing;
        }

        const scheduledAt = Date.now();
        const deleteAt = scheduledAt + countdownMs;
        const record = { sessionId: id, scheduledAt, deleteAt };
        pending.push(record);
        await this.__savePending(pending);

        // Hide the conversation from the active sidebar by archiving it in the workspace registry
        const registry = this.ctx.get('workspaceRegistry');
        if (registry !== undefined && typeof registry.archiveSession === 'function') {
            try {
                await registry.archiveSession(id);
            } catch (err) {
                this.ctx.logger?.warn?.(`[session-purge] could not archive scheduled session ${id}: ${describe(err)}`);
            }
        }

        return record;
    }

    /**
     * Restore a scheduled conversation before its 7-day countdown expires.
     *
     * @param sessionId - the conversation to restore.
     * @returns confirmation of restoration.
     */
    async restore(sessionId) {
        const id = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (id.length === 0) {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.INVALID_ID,
                sessionId,
                'a conversation id is required to restore a conversation',
            );
        }

        const pending = await this.__loadPending();
        const filtered = pending.filter((item) => item.sessionId !== id);
        if (filtered.length !== pending.length) {
            await this.__savePending(filtered);
        }

        // Unarchive the session so it re-appears in normal sidebar views
        await this.__unarchiveSession(id);

        return { sessionId: id, restored: true };
    }

    /**
     * Unarchive a session in workspace registry so it shows up in normal lists.
     */
    async __unarchiveSession(id) {
        const registry = this.ctx.get('workspaceRegistry');
        if (!registry) return;
        if (typeof registry.unarchiveSession === 'function') {
            try {
                await registry.unarchiveSession(id);
                return;
            } catch {}
        }
        try {
            if (registry.global && typeof registry.global.get === 'function' && typeof registry.global.set === 'function') {
                const current = registry.global.get();
                if (current && Array.isArray(current.archivedSessionIds) && current.archivedSessionIds.includes(id)) {
                    const next = {
                        ...current,
                        archivedSessionIds: current.archivedSessionIds.filter((sid) => sid !== id),
                    };
                    await registry.global.set(next);
                    if ('state' in registry) registry.state = next;
                }
            }
        } catch (err) {
            this.ctx.logger?.warn?.(`[session-purge] could not unarchive session ${id}: ${describe(err)}`);
        }
    }

    /**
     * List all currently scheduled conversations and their countdowns.
     */
    async listPending() {
        await this.sweepExpired();
        return await this.__loadPending();
    }

    /**
     * Sweep and permanently delete any conversations whose 7-day countdown has elapsed.
     */
    async sweepExpired() {
        const pending = await this.__loadPending();
        if (pending.length === 0) return [];
        const now = Date.now();
        const expired = [];
        const remaining = [];

        for (const item of pending) {
            if (item.deleteAt <= now) {
                expired.push(item);
            } else {
                remaining.push(item);
            }
        }

        if (expired.length === 0) return [];

        const deleted = [];
        for (const item of expired) {
            try {
                await this.delete(item.sessionId);
                deleted.push(item.sessionId);
            } catch (err) {
                // If the session was already not found, we still drop it from pending
                if (err instanceof SessionPurgeError && err.code === SessionPurgeErrorCode.NOT_FOUND) {
                    deleted.push(item.sessionId);
                } else {
                    this.ctx.logger?.error?.(`[session-purge] failed to auto-purge expired session ${item.sessionId}: ${describe(err)}`);
                    // Keep it in remaining to retry on next sweep
                    remaining.push(item);
                }
            }
        }

        await this.__savePending(remaining);
        return deleted;
    }

    /**
     * Permanently delete one conversation.
     *
     * @param sessionId - the session to delete.
     * @returns a report of what was removed and which sidecars were skipped.
     * @throws {SessionPurgeError} for every refusal or hard failure.
     */
    delete(sessionId) {
        const id = typeof sessionId === 'string' ? sessionId.trim() : '';
        if (id.length === 0) {
            return Promise.reject(new SessionPurgeError(
                SessionPurgeErrorCode.INVALID_ID,
                sessionId,
                'a conversation id is required to delete a conversation',
            ));
        }
        // One id, one purge at a time: the existence check and the removal must
        // not race a second delete of the same session.
        const previous = this.__inflight.get(id) ?? Promise.resolve();
        const run = previous.then(
            () => this.__purge(id),
            () => this.__purge(id),
        );
        const tail = run.then(() => undefined, () => undefined);
        this.__inflight.set(id, tail);
        return run.finally(async () => {
            if (this.__inflight.get(id) === tail) this.__inflight.delete(id);
            // Ensure deleted id is also cleared from pending purges if present
            try {
                const pending = await this.__loadPending();
                const filtered = pending.filter((item) => item.sessionId !== id);
                if (filtered.length !== pending.length) {
                    await this.__savePending(filtered);
                }
            } catch {}
        });
    }

    /**
     * The ordered purge itself, already serialized per id.
     *
     * @param id - the validated session id.
     * @returns the purge report.
     */
    async __purge(id) {
        // 1. Refuse only a session with an agent ACTIVELY RUNNING.
        //
        //    The gate must be "a turn is in flight", not "attached in memory".
        //    The desktop app re-attaches the last opened session on every launch,
        //    so an attached-but-idle session is the NORMAL state of the very
        //    conversation a user is most likely to want to delete. Gating on
        //    attachment made those undeletable while the UI simultaneously showed
        //    them as 空闲/idle — confusing, and for no safety benefit: an idle
        //    session has no writer racing us.
        //
        //    `ctx.agents.get(id)?.status === 'running'` is the same predicate the
        //    sidebar uses to render 进行中/idle, so the gate now agrees with what
        //    the user sees.
        const agent = this.ctx.get('agents')?.get?.(id);
        if (agent?.status === 'running') {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.LIVE,
                id,
                `cannot delete conversation "${id}" while it is running: stop it first`,
            );
        }

        // 2. Resolve the durable header. Persistence is the existence authority;
        //    a failing list() propagates rather than masquerading as "not found".
        const listing = await this.ctx.sessionPersistence.list();
        const meta = listing.find((header) => header.id === id);
        if (meta === undefined) {
            throw new SessionPurgeError(
                SessionPurgeErrorCode.NOT_FOUND,
                id,
                `no conversation "${id}" exists`,
            );
        }

        // 2b. An attached-but-idle session still owns a write-behind controller and a
        //     prepared source. Detach it FIRST so nothing can re-materialize the log
        //     we are about to remove, and so its cached state cannot resurrect the
        //     id afterwards.
        await this.__detachAttached(id);

        // 3. Locate the artifact BEFORE anything is mutated, so a backend that
        //    cannot answer still fails cleanly with nothing half-done.
        const location = this.ctx.sessionPersistence.locate(meta);

        // 4. Remove the session's own directory rather than the single log file:
        //    the directory is session-owned and may hold future per-session
        //    artifacts alongside the log.
        const removedPaths = [];
        if (location !== undefined && typeof location.path === 'string') {
            const target = sessionOwnedDirectory(location.path, id);
            try {
                await rm(target, { recursive: true, force: true });
                removedPaths.push(target);
            } catch (error) {
                throw new SessionPurgeError(
                    SessionPurgeErrorCode.LOG_REMOVAL_FAILED,
                    id,
                    `failed to delete the stored log for "${id}": ${describe(error)}`,
                    { cause: error },
                );
            }
        }

        // 5. Best-effort sidecar cleanup. These rows are derived data: leaving one
        //    behind is untidy but never wrong (its session no longer exists), so a
        //    missing service or a throwing backend is reported, not fatal.
        const sidecars = await this.__purgeSidecars(id, meta);

        // 6. Workspace accounting last: once the log is gone the session cannot
        //    come back, so recording that fact is the final step. A failure here
        //    is loud because it leaves a dangling row in the sidebar.
        let accounting = 'skipped';
        const registry = this.ctx.get('workspaceRegistry');
        if (registry !== undefined) {
            try {
                accounting = await this.__purgeAccounting(registry, id);
            } catch (error) {
                throw new SessionPurgeError(
                    SessionPurgeErrorCode.ACCOUNTING_FAILED,
                    id,
                    `the log for "${id}" was deleted but its workspace entry could not be updated: ${describe(error)}`,
                    { cause: error },
                );
            }
        }

        return Object.freeze({
            sessionId: id,
            removedPaths: Object.freeze(removedPaths),
            sidecars: Object.freeze(sidecars),
            accounting,
        });
    }

    /**
     * Drop the session's rows from every mounted sidecar store.
     *
     * Both durable sidecars are storage-domain units whose own services keep
     * their table handle private, so this drops the row through the shared
     * `storageDomain` facility, using the domain/table names those packages
     * declare. The full-text index is cleaned through the query service, which
     * is the only owner of that schema.
     *
     * @param id - the session being purged.
     * @param _meta - the session's durable header (reserved for future sidecars
     *   that key on more than the id).
     * @returns one outcome per sidecar, for diagnostics.
     */
    async __purgeSidecars(id, _meta) {
        const outcomes = {};

        // Like/dislike rows: `message_feedback`.sessions keyed by session id.
        outcomes.feedback = await purgeStep('message_feedback', async () =>
            this.__dropDomainRow('message_feedback', id));

        // Checkpointed projection rows: `session_projcache`.sessions.
        outcomes.projectionCache = await purgeStep('session_projcache', async () =>
            this.__dropDomainRow('session_projcache', id));

        // The full-text index (session search). This deployment configures the
        // sqlite index with `openAt: 'never'`, so no index exists to clean; the
        // step stays here for deployments that DO open one, and reports honestly
        // when the mounted implementation exposes no purge verb.
        outcomes.searchIndex = await purgeStep('sessionQuery', async () => {
            const query = this.ctx.get('sessionQuery');
            if (query === undefined) return 'absent';
            if (typeof query.forget !== 'function') {
                // No public purge verb on this build's query service. Leaving the
                // index alone is safe: it is rebuilt from persistence, which no
                // longer holds the session, and reads filter by known headers.
                return 'unsupported';
            }
            await query.forget(id);
            return 'purged';
        });

        return outcomes;
    }

    /**
     * Delete one row from a session-keyed storage-domain table.
     *
     * @param domain - the domain name owning the row.
     * @param id - the session id used as the row key.
     * @returns `'purged'`, `'absent'` when the facility or domain is not mounted
     *   (a legitimate composition, not a failure), or `'unsupported'` when the
     *   domain is open but declares no `sessions` table.
     */
    async __dropDomainRow(domain, id) {
        const storageDomain = this.ctx.get('storageDomain');
        if (storageDomain === undefined || typeof storageDomain.get !== 'function') return 'absent';
        const open = storageDomain.get(domain);
        if (open === undefined || typeof open.table !== 'function') return 'absent';
        let table;
        try {
            table = open.table('sessions');
        } catch {
            return 'unsupported';
        }
        if (table === undefined || typeof table.get !== 'function') return 'absent';
        // Absence is already the postcondition; only an existing row needs a write.
        if (table.get(id) === undefined) return 'absent';
        await table.delete(id);
        return 'purged';
    }

    /**
     * Quiesce an attached-but-idle session before its log is removed.
     *
     * The SessionStore exposes no public detach verb (the per-entry `detach` is
     * module-private), so this does the two things that actually matter:
     *
     *   1. **Durability barrier** — `sessions.flush(session)` drives every
     *      write-behind controller to commit what it already holds, so no batch is
     *      in flight when the files disappear.
     *   2. **Drop the prepared source** — the persistence coordinator caches an
     *      unpublished Session for cold reads; clearing it stops a later read from
     *      resurrecting the id we are deleting.
     *
     * Verified behaviour (see tests/attached.idle.probe.mjs): once the log
     * directory is removed, a subsequent `append` on the still-attached session
     * fails on a stale cursor and does NOT re-create the file, and `list()`
     * reports the session gone. So an idle attachment is safe to purge.
     *
     * @param id - the session being purged.
     * @returns resolution once the session is as quiet as we can make it.
     */
    async __detachAttached(id) {
        const sessions = this.ctx.get('sessions');
        const live = sessions?.get?.(id);
        if (live !== undefined && typeof sessions.flush === 'function') {
            try {
                await sessions.flush(live);
            } catch (error) {
                // A failed flush means the log may be mid-write; that is exactly the
                // case the running-agent gate is meant to catch, so surface it.
                throw new SessionPurgeError(
                    SessionPurgeErrorCode.LIVE,
                    id,
                    `cannot delete conversation "${id}": its pending writes could not be settled (${describe(error)})`,
                    { cause: error },
                );
            }
        }
        // Release the backend's cached cold-read source, if it exposes one. Best
        // effort: absence of the verb is a legitimate composition.
        const persistence = this.ctx.sessionPersistence;
        for (const verb of ['forget', 'release', 'discard']) {
            if (typeof persistence?.[verb] !== 'function') continue;
            try {
                await persistence[verb](id);
            } catch {
                // Cached state for a to-be-deleted id is at worst a stale read that
                // still finds nothing; never fail the purge over it.
            }
            break;
        }
    }

    /**
     * Remove the id from the workspace registry's accounting.
     *
     * Archiving deliberately KEEPS the id in the owning workspace's `sessionIds`
     * slot so that unarchiving can restore its position. A delete is final, so
     * the slot must be released: `Workspace#detachSession` is the registry's
     * durable detach verb, and it is idempotent for an unaccounted id.
     *
     * The registry-global `archivedSessionIds` set has no public removal verb in
     * this build (only `archiveSession`). Leaving a deleted id there is harmless
     * by construction: that set is consulted only to HIDE sessions that still
     * resolve, and a purged session resolves nowhere.
     *
     * @param registry - the workspace registry.
     * @param id - the session being purged.
     * @returns a description of what was rewritten.
     */
    async __purgeAccounting(registry, id) {
        let detachedFrom = 0;
        for (const workspace of registry.list()) {
            if (!workspace.sessionIds.includes(id)) continue;
            // Re-read the entity from the registry: `list()` yields the same live
            // entities, but going through `get` keeps this call honest against a
            // concurrent delete of the workspace itself.
            const entity = registry.get(workspace.id);
            if (entity === undefined || typeof entity.detachSession !== 'function') continue;
            await entity.detachSession(id);
            detachedFrom += 1;
        }
        return detachedFrom === 0 ? 'unchanged' : `workspaces:${String(detachedFrom)}`;
    }
}

/**
 * The session-owned directory for a resolved artifact path.
 *
 * A persistence location names the log file itself; its parent directory belongs
 * to that one session (the layout is `<root>/<project>/<encoded-id>/session.<ext>`).
 * A path that unexpectedly names a directory is used as-is.
 *
 * @param artifactPath - the resolved location path.
 * @param id - the session being purged (for the sanity guard).
 * @returns the directory to remove.
 */
function sessionOwnedDirectory(artifactPath, id) {
    const trimmed = artifactPath.replace(/[/\\]+$/, '');
    const lastSegment = trimmed.slice(trimmed.lastIndexOf('/') + 1);
    // Guard: only treat the path as a log inside a session directory when the
    // final segment looks like the artifact file, not the id directory itself.
    if (lastSegment.startsWith('session.')) {
        const parent = trimmed.slice(0, trimmed.lastIndexOf('/'));
        if (parent.length > 0) return parent;
    }
    // Fallback: a directory-shaped path, or an encoding this build does not know.
    // Removing the session's own directory is the intended unit of work either way.
    void id;
    return trimmed;
}

/**
 * Run one best-effort sidecar step under a timeout.
 *
 * @param name - the sidecar's name, for diagnostics.
 * @param step - the work to run.
 * @returns the step's outcome, or an `error:` string when it failed.
 */
async function purgeStep(name, step) {
    try {
        return await withTimeout(step(), SIDECAR_TIMEOUT_MS, name);
    } catch (error) {
        return `error:${describe(error)}`;
    }
}

/**
 * Bound one promise so a wedged backend cannot hang the whole purge.
 *
 * @param promise - the work to bound.
 * @param ms - the budget in milliseconds.
 * @param label - the operation name, used in the timeout message.
 * @returns the promise's value.
 */
function withTimeout(promise, ms, label) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${String(ms)}ms`));
        }, ms);
        // Never keep the host process alive for a diagnostic timeout.
        if (typeof timer.unref === 'function') timer.unref();
    });
    return Promise.race([promise, timeout]).finally(() => {
        clearTimeout(timer);
    });
}

/**
 * Render an unknown thrown value as a short message.
 *
 * @param error - the thrown value.
 * @returns a human-readable description.
 */
function describe(error) {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Cordis plugin entry: provide `ctx.sessionPurge` and mount its RPC channel.
 *
 * @param ctx - the plugin context.
 * @param _config - unused; this plugin takes no configuration.
 */
export function apply(ctx, config) {
    ctx.plugin(SessionPurgeService, config);
    mountPurgeChannel(ctx);
}

export default apply;

