/**
 * Trusted network time anchor with monotonic progression.
 *
 * Prevents token reset and quota bypass when users tamper with their
 * local OS system time (either advancing to next week or rewinding to past).
 */
let baseServerEpoch = null;
let baseMonotonic = performance.now();
/**
 * Updates the trusted server time base using an HTTP `Date` header,
 * explicit timestamp, or Date instance.
 */
export function updateServerTime(headerOrTimestamp) {
    if (headerOrTimestamp === undefined || headerOrTimestamp === null)
        return;
    let parsed;
    if (typeof headerOrTimestamp === 'number') {
        parsed = headerOrTimestamp;
    }
    else if (headerOrTimestamp instanceof Date) {
        parsed = headerOrTimestamp.getTime();
    }
    else if (typeof headerOrTimestamp === 'string') {
        const trimmed = headerOrTimestamp.trim();
        if (trimmed === '')
            return;
        parsed = Date.parse(trimmed);
    }
    else {
        return;
    }
    if (!isNaN(parsed) && parsed > 0) {
        baseServerEpoch = parsed;
        baseMonotonic = performance.now();
    }
}
/**
 * Returns whether the clock has received at least one authoritative server time sync.
 */
export function isServerTimeSynchronized() {
    return baseServerEpoch !== null;
}
/**
 * Returns the current trusted Date.
 *
 * If server time was synchronized, proceeds forward via physical monotonic
 * clock (performance.now()), completely immune to local OS clock tampering.
 * If not yet synchronized, uses max(Date.now(), persistedLastActiveTime).
 * Monotonic guard: never returns a timestamp earlier than persistedLastActiveTime.
 */
export function getTrustedDate(persistedLastActiveTime = 0) {
    let epoch;
    if (baseServerEpoch !== null) {
        const elapsed = Math.max(0, performance.now() - baseMonotonic);
        epoch = baseServerEpoch + elapsed;
    }
    else {
        const localNow = Date.now();
        epoch = persistedLastActiveTime > 0 ? Math.max(localNow, persistedLastActiveTime) : localNow;
    }
    // Monotonic guard: never allow time to flow backwards
    if (persistedLastActiveTime > 0 && epoch < persistedLastActiveTime) {
        epoch = persistedLastActiveTime;
    }
    return new Date(epoch);
}
/**
 * Helper to reset state in automated tests.
 */
export function resetTrustedTimeForTesting() {
    baseServerEpoch = null;
    baseMonotonic = performance.now();
}
