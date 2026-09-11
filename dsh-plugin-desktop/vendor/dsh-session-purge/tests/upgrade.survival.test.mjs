/**
 * Simulate a VERSION UPGRADE's effect on the installed plugin.
 *
 * An upgrade replaces the app bundle, so the realistic question is: does the new
 * app's ordinary boot sequence keep, repair, or destroy the user-installed
 * plugin? This runs that exact sequence against the CURRENT (new) app code:
 *
 *   1. healProfilesModuleFallback(...)  — runs on EVERY boot
 *   2. prepareDesktopProfile()          — the DESKTOP app's real preparation,
 *      which reads the user layer from $DSH_HOME/cordis.patch.yml
 *
 * The check that actually matters is the last one: the plugin row must still be
 * present in the composed patch stack, not merely that files survived on disk.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" \
 *        tests/upgrade.survival.test.mjs "<app>/Resources/app.asar.unpacked"
 */
import { readlinkSync, lstatSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { healProfilesModuleFallback } from '@deepseek-ai/dsh-app-boot';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';

const appRoot = process.argv[2];
if (appRoot === undefined) throw new Error('usage: upgrade.survival.test.mjs <app.asar.unpacked>');

const { prepareDesktopProfile } = await import(`${appRoot}/lib/profile.js`);

const home = resolveDshHome();
const linkPath = join(home, 'profiles', 'node_modules', 'dsh-session-purge');
const packageJson = join(home, 'profiles', 'dsh-session-purge', 'package.json');
const homePatchPath = join(home, 'cordis.patch.yml');

/** Collect every loader ROW from a PatchOptions stack, descending into `insert` lists. */
function rowsOf(patchStack) {
    const rows = [];
    for (const entry of patchStack) {
        if (Array.isArray(entry?.insert)) rows.push(...entry.insert);
        if (typeof entry?.id === 'string') rows.push(entry);
    }
    return rows;
}

function md5(path) {
    return execFileSync('/sbin/md5', ['-q', path], { encoding: 'utf8' }).trim();
}
function linkState(path) {
    try {
        const st = lstatSync(path);
        return st.isSymbolicLink() ? `symlink -> ${readlinkSync(path)}` : `NOT a symlink (${st.isDirectory() ? 'dir' : 'file'})`;
    } catch (error) {
        return `MISSING (${error.code})`;
    }
}

if (!existsSync(homePatchPath)) {
    console.log(`FATAL: the user patch layer ${homePatchPath} does not exist — the plugin cannot load.`);
    process.exit(1);
}

const before = {
    link: linkState(linkPath),
    patchMd5: md5(homePatchPath),
    packageJsonMd5: md5(packageJson),
};
console.log('BEFORE (pre-boot):');
console.log('  link:            ', before.link);
console.log('  home patch md5:  ', before.patchMd5);
console.log('  package.json md5:', before.packageJsonMd5);

// ---- Step 1: the heal that every boot runs, against the NEW app's closure ----
healProfilesModuleFallback(join(appRoot, 'package.json'));
console.log('\nstep 1: healProfilesModuleFallback() ran against the app dependency closure');
console.log('  link after heal: ', linkState(linkPath));

// ---- Step 2: the desktop app's real preparation ----
const prepared = prepareDesktopProfile();
const rows = rowsOf(prepared.patches);
const purgeRow = rows.find((r) => r?.id === 'session-purge');

const after = {
    link: linkState(linkPath),
    patchMd5: md5(homePatchPath),
    packageJsonMd5: md5(packageJson),
    purgeRow: purgeRow === undefined ? undefined : JSON.stringify(purgeRow),
};

console.log('\nstep 2: prepareDesktopProfile() composed', rows.length, 'loader rows');
console.log('  session-purge row:', after.purgeRow);

let failures = 0;
function check(label, ok, detail) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
}

console.log('\nAFTER:');
console.log('  link:            ', after.link);
console.log('  home patch md5:  ', after.patchMd5, after.patchMd5 === before.patchMd5 ? '(UNCHANGED)' : '(CHANGED!)');
console.log('  package.json md5:', after.packageJsonMd5, after.packageJsonMd5 === before.packageJsonMd5 ? '(UNCHANGED)' : '(CHANGED!)');

console.log('\nassertions:');
check('the heal did NOT prune the plugin symlink', after.link.startsWith('symlink ->'), after.link);
check('the symlink still points at the plugin', after.link.includes('dsh-session-purge'), after.link);
check('the home patch layer was NOT rewritten', after.patchMd5 === before.patchMd5, `${before.patchMd5} -> ${after.patchMd5}`);
check('the plugin package.json was NOT rewritten', after.packageJsonMd5 === before.packageJsonMd5, `${before.packageJsonMd5} -> ${after.packageJsonMd5}`);
check('the plugin still mounts in the desktop patch stack', purgeRow !== undefined, 'row missing');
check('the persistence backend is still composed', rows.some((r) => r?.id === 'session-persistence-jsonl'));

console.log(failures === 0
    ? '\nSURVIVES THE UPGRADE BOOT SEQUENCE'
    : `\n${failures} PROBLEM(S) FOUND`);
process.exit(failures === 0 ? 0 : 1);
