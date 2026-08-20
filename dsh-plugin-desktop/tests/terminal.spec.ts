import type { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '../src/terminal.ts'

describe('desktop terminal Host plugin', () => {
  it('keeps the plugin identity but does not register a tray command', () => {
    const registerTrayItem = vi.fn()
    const ctx = {
      desktopRuntime: { registerTrayItem },
      effect: vi.fn(),
    } as unknown as Context

    apply(ctx)

    expect(name).toBe('desktop-terminal')
    expect(inject).toEqual(['desktopRuntime'])
    expect(registerTrayItem).not.toHaveBeenCalled()
    expect(ctx.effect).not.toHaveBeenCalled()
  })
})
