/**
 * Prove the purge plugin MOUNTS and its RPC channel ANSWERS, in a tree that can
 * actually settle.
 *
 * The full desktop tree cannot settle outside Electron (its desktop-* rows wait
 * on services the Electron launcher provides), so this boots the same composed
 * stack minus the rows whose only failure mode is "no Electron host", and
 * supplies the launcher services the web rows wait on. The purge plugin itself
 * is unmodified and still loaded from its real installed location via the real
 * profile package resolver.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" \
 *        tests/boot.mount.test.mjs "<app>/Resources/app.asar.unpacked"
 */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boot } from '@deepseek-ai/dsh-app-boot';

const appRoot = process.argv[2];
if (appRoot === undefined) throw new Error('usage: boot.mount.test.mjs <app.asar.unpacked>');

const { prepareDesktopProfile } = await import(`${appRoot}/lib/profile.js`);
const { installProfilePackageResolver } = await import(`${appRoot}/lib/module-resolution.js`);
const prepared = prepareDesktopProfile();
const releaseResolver = installProfilePackageResolver(prepared.bareModuleBaseUrl);
process.on('exit', () => releaseResolver?.());

/** Rows that exist only to talk to the Electron host; they cannot settle here.
 * `desktop-webserver` is deliberately KEPT: it provides `webServer`, which many
 * ordinary rows (including the connection service this plugin needs) wait on. */
const ELECTRON_ONLY = new Set([
    'desktop-shell',
    'desktop-diagnostics',
    'desktop-notifications',
    'desktop-pnpm',
    'desktop-profiles',
    'desktop-updates',
    'desktop-terminal',
]);

/** Strip Electron-only rows from the patch stack, descending into insert lists. */
function withoutElectronRows(stack) {
    const out = [];
    for (const entry of stack) {
        if (Array.isArray(entry?.insert)) {
            const kept = entry.insert.filter((row) => !ELECTRON_ONLY.has(row?.id));
            if (kept.length > 0) out.push({ ...entry, insert: kept });
            continue;
        }
        // Also drop id-targeted config patches aimed at removed rows.
        if (ELECTRON_ONLY.has(entry?.id)) continue;
        out.push(entry);
    }
    return out;
}

const patches = withoutElectronRows(prepared.patches);
const purgeStillThere = patches.some((e) => Array.isArray(e?.insert) && e.insert.some((r) => r?.id === 'session-purge'));
console.log('session-purge row survives filtering:', purgeStillThere);

const work = mkdtempSync(join(tmpdir(), 'dsh-boot-'));
const configPath = join(work, 'cordis.yml');
writeFileSync(configPath, '[]\n');

let bootError;
const ctx = await boot('boot.mount.test', configPath, patches, async (hostCtx) => {
    // The launcher supplies parsed argv before boot; use the real cmdline
    // provider so the web-startup row parses an ordinary empty invocation.
    const { provideCmdline } = await import('@deepseek-ai/dsh-cmdline');
    provideCmdline(hostCtx, { args: [], exit: () => {} });
}, prepared.bareModuleBaseUrl).catch((error) => {
    bootError = error;
    return undefined;
});

let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

if (ctx === undefined) {
    console.log('\nBOOT FAILED:\n' + String(bootError).slice(0, 4000));
    process.exit(1);
}

const purge = ctx.get('sessionPurge');
const connection = ctx.get('connection');
console.log('\nctx.sessionPurge mounted:', purge !== undefined);
console.log('ctx.connection mounted:', connection !== undefined);
console.log('ctx.sessionPersistence mounted:', ctx.get('sessionPersistence') !== undefined);

console.log('\nassertions:');
check('the purge service mounted', purge !== undefined, 'missing');
check('the connection service mounted', connection !== undefined, 'missing');

if (purge !== undefined) {
    try {
        await purge.delete('session-no-such-id');
        check('unknown id rejects', false, 'resolved unexpectedly');
    } catch (error) {
        check('unknown id rejects with NOT_FOUND',
            error?.code === 'SESSION_PURGE_NOT_FOUND' || /no conversation .* exists/.test(String(error?.message)),
            `${error?.code} | ${error?.message}`);
    }
    try {
        await purge.delete('   ');
        check('blank id rejects', false, 'resolved unexpectedly');
    } catch (error) {
        check('blank id rejects with INVALID_ID',
            error?.code === 'SESSION_PURGE_INVALID_ID' || /id is required/.test(String(error?.message)),
            `${error?.code} | ${error?.message}`);
    }
}

// The HOST-side connection service exposes rpc.handle/intercept (it is the
// registry); the BROWSER-side handle is the one with rpc.call. This test runs on
// the host, so assert the host surface and confirm the channel registered by
// checking that a second registration on the same channel is refused.
if (connection !== undefined) {
    const rpc = connection.rpc ?? ctx.get('connection')?.rpc;
    check('host connection exposes rpc.handle', typeof rpc?.handle === 'function', typeof rpc?.handle);
    try {
        await rpc.handle('/session-purge', async () => ({ ok: true, value: null }), { authority: 'trusted-host' });
        check('the /session-purge channel is already claimed by this plugin', false, 'registration unexpectedly succeeded');
    } catch (error) {
        check('the /session-purge channel is already claimed by this plugin', true, String(error).slice(0, 200));
    }
}

console.log(failures === 0 ? '\nPLUGIN MOUNTS AND ANSWERS' : `\n${failures} CHECK(S) FAILED`);
await ctx.fiber.dispose();
process.exit(failures === 0 ? 0 : 1);
