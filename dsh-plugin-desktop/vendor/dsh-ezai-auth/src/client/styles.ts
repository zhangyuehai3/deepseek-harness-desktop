/** Inline styles for the EZAI account tab and login modal. */

const STYLE_TAG = 'dsh-ezai-auth/style.css'

export function injectCss(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG)}]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-ezai-auth'
  tag.dataset.pluginCss = STYLE_TAG
  tag.textContent = `
/* Modal Backdrop & Animation */
.dshEzaiAuthModalBackdrop {
  position: fixed;
  inset: 0;
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(18, 30, 29, 0.6);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 16px;
  box-sizing: border-box;
  opacity: 0;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.dshEzaiAuthModalBackdrop[data-visible="true"] {
  opacity: 1;
}

/* Modal Card */
.dshEzaiAuthModal {
  position: relative;
  width: min(420px, 100%);
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  color: var(--dsw-alias-label-primary, #112625);
  border-radius: 18px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.15));
  box-shadow: 0 24px 50px -12px rgba(18, 48, 46, 0.32), 0 0 0 1px rgba(152, 196, 85, 0.12);
  padding: 30px 28px 26px;
  box-sizing: border-box;
  transform: translateY(12px) scale(0.97);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.dshEzaiAuthModalBackdrop[data-visible="true"] .dshEzaiAuthModal {
  transform: translateY(0) scale(1);
}

/* Close Button */
.dshEzaiAuthCloseBtn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #7a9493);
  border-radius: 8px;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.dshEzaiAuthCloseBtn:hover {
  background-color: rgba(38, 92, 90, 0.08);
  color: #265C5A;
}

/* Modal Header & Branding */
.dshEzaiAuthHeader {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 24px;
}
.dshEzaiAuthLogo {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: linear-gradient(135deg, #265C5A 0%, #19403e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98C455;
  box-shadow: 0 8px 18px -4px rgba(38, 92, 90, 0.4), 0 0 0 1px rgba(152, 196, 85, 0.35);
  margin-bottom: 14px;
}
.dshEzaiAuthTitle {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary, #153332);
}
.dshEzaiAuthSubtitle {
  margin: 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary, #587372);
}

/* Form Styles */
.dshEzaiAuthForm {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dshEzaiAuthField {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dshEzaiAuthLabel {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #234746);
}

/* Input Container with Leading Icon */
.dshEzaiAuthInputWrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.dshEzaiAuthInputIcon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: #729190;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dshEzaiAuthInput {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 36px;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.18));
  background-color: var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.03));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.dshEzaiAuthInput:hover:not(:disabled) {
  border-color: rgba(38, 92, 90, 0.35);
}
.dshEzaiAuthInput:focus {
  background-color: var(--dsw-alias-bg-layer-1, #ffffff);
  border-color: #265C5A;
  box-shadow: 0 0 0 3px rgba(38, 92, 90, 0.14), 0 0 0 1px rgba(152, 196, 85, 0.3);
}
.dshEzaiAuthInput::placeholder {
  color: var(--dsw-alias-label-tertiary, #8fa7a6);
}
.dshEzaiAuthInput:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

/* Captcha Layout */
.dshEzaiAuthCaptchaRow {
  display: flex;
  align-items: center;
  gap: 10px;
}
.dshEzaiAuthCaptchaWrap {
  flex: 1;
}
.dshEzaiAuthCaptchaBox {
  position: relative;
  height: 40px;
  min-width: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.18));
  background-color: var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.03));
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.dshEzaiAuthCaptchaBox:hover {
  border-color: #265C5A;
  box-shadow: 0 2px 10px rgba(38, 92, 90, 0.12);
}
.dshEzaiAuthCaptchaImg {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.dshEzaiAuthCaptchaLoading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #587372;
}

/* Captcha-specific error shown under the captcha row */
.dshEzaiAuthCaptchaError {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--dsw-alias-state-error-primary, #ef4444);
  animation: dshEzaiShake 0.3s ease-in-out;
}

/* Error Banner */
.dshEzaiAuthErrorBanner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background-color: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: var(--dsw-alias-state-error-primary, #ef4444);
  font-size: 13px;
  line-height: 1.4;
  animation: dshEzaiShake 0.3s ease-in-out;
}
@keyframes dshEzaiShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* Submit Button (#265C5A + #98C455) */
.dshEzaiAuthSubmit {
  height: 42px;
  width: 100%;
  border-radius: 9px;
  background: linear-gradient(135deg, #265C5A 0%, #1c4543 100%);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 14px -2px rgba(38, 92, 90, 0.42);
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background 0.15s ease;
  margin-top: 4px;
}
.dshEzaiAuthSubmit:hover:not(:disabled) {
  background: linear-gradient(135deg, #2d6b68 0%, #20504e 100%);
  box-shadow: 0 6px 20px -2px rgba(38, 92, 90, 0.52);
  transform: translateY(-1px);
}
.dshEzaiAuthSubmit:active:not(:disabled) {
  transform: translateY(0);
}
.dshEzaiAuthSubmit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

/* Spinner */
.dshEzaiAuthSpinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(152, 196, 85, 0.3);
  border-top-color: #98C455;
  border-radius: 50%;
  animation: dshEzaiSpin 0.7s linear infinite;
}
@keyframes dshEzaiSpin {
  to { transform: rotate(360deg); }
}

/* Loading State Card */
.dshEzaiAuthLoadingState {
  min-height: 160px;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 36px 20px;
  border-radius: 16px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.12));
  background: var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.02));
  box-sizing: border-box;
}

/* Account Info Tab (Settings Page) */
.dshEzaiAuthAccountCard {
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 22px 24px;
  border-radius: 16px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.16));
  background: var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.025));
  box-shadow: 0 4px 20px -4px rgba(38, 92, 90, 0.08);
}

/* User Hero Banner */
.dshEzaiProfileHero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.dshEzaiProfileUser {
  display: flex;
  align-items: center;
  gap: 14px;
}
.dshEzaiAvatarWrap {
  position: relative;
  width: 52px;
  height: 52px;
  flex-shrink: 0;
}
.dshEzaiAvatarImg {
  width: 100%;
  height: 100%;
  border-radius: 15px;
  object-fit: cover;
  border: 2px solid #98C455;
  box-shadow: 0 4px 12px rgba(38, 92, 90, 0.2);
}
.dshEzaiAvatarFallback {
  width: 100%;
  height: 100%;
  border-radius: 15px;
  background: linear-gradient(135deg, #265C5A 0%, #173836 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98C455;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: -0.5px;
  box-shadow: 0 6px 14px -2px rgba(38, 92, 90, 0.35), 0 0 0 1px rgba(152, 196, 85, 0.3);
}
.dshEzaiStatusDot {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: #98C455;
  border: 2px solid var(--dsw-alias-bg-layer-1, #ffffff);
  box-shadow: 0 0 8px rgba(152, 196, 85, 0.8);
}

.dshEzaiProfileMeta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.dshEzaiNameRow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dshEzaiUserName {
  font-size: 17px;
  font-weight: 700;
  color: var(--dsw-alias-label-primary, #153332);
  letter-spacing: -0.01em;
}
.dshEzaiVerifiedChip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  color: #265C5A;
  background: rgba(152, 196, 85, 0.22);
  border: 1px solid rgba(152, 196, 85, 0.45);
  padding: 2px 7px;
  border-radius: 10px;
}
.dshEzaiLoginAccount {
  font-size: 12.5px;
  color: var(--dsw-alias-label-secondary, #587372);
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Info Grid */
.dshEzaiInfoGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.dshEzaiInfoTile {
  padding: 11px 13px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1, #ffffff);
  border: 1px solid var(--dsw-alias-border-l1, rgba(38, 92, 90, 0.1));
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: border-color 0.15s ease, transform 0.15s ease;
}
.dshEzaiInfoTile:hover {
  border-color: rgba(38, 92, 90, 0.25);
  transform: translateY(-1px);
}
.dshEzaiTileHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #7a9493);
}
.dshEzaiTileLabelWithIcon {
  display: flex;
  align-items: center;
  gap: 5px;
}
.dshEzaiTileValue {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #1c3d3c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}
.dshEzaiCopyMiniBtn {
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
  color: var(--dsw-alias-label-tertiary, #8fa7a6);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background 0.15s ease;
}
.dshEzaiCopyMiniBtn:hover {
  color: #265C5A;
  background: rgba(38, 92, 90, 0.08);
}

/* Token Card */
.dshEzaiTokenCard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px 16px;
  border-radius: 12px;
  background: linear-gradient(145deg, var(--dsw-alias-bg-layer-1, #ffffff) 0%, rgba(38, 92, 90, 0.025) 100%);
  border: 1px solid var(--dsw-alias-border-l1, rgba(38, 92, 90, 0.14));
  box-shadow: 0 2px 8px rgba(38, 92, 90, 0.04);
}
.dshEzaiTokenHead {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.dshEzaiTokenLabel {
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, #234746);
  display: flex;
  align-items: center;
  gap: 6px;
}
.dshEzaiWeeklyTag {
  font-size: 11px;
  font-weight: 500;
  color: #265C5A;
  background: rgba(38, 92, 90, 0.08);
  border: 1px solid rgba(152, 196, 85, 0.25);
  padding: 1px 6px;
  border-radius: 4px;
}
.dshEzaiPeriodTag {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
}
.dshEzaiPeriodTag.offPeak {
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.09);
  border: 1px solid rgba(46, 125, 50, 0.28);
}
.dshEzaiPeriodTag.peak {
  color: #c25e00;
  background: rgba(230, 110, 0, 0.08);
  border: 1px solid rgba(230, 110, 0, 0.25);
}
.dshEzaiPeriodHint {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary, #7a9493);
  margin-top: 6px;
  line-height: 1.4;
}
.dshEzaiTokenVal {
  font-size: 13px;
  font-weight: 700;
  color: #265C5A;
  background: rgba(38, 92, 90, 0.08);
  padding: 2px 8px;
  border-radius: 8px;
}
.dshEzaiProgressBar {
  height: 8px;
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-3, rgba(38, 92, 90, 0.08));
  overflow: hidden;
}
.dshEzaiProgressFill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #265C5A 0%, #98C455 100%);
  transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 0 8px rgba(152, 196, 85, 0.5);
}
.dshEzaiTokenFoot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary, #587372);
}

/* Logout Button */
.dshEzaiLogoutActionBtn {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(239, 68, 68, 0.25));
  background: transparent;
  color: var(--dsw-alias-label-secondary, #587372);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.15s ease;
}
.dshEzaiLogoutActionBtn:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.4);
}

/* ==========================================================
 * Strict Model Selection & Settings Lock:
 * Hide Model Picker in Composer & Models Section in Settings
 * ========================================================== */

/* 1. Hide Model Selection Trigger and Menus in Conversation Composer */
[class*="ModelSelect_root"],
[class*="ModelSelect_trigger"],
[class*="ModelSelect_menu"],
[class*="ModelSelect_cell"],
[data-slot="conversation.input.model"] {
  display: none !important;
}

/* 2. Hide Models Section from Settings Left Nav Rail */
button[class*="SettingsRoot_navCell"]:has(svg path[d*="M12.0997 8.54554"]),
button[class*="navCell"]:has(svg path[d*="M12.0997 8.54554"]) {
  display: none !important;
}

/* Fallback class */
.dshHideModelsNav {
  display: none !important;
}

/* 3. Logged out composer card & textarea */
[data-composer-card][data-ezai-logged-out="true"] {
  cursor: pointer !important;
}
[data-composer-card][data-ezai-logged-out="true"] textarea {
  cursor: pointer !important;
  pointer-events: none !important;
}
`
  document.head.appendChild(tag)
}
