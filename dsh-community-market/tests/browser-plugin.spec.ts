// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, NS } from '../src/client/index.js'
// import { MarketLauncher } from '../src/client/MarketLauncher.js'
import { MarketOverlay } from '../src/client/MarketOverlay.js'
// import { en, zh } from '../src/client/locales.js'

interface TestEntry {
  readonly component: unknown
  readonly inject?: (() => unknown) | undefined
  readonly locale?: string | undefined
  readonly options: Record<string, unknown>
}

interface Injection {
  readonly name: string
  readonly factory: () => () => void
  active?: (() => void) | undefined
}

function bench() {
  let locale = 'zh'
  const dictionaries = new Map<string, { zh: Record<string, string>; en: Record<string, string> }>()
  const declarations = new Set<string>()
  const entries = new Map<string, TestEntry[]>()
  const injections: Injection[] = []
  const effects: (() => void)[] = []

  const activate = (injection: Injection): void => {
    if (declarations.has(injection.name) && injection.active === undefined) injection.active = injection.factory()
  }
  const deactivate = (injection: Injection): void => {
    injection.active?.()
    injection.active = undefined
  }
  const slots = {
    inject(name: string, factory: () => () => void): void {
      const injection = { name, factory }
      injections.push(injection)
      activate(injection)
    },
    register(options: Record<string, unknown>, component: unknown): () => void {
      const name = String(options.name)
      const entry = {
        component,
        inject: options.inject as (() => unknown) | undefined,
        locale: options.locale as string | undefined,
        options,
      }
      const list = entries.get(name) ?? []
      list.push(entry)
      entries.set(name, list)
      return () => {
        const current = entries.get(name)
        if (current === undefined) return
        const index = current.indexOf(entry)
        if (index >= 0) current.splice(index, 1)
      }
    },
  }
  const localeService = {
    register(namespace: string, next: { zh: Record<string, string>; en: Record<string, string> }): () => void {
      dictionaries.set(namespace, next)
      return () => { dictionaries.delete(namespace) }
    },
    bind(namespace: string): (key: string) => string {
      return key => dictionaries.get(namespace)?.[locale as 'zh' | 'en'][key] ?? key
    },
    getLocale: () => ({ active: locale }),
  }
  const ctx = {
    locale: localeService,
    slots,
    effect(factory: () => void | (() => void)): void {
      const dispose = factory()
      if (dispose !== undefined) effects.push(dispose)
    },
  }

  return {
    apply: () => { apply(ctx as never) },
    declare(name: string): () => void {
      declarations.add(name)
      for (const injection of injections) activate(injection)
      return () => {
        declarations.delete(name)
        for (const injection of injections.filter(value => value.name === name)) deactivate(injection)
      }
    },
    dispose(): void {
      for (const injection of injections) deactivate(injection)
      for (const dispose of effects.reverse()) dispose()
    },
    entries: (name: string) => entries.get(name) ?? [],
    setLocale: (next: 'zh' | 'en') => { locale = next },
  }
}

beforeEach(() => {
  Object.defineProperty(navigator, 'languages', { value: ['zh-CN'], configurable: true })
  Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true })
})

afterEach(() => {
  const own = navigator as unknown as Record<string, unknown>
  delete own.languages
  delete own.language
  vi.restoreAllMocks()
})

describe('community market browser plugin', () => {
  it('installs the unified market surface and modal size contract', () => {
    const b = bench()

    b.apply()

    const styles = document.querySelector<HTMLStyleElement>('style[data-plugin="dsh-community-market/styles"]')?.textContent ?? ''
    expect(styles).toMatch(/\.dshMarketWideModal\s*\{[^}]*width: min\(800px, calc\(100vw - 48px\)\)/su)
    expect(styles).toMatch(/\.dshMarketConfirmModal\s*\{[^}]*width: min\(600px, calc\(100vw - 48px\)\)/su)
    expect(styles).toMatch(/\.dshMarketSourceModal\s*\{[^}]*width: min\(600px, calc\(100vw - 48px\)\)/su)
    expect(styles).toMatch(/\.dshMarketStatusModal\s*\{[^}]*width: min\(480px, calc\(100vw - 48px\)\)/su)
    expect(styles).toMatch(/\.dshMarketOverlayPanel\s*\{[^}]*width: min\(800px, 100%\);[^}]*height: min\(700px, 100%\)/su)
    expect(styles).toMatch(/@media \(max-width: 680px\)[\s\S]*\.dshMarketOverlayPanel\s*\{[^}]*width: 100%;[^}]*height: 100%/u)

    b.dispose()
  })

  it('registers only the shell overlay and hides the market settings tab and sidebar launcher', () => {
    const b = bench()
    for (const name of ['settings.plugins.tab', 'sidebar.footer.action', 'shell.overlay']) b.declare(name)
    const fetch = vi.spyOn(globalThis, 'fetch')

    b.apply()

    expect(inject).toEqual(['slots', 'locale'])
    const settings = b.entries('settings.plugins.tab')
    const launcher = b.entries('sidebar.footer.action')
    const overlay = b.entries('shell.overlay')
    expect(settings).toHaveLength(0)
    expect(launcher).toHaveLength(0)
    expect(overlay).toHaveLength(1)
    expect(overlay[0]?.component).toBe(MarketOverlay)
    expect(overlay[0]?.options).toMatchObject({ id: 'community-market', order: 10 })
    expect(overlay[0]?.locale).toBe(NS)
    expect(fetch).not.toHaveBeenCalled()

    const overlayInject = overlay[0]?.inject?.() as { readLocale: () => string }
    expect(overlayInject.readLocale()).toBe('zh')
    b.setLocale('en')
    expect(overlayInject.readLocale()).toBe('en')

    b.dispose()
    expect(b.entries('settings.plugins.tab')).toHaveLength(0)
    expect(b.entries('sidebar.footer.action')).toHaveLength(0)
    expect(b.entries('shell.overlay')).toHaveLength(0)
    expect(document.querySelector('style[data-plugin="dsh-community-market/styles"]')).toBeNull()
  })

  it('follows late declaration and declaration reload for the overlay only', () => {
    const b = bench()
    b.apply()
    const hidden = ['settings.plugins.tab', 'sidebar.footer.action'] as const
    const names = ['shell.overlay'] as const
    for (const name of hidden) expect(b.entries(name)).toHaveLength(0)
    for (const name of names) expect(b.entries(name)).toHaveLength(0)

    const stops = names.map(name => b.declare(name))
    for (const name of hidden) expect(b.entries(name)).toHaveLength(0)
    for (const name of names) expect(b.entries(name)).toHaveLength(1)
    for (const stop of stops) stop()
    for (const name of names) expect(b.entries(name)).toHaveLength(0)

    for (const name of names) b.declare(name)
    expect(b.entries('shell.overlay')[0]?.component).toBe(MarketOverlay)

    b.dispose()
    for (const name of names) expect(b.entries(name)).toHaveLength(0)
  })
})
