/**
 * Styles for cross-session recall features:
 * - Session Picker Modal
 * - Context menu for sidebar sessions
 * - Drag-and-drop dropzone highlight
 * - Floating feedback toast
 */

const RECALL_STYLES = `
/* Floating Toast */
.dsh-recall-toast {
  position: fixed;
  bottom: 84px;
  left: 50%;
  transform: translateX(-50%) translateY(12px);
  background: var(--dsh-surface-dropdown, #1e1e24);
  color: var(--dsh-text-primary, #ffffff);
  border: 1px solid var(--dsh-border-subtle, rgba(255, 255, 255, 0.12));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 9999;
}
.dsh-recall-toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* Sidebar Context Menu */
.dsh-session-context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--dsh-surface-menu, #1c1d22);
  border: 1px solid var(--dsh-border-menu, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 4px;
  min-width: 170px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  animation: dshMenuFadeIn 0.12s ease-out;
  user-select: none;
}
@keyframes dshMenuFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.dsh-session-context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12.5px;
  color: var(--dsh-text-primary, #e2e8f0);
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.12s;
}
.dsh-session-context-menu-item:hover {
  background: var(--dsh-surface-hover, rgba(255, 255, 255, 0.08));
  color: #ffffff;
}
.dsh-session-context-menu-item svg {
  opacity: 0.8;
  flex-shrink: 0;
}
.dsh-session-context-menu-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 4px 0;
}

/* Composer Card Drag-and-Drop Highlight */
[data-composer-card].dsh-drop-target-active {
  outline: 2px dashed #4f87ff !important;
  outline-offset: -2px;
  background: rgba(79, 135, 255, 0.05) !important;
  transition: outline 0.15s ease, background 0.15s ease;
}

/* Session Picker Modal */
.dsh-session-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 14vh;
  animation: dshOverlayFadeIn 0.15s ease-out;
}
@keyframes dshOverlayFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.dsh-session-picker-dialog {
  width: 90%;
  max-width: 580px;
  background: var(--dsh-surface-modal, #18191e);
  border: 1px solid var(--dsh-border-modal, rgba(255, 255, 255, 0.12));
  border-radius: 12px;
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 65vh;
  animation: dshDialogSlideDown 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes dshDialogSlideDown {
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.dsh-session-picker-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.dsh-session-picker-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--dsh-text-primary, #ffffff);
  font-size: 14px;
  outline: none;
}
.dsh-session-picker-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
.dsh-session-picker-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.dsh-session-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
  color: var(--dsh-text-primary, #f1f5f9);
}
.dsh-session-picker-item:hover,
.dsh-session-picker-item.selected {
  background: var(--dsh-surface-hover, rgba(255, 255, 255, 0.08));
}
.dsh-session-picker-item-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.dsh-session-picker-item-title {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dsh-session-picker-item-meta {
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.45);
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-session-picker-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.7;
}
.dsh-session-picker-item:hover .dsh-session-picker-item-actions {
  opacity: 1;
}
.dsh-session-picker-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11.5px;
  cursor: pointer;
  transition: background 0.12s;
}
.dsh-session-picker-btn:hover {
  background: rgba(255, 255, 255, 0.16);
}
.dsh-session-picker-empty {
  padding: 32px 16px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 13px;
}
.dsh-session-picker-footer {
  padding: 8px 16px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  justify-content: space-between;
}

/* Header Quote Utility Button */
.dsh-header-quote-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsh-text-secondary, rgba(255, 255, 255, 0.7));
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.15s ease;
}
.dsh-header-quote-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.16);
}
.dsh-header-quote-btn svg {
  opacity: 0.85;
}
`

const STYLE_ID = 'dsh-session-recall-styles'

export function injectRecallStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = RECALL_STYLES
  document.head.appendChild(style)
}
