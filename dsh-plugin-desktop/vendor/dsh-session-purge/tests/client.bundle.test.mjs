import { readFileSync } from 'node:fs';

// Minimal DOM stubs so the bundle's top-level registration runs exactly as the
// client module loader would run it.
const styles = [];
globalThis.document = {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: (el) => styles.push(el) },
};
let registration;
globalThis.window = { __ModuleLoader__: { load: (r) => { registration = r; } } };

new Function(readFileSync(process.argv[2], 'utf8'))();
if (!registration) throw new Error('bundle did not register');
console.log('registered id:', registration.id, '| matches pkg:', registration.id === 'dsh-session-purge');

const react = await import('react');
const jsxRuntime = await import('react/jsx-runtime');

// Stub the primitives face: the real package imports .css files that only a
// bundler can resolve, so substitute inert components with the same names.
const primitives = {};
for (const n of ['Button', 'IconListPenOutline16', 'IconTrashOutline16', 'Modal', 'StateDot']) {
    primitives[n] = (props) => react.createElement('div', { 'data-stub': n, ...props });
}

const out = registration.factory((spec) => {
    if (spec === 'react') return react;
    if (spec === 'react/jsx-runtime') return jsxRuntime;
    if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error('unexpected require: ' + spec);
});
console.log('exports:', Object.keys(out).sort().join(','));
console.log('inject:', JSON.stringify(out.inject));
console.log('apply type:', typeof out.apply);
console.log('style tags injected:', styles.length, '| css len:', styles[0]?.textContent?.length ?? 0);

// Exercise apply() against a fake cordis ctx, proving the slot registration
// carries exactly the options the slot ledger requires.
let failures = 0;
const check = (label, ok, detail) => {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${ok || detail === undefined ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

let zhDict;
let enDict;
let localeNs;
const registrations = [];
const localeService = {
    register: (ns, dicts) => {
        localeNs = ns;
        zhDict = dicts.zh;
        enDict = dicts.en;
        return () => {};
    },
};
const fakeCtx = {
    // The bundle resolves the locale service through `ctx.get('locale')`.
    get: (k) => (k === 'connection' ? { rpc: { call: async () => ({ ok: true, value: {} }) } }
        : k === 'locale' ? localeService : undefined),
    // `ctx.effect(fn)` runs `fn` and keeps its disposer: the bundle registers its
    // locale dictionaries inside an effect, so a no-op stub would hide that.
    effect: (fn) => {
        const disposer = fn();
        return typeof disposer === 'function' ? disposer : () => {};
    },
    slots: {
        inject: (name, factory) => { factory(); },
        register: (options, component) => { registrations.push({ options, component }); return () => {}; },
    },
};
out.apply(fakeCtx);

console.log('\ndictionary integrity:');
check('exactly one namespace was registered', localeNs === 'session-purge', localeNs);
check('zh dictionary is present', zhDict !== undefined);
check('en dictionary is present', enDict !== undefined);

// A duplicated key inside one object literal is silently legal JS and silently
// drops a string, so assert on the RAW SOURCE that no key repeats per dictionary.
const source = readFileSync(process.argv[2], 'utf8');
for (const [name, literal] of [['zh', 'const zh = {'], ['en', 'const en = {']]) {
    const start = source.indexOf(literal);
    const end = source.indexOf('\n\t\t};', start);
    const block = source.slice(start, end === -1 ? undefined : end);
    const keys = [...block.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    check(`${name} dictionary has no duplicate keys`, dupes.length === 0, dupes.join(', '));
}

if (zhDict !== undefined && enDict !== undefined) {
    const zhk = Object.keys(zhDict).sort();
    const enk = Object.keys(enDict).sort();
    const missingEn = zhk.filter((k) => !(k in enDict));
    const missingZh = enk.filter((k) => !(k in zhDict));
    check('every zh key has an en counterpart', missingEn.length === 0, missingEn.join(', '));
    check('every en key has a zh counterpart', missingZh.length === 0, missingZh.join(', '));
    check('the success banner copy exists in both', 'delete.ok' in zhDict && 'delete.ok' in enDict);
}

console.log('\nregistration:');
check('registered slot entries', registrations.length === 2, String(registrations.length));
const footReg = registrations.find((r) => r.options?.name === 'sidebar.footer.action');
check('registered into sidebar.footer.action', footReg !== undefined);
check('foot registration has a stable id', footReg?.options?.id === 'session-purge', footReg?.options?.id);
check('foot registration declares the locale namespace', footReg?.options?.locale === 'session-purge', footReg?.options?.locale);
check('foot component is a function', typeof footReg?.component === 'function');

const settingsReg = registrations.find((r) => r.options?.name === 'settings.section');
check('registered into settings.section', settingsReg !== undefined);
check('settings registration has id session-purge', settingsReg?.options?.id === 'session-purge', settingsReg?.options?.id);
check('settings registration has order 120 (under ezai-account 110)', settingsReg?.options?.order === 120, String(settingsReg?.options?.order));
check('settings component is a function', typeof settingsReg?.component === 'function');

console.log(failures === 0 ? '\nCLIENT BUNDLE OK' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
