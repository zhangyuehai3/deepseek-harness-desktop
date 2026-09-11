/**
 * Verify the plugin loads through the DESKTOP app's REAL preparation path.
 *
 * The desktop app does not call `loadProfile` directly; it calls
 * `prepareDesktopProfile`, which reads its USER patch layer from
 * `$DSH_HOME/cordis.patch.yml` (the Harness home) — NOT from
 * `$DSH_HOME/profiles/<name>/cordis.patch.yml`. Testing through `loadProfile`
 * alone gave a FALSE PASS, which is exactly why this test exists.
 *
 * `prepared.patches` is a list of PatchOptions entries, some of which are
 * `{ insert: [rows] }` wrappers, so the row must be found by walking the nested
 * insert lists rather than by scanning only the top level.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" \
 *        tests/desktop.prepare.test.mjs "<app>/Resources/app.asar.unpacked"
 */
const appRoot = process.argv[2];
if (appRoot === undefined) throw new Error('usage: desktop.prepare.test.mjs <app.asar.unpacked>');

const { prepareDesktopProfile } = await import(`${appRoot}/lib/profile.js`);

/** Collect every loader ROW from a PatchOptions stack, descending into `insert` lists. */
function rowsOf(patchStack) {
    const rows = [];
    for (const entry of patchStack) {
        if (Array.isArray(entry?.insert)) rows.push(...entry.insert);
        // A patch entry that targets an existing row carries `id` itself.
        if (typeof entry?.id === 'string') rows.push(entry);
    }
    return rows;
}

const prepared = prepareDesktopProfile();
const rows = rowsOf(prepared.patches);

console.log('profile dir:', prepared.profile.dir);
console.log('user patch layer read from: $DSH_HOME/cordis.patch.yml');
console.log('patch entries:', prepared.patches.length, '| loader rows:', rows.length);
console.log('skippedOptionalEntries:', JSON.stringify(prepared.skippedOptionalEntries));

const purge = rows.find((row) => row?.id === 'session-purge');
const uiWorkspace = rows.find((row) => row?.id === 'ui-workspace');
const jsonl = rows.find((row) => row?.id === 'session-persistence-jsonl');

console.log('\nsession-purge row:', JSON.stringify(purge));
console.log('ui-workspace row:', uiWorkspace === undefined ? '(not in this stack)' : JSON.stringify({ id: uiWorkspace.id, name: uiWorkspace.name, disabled: uiWorkspace.disabled }));

let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

console.log('\nassertions:');
check('the desktop patch stack inserts the purge plugin', purge !== undefined, 'row missing');
check('the row names the package', purge?.name === 'dsh-session-purge', purge?.name);
check('the row is not disabled', purge?.disabled !== true);
check('persistence backend row still present', jsonl !== undefined, 'row missing');
check('no optional entries were skipped', prepared.skippedOptionalEntries.length === 0, JSON.stringify(prepared.skippedOptionalEntries));
check('the settings row is present', rows.some((r) => r?.id === 'settings'));

console.log(failures === 0 ? '\nDESKTOP PREPARE OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
