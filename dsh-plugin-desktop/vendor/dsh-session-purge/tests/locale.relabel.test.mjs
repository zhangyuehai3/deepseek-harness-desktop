/**
 * Verify the real client bundle relabels the sidebar's "Ungrouped" bucket.
 *
 * What this pins down:
 *   1. the label really changes in the `workspace` namespace the sidebar reads;
 *   2. EVERY registered locale is rewritten (the lookup chain is
 *      `active ?? en-fallback`, so patching one slot leaves a stale string and a
 *      language switch would revert the label);
 *   3. unrelated keys and unrelated namespaces are untouched;
 *   4. it works when the upstream `workspace` namespace is registered AFTER this
 *      plugin's apply() — the ordering the real boot can produce.
 *
 * Run: ELECTRON_RUN_AS_NODE=1 "<app>/MacOS/EZAI Desktop" tests/locale.relabel.test.mjs <bundle>
 */
import { readFileSync } from 'node:fs';

const bundlePath = process.argv[2];
if (bundlePath === undefined) throw new Error('usage: locale.relabel.test.mjs <client bundle path>');

let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

const styleTags = [];
globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: (t) => styleTags.push(t) },
};
let registration;
globalThis.window = { __ModuleLoader__: { load: (r) => { registration = r; } } };
new Function(readFileSync(bundlePath, 'utf8'))();

const React = (await import('react')).default;
const jsxRuntime = await import('react/jsx-runtime');
const stubs = {};
for (const n of ['Button', 'IconListPenOutline16', 'IconTrashOutline16', 'Modal', 'StateDot']) {
    stubs[n] = (p) => React.createElement('div', { 'data-primitive': n, ...p });
}

const api = registration.factory((spec) => {
    if (spec === 'react') return React;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return stubs;
    throw new Error('unexpected require: ' + spec);
});

/** A minimal but faithful stand-in for LocaleRuntime's observable surface. */
function makeLocale() {
    const dicts = new Map();
    const listeners = new Set();
    const service = {
        dicts,
        snapshot: { active: 'zh', locales: [], revision: 0 },
        register(ns, localeOrDicts) {
            const pairs = typeof localeOrDicts === 'string' ? [] : Object.entries(localeOrDicts);
            let locales = dicts.get(ns);
            if (!locales) { locales = new Map(); dicts.set(ns, locales); }
            for (const [id] of pairs) {
                if (locales.has(id)) throw new Error(`locale namespace "${ns}" already has locale "${id}"`);
            }
            for (const [id, entries] of pairs) locales.set(id, entries);
            service.publish(service.snapshot.active, false);
            return () => {};
        },
        bind(ns) {
            return (key) => {
                const locales = dicts.get(ns);
                return locales?.get(service.snapshot.active)?.[key] ?? locales?.get('en')?.[key] ?? key;
            };
        },
        publish(active, changed) {
            service.snapshot = { ...service.snapshot, active, revision: service.snapshot.revision + 1 };
            for (const fn of [...listeners]) fn();
        },
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        getSnapshot() { return service.snapshot; },
    };
    return service;
}

function mount(applyOrder) {
    const locale = makeLocale();
    const registered = [];
    const ctx = {
        // The bundle reaches the locale service BOTH ways: `ctx.locale` directly
        // (dictionary registration) and `ctx.get('locale')` (the relabel guard).
        locale,
        get: (k) => (k === 'connection' ? { rpc: { call: async () => ({ ok: true, value: {} }) } }
            : k === 'locale' ? locale : undefined),
        effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
        slots: {
            inject: (name, factory) => { factory(); },
            register: (options, component) => { registered.push({ options, component }); return () => {}; },
        },
    };
    const upstream = () => locale.register('workspace', {
        zh: { 'group.ungrouped': '未分组', 'session.new': '新会话' },
        en: { 'group.ungrouped': 'Ungrouped', 'session.new': 'New Session' },
    });
    if (applyOrder === 'upstream-first') upstream();
    api.apply(ctx);
    if (applyOrder === 'plugin-first') upstream();
    return { locale, registered };
}

for (const order of ['upstream-first', 'plugin-first']) {
    console.log(`\napply order: ${order}`);
    const { locale } = mount(order);
    const t = locale.bind('workspace');
    const table = locale.dicts.get('workspace');

    check('zh label is 回收站', table.get('zh')['group.ungrouped'] === '回收站', table.get('zh')['group.ungrouped']);
    check('en label is Recycle Bin', table.get('en')['group.ungrouped'] === 'Recycle Bin', table.get('en')['group.ungrouped']);
    check('the bound seat resolves to the new label', t('group.ungrouped') === '回收站', t('group.ungrouped'));
    check('unrelated zh keys survive', table.get('zh')['session.new'] === '新会话', table.get('zh')['session.new']);
    check('unrelated en keys survive', table.get('en')['session.new'] === 'New Session', table.get('en')['session.new']);

    // A language switch must NOT revert the label.
    locale.publish('en', true);
    check('after switching to en the label stays', locale.bind('workspace')('group.ungrouped') === 'Recycle Bin',
        locale.bind('workspace')('group.ungrouped'));
    locale.publish('zh', true);
    check('after switching back to zh the label stays', locale.bind('workspace')('group.ungrouped') === '回收站',
        locale.bind('workspace')('group.ungrouped'));
}

console.log('\nunrelated namespace untouched:');
{
    const { locale } = mount('upstream-first');
    locale.register('other', { zh: { 'group.ungrouped': '别动我' } });
    check('a different namespace keeps its own value',
        locale.bind('other')('group.ungrouped') === '别动我', locale.bind('other')('group.ungrouped'));
}

console.log('\ndefensive: no locale service / no workspace namespace');
{
    const registered = [];
    // Deliberately NO locale service and no `ctx.locale`, to prove the relabel
    // guard degrades quietly instead of breaking plugin activation.
    const ctx = {
        get: (k) => (k === 'connection' ? { rpc: { call: async () => ({ ok: true, value: {} }) } } : undefined),
        effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
        slots: { inject: (n, f) => f(), register: (o, c) => { registered.push({ options: o, component: c }); return () => {}; } },
    };
    let threw;
    try { api.apply(ctx); } catch (error) { threw = error; }
    check('apply() does not throw without a locale service', threw === undefined, String(threw));
    check('the panel still registers', registered.length === 2, String(registered.length));
}

console.log(failures === 0 ? '\nLOCALE RELABEL OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
