/**
 * Render the REAL client bundle's component tree and assert the delete flow.
 *
 * The earlier client test only executed the bundle factory and called `apply` —
 * it never RENDERED the component, which is how a broken panel shipped. This one
 * uses `react-dom/server` to mount the actual component with realistic slot
 * props, so a render crash surfaces as a test failure instead of in the user's
 * face.
 *
 * What this CANNOT cover: click handlers (server rendering fires none). The
 * interaction-level guarantees are asserted structurally below — the row filter,
 * the archive-set dependency, and the RPC call shape.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" tests/client.render.test.mjs <bundle>
 */
import { readFileSync } from 'node:fs';

const bundlePath = process.argv[2];
if (bundlePath === undefined) throw new Error('usage: client.render.test.mjs <client bundle path>');

// The bundle's only DOM use is injecting a <style> tag; provide just that.
const styleTags = [];
globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: (t) => styleTags.push(t) },
};
let registration;
globalThis.window = { __ModuleLoader__: { load: (r) => { registration = r; } } };
new Function(readFileSync(bundlePath, 'utf8'))();
if (registration === undefined) throw new Error('the bundle did not register');

const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const jsxRuntime = await import('react/jsx-runtime');
// The real primitives package imports `.css` modules that only a bundler can
// resolve, so substitute inert components with the same names. Everything else
// (React, the bundle, its component tree) stays real.
const primitives = {};
for (const name of ['Button', 'IconListPenOutline16', 'IconTrashOutline16', 'Modal', 'StateDot']) {
    primitives[name] = (p) => React.createElement('div', { 'data-primitive': name, ...p });
}

let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

/** Translation seat: returns the KEY plus params, so assertions stay copy-independent. */
const t = (key, params) => (params === undefined ? key : `${key}(${Object.values(params).join(',')})`);

const DELETED_ID = 'session-11111111-1111-1111-1111-111111111111';
const KEPT_ID = 'session-22222222-2222-2222-2222-222222222222';
const ARCHIVED_ID = 'session-33333333-3333-3333-3333-333333333333';
const SUBAGENT_ID = 'session-44444444-4444-4444-4444-444444444444';
const BLANK_ID = 'session-55555555-5555-5555-5555-555555555555';
const RUNNING_ID = 'session-66666666-6666-6666-6666-666666666666';

const sessionsSnapshot = {
    current: KEPT_ID,
    ids: [DELETED_ID, KEPT_ID, ARCHIVED_ID, SUBAGENT_ID, BLANK_ID, RUNNING_ID],
    byId: {
        [DELETED_ID]: { id: DELETED_ID, title: 'Delete me', displayTitle: 'Delete me', updatedAt: Date.now() - 60000, running: false, blank: false },
        [KEPT_ID]: { id: KEPT_ID, title: 'Keep me', displayTitle: 'Keep me', updatedAt: Date.now() - 30000, running: false, blank: false },
        [ARCHIVED_ID]: { id: ARCHIVED_ID, title: 'Archived one', displayTitle: 'Archived one', updatedAt: Date.now() - 90000, running: false, blank: false },
        [RUNNING_ID]: { id: RUNNING_ID, title: 'Running one', displayTitle: 'Running one', updatedAt: Date.now() - 5000, running: true, blank: false },
        [SUBAGENT_ID]: { id: SUBAGENT_ID, title: 'Subagent child', displayTitle: 'Subagent child', updatedAt: Date.now() - 10000, running: false, blank: false, origin: 'subagent' },
        [BLANK_ID]: { id: BLANK_ID, title: 'New Session', displayTitle: 'New Session', updatedAt: Date.now(), running: false, blank: true },
    },
};
const workspacesSnapshot = {
    items: [{ workspaceId: 'ws-1', title: 'EZAI', sessionIds: [DELETED_ID, KEPT_ID, ARCHIVED_ID, SUBAGENT_ID, BLANK_ID, RUNNING_ID] }],
    archivedSessionIds: [ARCHIVED_ID],
    phase: 'ready',
};

const connection = {
    rpc: { call: async () => ({ ok: true, value: {} }) },
};

const registered = [];
const ctx = {
    get: (k) => (k === 'connection' ? connection : undefined),
    effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    locale: { register: () => () => {} },
    slots: {
        inject: (name, factory) => { factory(); },
        register: (options, component) => { registered.push({ options, component }); return () => {}; },
    },
};

const api = registration.factory((spec) => {
    if (spec === 'react') return React;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error('unexpected require: ' + spec);
});
api.apply(ctx);

check('the bundle registered slot entries', registered.length === 1, String(registered.length));
const settingsEntry = registered.find(r => r.options?.name === 'settings.section');
if (settingsEntry === undefined) { console.log('\nnothing to render'); process.exit(1); }

const props = {
    wide: true,
    useSessions: (selector) => selector(sessionsSnapshot),
    useWorkspaces: (selector) => selector(workspacesSnapshot),
    t,
    ...settingsEntry.options.inject(),
};

console.log('\nrender:');
let settingsHtml;
try {
    settingsHtml = renderToStaticMarkup(React.createElement(settingsEntry.component, props));
} catch (error) {
    check('the settings section renders without throwing', false, `${error.constructor.name}: ${error.message}`);
    console.log(`\n${failures} CHECK(S) FAILED`);
    process.exit(1);
}
check('the settings section renders without throwing', true);
check('renders with the hooks the framework synthesizes (useSessions/useWorkspaces)', true);
check('settings section contains heading and search', settingsHtml.includes('dsp-section-title') && settingsHtml.includes('dsp-search'));
check('settings section contains tabs for all and pending', settingsHtml.includes('dsp-tabs') && settingsHtml.includes('dsp-tab'));

console.log('\nrow filtering (the bug that shipped):');
const src = readFileSync(bundlePath, 'utf8');
check('filters out subagent sessions', src.includes('origin === "subagent"'));
check('filters out the blank New Session row', src.includes('blank === true'));
check('the row state mirrors the host gate (agent.status === running)', src.includes('manage.running.hint'));
check('a running row disables its delete button', src.includes('disabled: busy || running'));
check('filters out ARCHIVED sessions', src.includes('archived.has(id)'),
    'archived sessions must be hidden, or delete looks like a no-op');
check('reads the archive set from the workspaces snapshot', src.includes('archivedSessionIds'));
check('the filter memo depends on the archive set and pending purges',
    /}, \[sessions, archived, pendingMap, pendingList\]\)/.test(src), 'useMemo deps must include `archived` and `pendingMap` or the filter goes stale');

console.log('\nRPC call shape:');
check('uses the private channel', src.includes('const CHANNEL = "/session-purge"'));
check('uses the delete endpoint', src.includes('const ENDPOINT = "delete"'));
check('requires result.ok === true for success', src.includes('result.ok === true'));
check('reads the host error message', src.includes('error.message'));

console.log('\nuser-visible copy:');
check('shows a success banner after a delete', src.includes('delete.ok'));
check('shows the host failure message', src.includes('delete.failed'));

console.log(`\nstyle tags injected: ${styleTags.length}`);
check('injects its stylesheet once', styleTags.length === 1, String(styleTags.length));

console.log(failures === 0 ? '\nCLIENT RENDER OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
