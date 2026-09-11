import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only service and SlotMap convergence for the Desktop settings section.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { applyAdvancedShell } from './advanced-shell.ts'
import { startRendererBootReporter } from './boot-health.ts'
import { applyDesktopPluginsSection } from './desktop-plugins-settings.ts'
import { applyDesktopSettings } from './desktop-settings.ts'
import { installDesktopDirectoryPickerBridge, requestDesktopDirectoryValidation } from './directory-picker.ts'
import { parseDesktopClientEnvironment } from './environment.ts'
import { applyExtendedShell, applyFramedShell } from './extended-shell.ts'
import { installWorkspaceFolderDrop } from './workspace-folder-drop.ts'
import { desktopWindowService, provideDesktopWindow } from './window-service.ts'

export { applyAdvancedShell } from './advanced-shell.ts'
export { applyDesktopSettings } from './desktop-settings.ts'
export { applyExtendedShell, applyFramedShell } from './extended-shell.ts'
export {
  createDesktopSettingsApi,
  desktopSettingsPaths,
  parseDesktopActionAcceptance,
  parseDesktopRestartAcceptance,
  parseDesktopSettingsView,
} from './desktop-settings-api.ts'
export type {
  DesktopMarketProvider,
  DesktopMarketView,
  DesktopProfileView,
  DesktopRestartAcceptance,
  DesktopSettingsApi,
  DesktopSettingsView,
} from './desktop-settings-api.ts'
export { DesktopSettingsSection } from './DesktopSettingsSection.tsx'
export { DesktopTerminalSettingsAction } from './DesktopTerminalSettingsAction.tsx'
export type {
  DesktopTerminalSettingsActionInjected,
  DesktopTerminalSettingsActionProps,
} from './DesktopTerminalSettingsAction.tsx'
export type {
  DesktopNotificationSettings,
  DesktopSettingsSectionInjected,
  DesktopSettingsSectionProps,
  DesktopShellSettings,
} from './DesktopSettingsSection.tsx'
export {
  RENDERER_BOOT_REPORT_PATH,
  rendererBootReport,
  sendRendererBootReport,
  startRendererBootReporter,
} from './boot-health.ts'
export type { RendererBootLoader, RendererBootReport } from './boot-health.ts'
export { parseDesktopClientEnvironment } from './environment.ts'
export type {
  DesktopClientEnvironment,
  DesktopClientMaterial,
  DesktopClientMode,
  DesktopClientPlatform,
} from './environment.ts'
export { desktopWindowService, provideDesktopWindow } from './window-service.ts'
export type {
  DesktopWindowDragRegion,
  DesktopWindowInsets,
  DesktopWindowService,
} from './contracts.ts'

/** Services required by Desktop settings and Desktop-owned presentations. */
export const inject = [
  'slots',
  'locale',
  'connection',
  'remote',
  'settingsScope',
  'sessions',
  'theme',
  'workspaces',
  'uiRenderer',
]

/** Register desktop-owned client surfaces for the current BrowserWindow mode. @param ctx - browser Cordis context. */
export function apply(ctx: ClientContext): void {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    const platform = new URLSearchParams(window.location.search).get('dsh-desktop-platform')
    if (platform) {
      try { sessionStorage.setItem('dsh-desktop-platform', platform) } catch {}
    }
  }
  const environment = parseDesktopClientEnvironment(window.location.search)
  if (!environment) {
    const isDesktop = (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('dsh-desktop-platform') === 'win32' || sessionStorage.getItem('dsh-desktop-platform') === 'darwin'))
      || (typeof navigator !== 'undefined' && /windows|win32|macintosh|mac os x/i.test(navigator.userAgent || navigator.platform || ''))
    if (isDesktop) {
      ctx.effect(
        () => installDesktopDirectoryPickerBridge(),
        'dsh-plugin-desktop: native directory picker bridge',
      )
    }
    return
  }
  ctx.effect(
    () => provideDesktopWindow(ctx, desktopWindowService(environment)),
    'dsh-plugin-desktop: native window geometry service',
  )
  const desktopSettings = applyDesktopSettings(ctx, environment)
  applyDesktopPluginsSection(ctx)
  ctx.effect(
    () => startRendererBootReporter(ctx.loader),
    'dsh-plugin-desktop: renderer boot health report',
  )
  ctx.effect(
    () => installWorkspaceFolderDrop({
      create: input => ctx.workspaces.create(input),
      startSession: workspaceId => { ctx.workspaces.startSession(workspaceId) },
      ...(environment.platform === 'win32' || environment.platform === 'darwin'
        ? { validateDirectory: (path: string) => requestDesktopDirectoryValidation(path) }
        : {}),
    }),
    'dsh-plugin-desktop: workspace folder drop',
  )
  if (environment.platform === 'win32' || environment.platform === 'darwin') {
    ctx.effect(
      () => installDesktopDirectoryPickerBridge(),
      'dsh-plugin-desktop: native directory picker bridge',
    )
  }
  if (environment.mode === 'advanced') applyAdvancedShell(ctx, environment)
  if (environment.mode === 'extended') applyExtendedShell(ctx, environment, desktopSettings)
  if (environment.platform !== 'linux' && environment.mode === 'compatibility') {
    applyFramedShell(ctx, environment, desktopSettings)
  }
}
