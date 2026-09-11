/**
 * Probe: can a later plugin replace one entry in the `workspace` locale
 * namespace, given that `locale.register()` THROWS on a duplicate?
 *
 * The render machinery resolves the browser's `t` seat through
 * `LocaleRuntime.bind(ns) -> translate(ns,key) -> lookup(ns,key)`, and `lookup`
 * reads `this.dicts` (a Map<ns, Map<locale, dict>>). This probe loads the REAL
 * locale client bundle, applies it, registers a stand-in `workspace` dictionary
 * exactly as the upstream workspace plugin does, then tries each override route
 * and reports which one actually changes the rendered string.
 */
let reg;
globalThis.window = { __ModuleLoader__: { load: (r) => { reg = r; } } };
globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: () => {} },
    documentElement: {},
};
await import('@deepseek-ai/dsh-client-locale/client');
const React = (await import('react')).default;
const jsxRuntime = await import('react/jsx-runtime');
const primitives = {};
for (const n of ['IconCloseOutline16','IconGlobeOutline16','IconCheckOutline16']) primitives[n] = () => null;
const localeApi = reg.factory((s) => {
    if (s === 'react') return React;
    if (s === 'react/jsx-runtime') return jsxRuntime;
    if (s === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    // The locale bundle also builds the Language settings row; that needs the
    // runtime's store factory, which is irrelevant to dictionary resolution.
    if (s === '@deepseek-ai/dsh-client-runtime/client') {
        return { defineStore: (spec) => ({ spec, actions: {}, getSnapshot: () => spec.init?.() ?? {}, subscribe: () => () => {} }) };
    }
    throw new Error('unexpected require: ' + s);
});

let localeService;
const slots = { installLocale: () => {}, register: () => () => {}, inject: (k, f) => f() };
const ctx = {
    provide: (k, v) => { if (k === 'locale') localeService = v; },
    effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {}; },
    on: () => () => {},
    inject: (deps, fn) => { fn(ctx); },
    settingsScope: { bind: () => ({ getSnapshot: () => ({ active: 'zh', locales: [] }), subscribe: () => () => {}, sync: () => {} }) },
    slots,
    get: (k) => (k === 'slots' ? slots : undefined),
    logger: { info: () => {}, warn: () => {}, error: () => {} },
};
localeApi.apply(ctx);
console.log('locale service provided:', localeService !== undefined);
console.log('has bind/dicts:', typeof localeService.bind, localeService.dicts instanceof Map);

// Stand in for the upstream workspace plugin's dictionary registration.
localeService.register('workspace', {
    zh: { 'group.ungrouped': '未分组', 'session.new': '新会话' },
    en: { 'group.ungrouped': 'Ungrouped', 'session.new': 'New Session' },
});
const t = localeService.bind('workspace');
console.log('baseline:', t('group.ungrouped'), '/', t('session.new'));

// Route A: a second register (documented to throw).
try {
    localeService.register('workspace', { zh: { 'group.ungrouped': '回收站' } });
    console.log('route A (re-register): UNEXPECTEDLY OK');
} catch (error) {
    console.log('route A (re-register): throws —', error.message.slice(0, 70));
}

// Route B done CORRECTLY: override EVERY registered locale of the namespace, not
// just the active one. The lookup chain is `active ?? en-fallback`, so patching
// only the active locale leaves a stale string in the other slot — and a locale
// switch would revert the label.
const OVERRIDES = { zh: '回收站', en: 'Recycle Bin' };
const locales = localeService.dicts.get('workspace');
for (const [locale, dict] of locales) {
    const replacement = OVERRIDES[locale] ?? OVERRIDES.en;
    locales.set(locale, { ...dict, 'group.ungrouped': replacement });
}
localeService.publish(localeService.snapshot.active, false);

for (const locale of ['zh', 'en']) {
    console.log(`route B [${locale}]:`, locales.get(locale)['group.ungrouped']);
}
console.log('  other key intact (zh):', locales.get('zh')['session.new']);
console.log('  other key intact (en):', locales.get('en')['session.new']);
console.log('  active locale is:', localeService.snapshot.active, '->', localeService.bind('workspace')('group.ungrouped'));
