/**
 * Sidebar footer stacking, owned by Desktop in every presentation mode.
 *
 * Upstream renders `sidebar.footer.action` as a `display: contents` anchor
 * inside a row flex container, so several registered launchers become flex
 * siblings on one line and crush each other. Desktop stacks them instead.
 *
 * The rule deliberately carries no `data-dsh-desktop-mode` prefix: compatibility
 * mode serves its titlebar from a separate chrome view and never marks the body,
 * and the stylesheet only ever installs from the Desktop client bundle, which
 * exits before this point for an ordinary browser URL.
 */

const STYLE_ID = 'dsh-desktop-sidebar-footer-styles'

/**
 * The `body` prefix is load-order insurance, not decoration. Plugin stylesheets
 * are appended to head at apply time, so source order cannot settle a tie, and
 * `body [data-slot=…]` (0,1,1) beats any single-class rule a launcher may aim
 * at the slot. The children rule claims only flex participation, so every
 * launcher keeps its own seat — including `.dshMarketLauncher[data-wide='false']`
 * and its circular rail geometry.
 *
 * Geometry defers to upstream's own footer row (`SettingsRoot.module.css`
 * `.triggerRow`): a footer seat spans `100% + 4px` at `margin: -2px`, bleeding
 * 2px per side, and both registered launchers already follow that house rule.
 * So the slot is not resized — it is re-centered. The anchor grows 4px per side
 * and pays 4px of it back as padding, leaving a content box exactly as wide as
 * the slot: the launchers keep their native bleed and land pixel-flush with the
 * Settings row, while the extra border-box width becomes clip clearance. That
 * matters because the seat stays height-bounded (extra third-party launchers
 * must not swallow the workspace list) and `overflow-y` therefore makes it a
 * scroll container clipping at the padding box, which is what used to shave the
 * rounded corners. No width is forced on the children: React renders Tooltip
 * bubbles inside this same anchor, and a `width: 100%` there stretches them to
 * the viewport. A reserved scrollbar gutter is exactly what made the right
 * inset disagree with the left, so there is none.
 */
const CSS = `
body [data-slot="sidebar.footer.action"] {
  display: flex !important;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
  width: calc(100% + 8px);
  margin-inline: -4px;
  max-height: min(40vh, 240px);
  padding: 0 4px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
body [data-slot="sidebar.footer.action"] > * {
  flex: none;
  min-width: 0;
}

/* Hide session log upload row and toast in General Settings */
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="Session Log"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="session log"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="Session-log"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="会话日志"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="Sitzungsprotokoll"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="journal de session"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="registro de sesión"]),
body [data-slot="settings.general.item"] > div:has([role="switch"][aria-label*="セッションログ"]),
body [data-slot="settings.general.item"] > div:has([aria-label*="Session Log"]),
body [data-slot="settings.general.item"] > div:has([aria-label*="会话日志"]),
body [data-slot="shell.overlay"] [data-slot-id="session-log-upload-toast"],

/* Hide sidebar top "插件" (Plugins) */
div[class*="panelEntry"]:has(svg[data-icon*="plugin-pinwheel"]),
div[class*="panelEntry"]:has(button[aria-label="插件"]),
div[class*="panelEntry"]:has(button[aria-label="Plugins"]),
button[class*="panelRow"]:has(svg[data-icon*="plugin-pinwheel"]),

/* Hide sidebar top "更多" (More) */
nav[class*="panelList"] [class*="moreAnchor"],
nav[class*="panelList"] button[class*="moreRow"],
nav[class*="panelList"] div:has(> button[class*="moreRow"]),
nav[class*="panelList"] div:has(svg[data-icon*="more-outline"]),

/* Hide "意见反馈" in popup menus */
div[class*="itemWrap"]:has(svg[data-icon*="paper-plane"]),
button[role="menuitem"]:has(svg[data-icon*="paper-plane"]),

/* Hide "登录" and keep only "设置" in bottom-left "... 更多" popup menu */
[class*="signedOutMenu"] > :nth-child(n+2),
[class*="signedOutMenu"] div[class*="itemWrap"]:has(svg[data-icon*="user-outline"]),
[class*="signedOutMenu"] button[role="menuitem"]:has(svg[data-icon*="user-outline"]),

/* Hide right sidebar guide "更多工具" (More tools) */
[data-sidebar-right-guide] div[class*="entryCell"]:has([class*="moreAnchor"]),
[data-sidebar-right-guide] [class*="moreAnchor"],
div[class*="entryCell"]:has(button[aria-label="更多工具"]),
div[class*="entryCell"]:has(button[aria-label="More tools"]),

/* Hide "当前版本" in General settings */
[data-slot="settings.general.item"] > div:not(:has(button, input, select, a, [role])),
[data-slot="settings.general.item"] > div:last-child,

/* Hide notice card "插件市场和远程控制设置已移至插件页面" in Desktop settings */
.dshNextPluginSettingsNotice,
[data-next-plugin-settings-notice] {
  display: none !important;
}

[data-slot="settings.general.item"] > div:has(+ div:last-child:not(:has(button, input, select, a, [role]))) {
  border-bottom: none !important;
}
`

/** Install the footer stacking sheet once; tolerate headless Client boot. */
export function installSidebarFooterStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (document.getElementById(STYLE_ID) !== null) return () => {}
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = 'dsh-plugin-desktop'
  style.dataset.pluginCss = 'dsh-plugin-desktop/sidebar-footer'
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
