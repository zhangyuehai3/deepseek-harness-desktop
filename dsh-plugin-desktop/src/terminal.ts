/** Cordis Host plugin contributing the packaged EZAI terminal to the native tray. */

// import type { Context } from '@deepseek-ai/cordis'
// import type {} from './runtime.ts'
// import { desktopTrayLabel } from './tray-locale.ts'

/** Stable Cordis plugin name. */
export const name = 'desktop-terminal'

/** Native adapter required to create shims and launch the system terminal. */
export const inject = ['desktopRuntime']

/**
 * Register the system-terminal command for one Host generation.
 *
 * The tray command is currently hidden while the packaged terminal remains
 * available through plugin recovery and the active profile.
 * @param _ctx - Host context carrying the Electron adapter.
 */
export function apply(_ctx: unknown): void {
  // The tray entry is intentionally disabled. Keep the plugin identity so the
  // row can be re-enabled without re-creating the profile entry.
}
