window.__ModuleLoader__.load({ id: "dsh-ezai-auth", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/EzaiAccountTab.tsx
var import_react2 = require("react");

// src/client/DepartmentNoticeModal.tsx
var import_react = require("react");
var import_client = require("react-dom/client");

// src/client/styles.ts
var STYLE_TAG = "dsh-ezai-auth/style.css";
function injectCss() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG)}]`) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-ezai-auth";
  tag.dataset.pluginCss = STYLE_TAG;
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
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #265C5A 0%, #19403e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #98C455;
  box-shadow: 0 8px 18px -4px rgba(38, 92, 90, 0.4), 0 0 0 1px rgba(152, 196, 85, 0.35);
  margin-bottom: 14px;
}
.dshEzaiAuthLogoImg {
  width: 34px;
  height: 34px;
  object-fit: contain;
  display: block;
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

/* Remember Password Row */
.dshEzaiAuthRememberRow {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 6px 0 14px 0;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--dsw-alias-label-secondary, #587372);
  transition: color 0.15s ease;
}
.dshEzaiAuthRememberRow:hover {
  color: var(--dsw-alias-label-primary, #153332);
}
.dshEzaiAuthCheckbox {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--dsw-alias-border-secondary, #b4c7c6);
  border-radius: 4px;
  outline: none;
  margin: 0 8px 0 0;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  background-color: var(--dsw-alias-bg-surface-elevated, #ffffff);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dshEzaiAuthCheckbox:hover {
  border-color: #265C5A;
}
.dshEzaiAuthCheckbox:checked {
  background-color: #265C5A;
  border-color: #265C5A;
}
.dshEzaiAuthCheckbox:checked::after {
  content: '';
  width: 4px;
  height: 8px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  position: absolute;
  top: 1px;
}
.dshEzaiAuthCheckbox:focus-visible {
  box-shadow: 0 0 0 2px rgba(152, 196, 85, 0.4);
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
`;
  document.head.appendChild(tag);
}

// src/client/DepartmentNoticeModal.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var NOTICE_MODAL_MOUNT_ID = "dsh-ezai-auth-department-notice-modal";
function DepartmentNoticeModal({ title, message, onClose }) {
  const [visible, setVisible] = (0, import_react.useState)(false);
  (0, import_react.useEffect)(() => {
    injectCss();
    const timer = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(timer);
  }, []);
  const handleClose = (0, import_react.useCallback)(() => {
    setVisible(false);
    setTimeout(() => onClose(), 220);
  }, [onClose]);
  (0, import_react.useEffect)(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);
  const defaultMsg = "\u4EB2\u7231\u7684\u540C\u4E8B\uFF0C\u60A8\u597D\uFF1A\n\n\u5341\u5206\u611F\u8C22\u60A8\u5BF9 EZAI \u684C\u9762\u667A\u80FD\u52A9\u624B\u7684\u5173\u6CE8\u4E0E\u652F\u6301\uFF01\n\u76EE\u524D\u672C\u4F53\u9A8C\u7248\u672C\u4E13\u4E3A\u3010\u805A\u670D\u4E2D\u5FC3\u3011\u8FDB\u884C\u6DF1\u5EA6\u4E1A\u52A1\u5B9A\u5236\u4E0E\u4E13\u9879\u5B9A\u5411\u5185\u6D4B\uFF0C\u6682\u672A\u9762\u5411\u5176\u4ED6\u90E8\u95E8\u5F00\u653E\u4F7F\u7528\u3002\n\n\u7814\u53D1\u56E2\u961F\u6B63\u5728\u7D27\u9523\u5BC6\u9F13\u5730\u63A8\u8FDB\u8DE8\u4E1A\u52A1\u7EBF\u7684\u9002\u914D\u4E0E\u529F\u80FD\u5347\u7EA7\uFF0C\u540E\u7EED\u66F4\u591A\u90E8\u95E8\u7684\u5F00\u653E\u5DF2\u5728\u7D27\u5BC6\u6392\u671F\u4E2D\uFF0C\u656C\u8BF7\u671F\u5F85\uFF01\n\n\u4E3A\u4FDD\u969C\u60A8\u7684\u6570\u636E\u5B89\u5168\u4E0E\u7CFB\u7EDF\u72B6\u6001\u4E00\u81F4\uFF0C\u7CFB\u7EDF\u5DF2\u4E3A\u60A8\u5B89\u5168\u9000\u51FA\u767B\u5F55\u5E76\u5DF2\u6E05\u9664\u672C\u5730\u914D\u7F6E\u3002\u611F\u8C22\u60A8\u7684\u7406\u89E3\u4E0E\u6E29\u6696\u5305\u5BB9\uFF01";
  const displayMsg = message || defaultMsg;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: "dshEzaiAuthModalBackdrop",
      "data-visible": visible ? "true" : "false",
      style: { zIndex: 1000001 },
      onClick: handleClose,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          className: "dshEzaiAuthModal",
          style: {
            width: "min(460px, 92vw)",
            padding: "28px 26px 24px",
            textAlign: "center"
          },
          onClick: (e) => e.stopPropagation(),
          role: "alertdialog",
          "aria-modal": "true",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "dshEzaiAuthCloseBtn",
                onClick: handleClose,
                "aria-label": "\u5173\u95ED",
                title: "\u5173\u95ED",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                ] })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(135deg, rgba(38, 92, 90, 0.12) 0%, rgba(152, 196, 85, 0.18) 100%)",
                  border: "1px solid rgba(152, 196, 85, 0.35)",
                  boxShadow: "0 8px 18px -4px rgba(38, 92, 90, 0.15)",
                  color: "#265C5A"
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "26", height: "26", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
                ] })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "h3",
              {
                style: {
                  margin: "0 0 8px",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--dsw-alias-label-primary, #153332)",
                  letterSpacing: "-0.01em"
                },
                children: title || "\u4F53\u9A8C\u9636\u6BB5\u6E29\u99A8\u63D0\u793A"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "div",
              {
                style: {
                  margin: "14px 0 20px",
                  padding: "16px 18px",
                  borderRadius: "12px",
                  backgroundColor: "var(--dsw-alias-bg-layer-2, rgba(38, 92, 90, 0.035))",
                  border: "1px solid var(--dsw-alias-border-l2, rgba(38, 92, 90, 0.12))",
                  fontSize: "13.5px",
                  lineHeight: "1.65",
                  color: "var(--dsw-alias-label-secondary, #436160)",
                  textAlign: "left",
                  whiteSpace: "pre-line"
                },
                children: displayMsg
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                className: "dshEzaiAuthSubmit",
                style: { marginTop: "0", height: "42px", fontSize: "14.5px" },
                onClick: handleClose,
                children: "\u6211\u77E5\u9053\u4E86"
              }
            )
          ]
        }
      )
    }
  );
}
function showDepartmentNoticeModal(message, onConfirm, title) {
  const existing = document.getElementById(NOTICE_MODAL_MOUNT_ID);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
  let root;
  let container;
  const dispose = () => {
    if (root !== void 0) {
      root.unmount();
      root = void 0;
    }
    if (container !== void 0 && container.parentNode !== null) {
      container.parentNode.removeChild(container);
      container = void 0;
    }
    onConfirm?.();
  };
  container = document.createElement("div");
  container.id = NOTICE_MODAL_MOUNT_ID;
  document.body.appendChild(container);
  root = (0, import_client.createRoot)(container);
  root.render(/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DepartmentNoticeModal, { title, message, onClose: dispose }));
  return dispose;
}

// src/client/EzaiAccountTab.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
async function loadSavedCredentials() {
  try {
    const res = await fetch("/api/ezai-auth/saved-credentials", { headers: { accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      if (data.remembered && data.username && data.password) {
        return { username: data.username, password: data.password };
      }
    }
  } catch {
  }
  if (typeof window !== "undefined") {
    try {
      const local = window.localStorage.getItem("dsh_ezai_remember_creds");
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed.username === "string" && typeof parsed.password === "string") {
          return { username: parsed.username, password: parsed.password };
        }
      }
    } catch {
    }
  }
  return null;
}
function formatNumber(value) {
  return value.toLocaleString("zh-CN");
}
function parseBackendError(text) {
  try {
    const parsed = JSON.parse(text);
    const msg = parsed.message ?? parsed.error ?? parsed.msg;
    if (typeof msg === "string" && msg.trim() !== "") return msg;
  } catch {
  }
  return void 0;
}
function maskPhone(phone) {
  if (!phone) return "\u2014";
  const clean = phone.trim();
  if (clean.length === 11) {
    return `${clean.slice(0, 3)} **** ${clean.slice(7)}`;
  }
  if (clean.length > 7) {
    return `${clean.slice(0, 3)} **** ${clean.slice(-4)}`;
  }
  return clean;
}
function EzaiAccountTab({ t, onLogin, hideHeader = false }) {
  const [captcha, setCaptcha] = (0, import_react2.useState)(void 0);
  const [captchaLoading, setCaptchaLoading] = (0, import_react2.useState)(false);
  const [form, setForm] = (0, import_react2.useState)({ username: "", password: "", captcha: "" });
  const [account, setAccount] = (0, import_react2.useState)(void 0);
  const [checkingSession, setCheckingSession] = (0, import_react2.useState)(true);
  const [loading, setLoading] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(void 0);
  const [captchaError, setCaptchaError] = (0, import_react2.useState)(void 0);
  const [rememberPassword, setRememberPassword] = (0, import_react2.useState)(true);
  const captchaInputRef = (0, import_react2.useRef)(null);
  const fetchAccount = (0, import_react2.useCallback)(async () => {
    try {
      const response = await fetch("/api/ezai-auth/account", { headers: { accept: "application/json" } });
      if (response.status === 401 || response.status === 403) {
        setAccount(void 0);
        return;
      }
      if (!response.ok) {
        const text = await response.text();
        const backend = parseBackendError(text);
        throw new Error(backend ?? `account request failed (${response.status})`);
      }
      const payload = await response.json();
      setAccount(payload);
    } catch {
      setAccount(void 0);
    }
  }, []);
  const fetchCaptcha = (0, import_react2.useCallback)(async () => {
    setCaptchaLoading(true);
    try {
      const response = await fetch("/api/ezai-auth/captcha", { headers: { accept: "application/json" } });
      if (!response.ok) {
        const text = await response.text();
        const backend = parseBackendError(text);
        throw new Error(backend ?? `captcha request failed (${response.status})`);
      }
      const payload = await response.json();
      setCaptcha(payload);
      setCaptchaError(void 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t("networkError"));
      setCaptcha(void 0);
    } finally {
      setCaptchaLoading(false);
    }
  }, [t]);
  (0, import_react2.useEffect)(() => {
    let active = true;
    async function init() {
      let isLoggedIn = false;
      try {
        const response = await fetch("/api/ezai-auth/account", { headers: { accept: "application/json" } });
        if (response.status === 403) {
          const payload = await response.json().catch(() => ({}));
          if (payload.departmentDisallowed) {
            if (active) {
              setAccount(void 0);
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
              }
              showDepartmentNoticeModal(payload.message, void 0, payload.title);
              void fetchCaptcha();
            }
            return;
          }
        }
        if (response.status === 401) {
          if (active) {
            setAccount(void 0);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
            }
            void fetchCaptcha();
          }
          return;
        }
        if (response.ok) {
          const payload = await response.json();
          if (active) {
            isLoggedIn = true;
            setAccount(payload);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: true, user: payload.user } }));
            }
          }
        } else {
          if (active) {
            setAccount(void 0);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
            }
            void fetchCaptcha();
          }
        }
      } catch {
        if (active) {
          setAccount(void 0);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
          }
          void fetchCaptcha();
        }
      } finally {
        if (active) {
          setCheckingSession(false);
          if (!isLoggedIn) {
            const saved = await loadSavedCredentials();
            if (active && saved) {
              setForm((prev) => ({ ...prev, username: saved.username, password: saved.password }));
              setRememberPassword(true);
              setTimeout(() => captchaInputRef.current?.focus(), 150);
            }
          }
        }
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, [fetchCaptcha]);
  const handleLogin = async (event) => {
    event.preventDefault();
    if (captcha === void 0) return;
    setLoading(true);
    setError(void 0);
    setCaptchaError(void 0);
    try {
      const response = await fetch("/api/ezai-auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          username: form.username,
          password: form.password,
          captcha: form.captcha,
          cookies: captcha.cookies
        })
      });
      const payload = await response.json();
      if (response.status === 403 || payload.departmentDisallowed) {
        showDepartmentNoticeModal(payload.message, void 0, payload.title);
        setForm((previous) => ({ ...previous, password: "", captcha: "" }));
        void fetchCaptcha();
        return;
      }
      if (!response.ok || payload.status_code !== 200 || payload.user === void 0) {
        throw new Error(payload.message ?? payload.error ?? t("networkError"));
      }
      try {
        await fetch("/api/ezai-auth/saved-credentials", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            remember: rememberPassword,
            username: form.username,
            password: form.password
          })
        });
      } catch {
      }
      if (typeof window !== "undefined") {
        try {
          if (rememberPassword) {
            window.localStorage.setItem("dsh_ezai_remember_creds", JSON.stringify({ username: form.username, password: form.password }));
          } else {
            window.localStorage.removeItem("dsh_ezai_remember_creds");
          }
        } catch {
        }
      }
      await fetchAccount();
      if (!rememberPassword) {
        setForm({ username: "", password: "", captcha: "" });
      } else {
        setForm((previous) => ({ ...previous, captcha: "" }));
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: true, user: payload.user } }));
      }
      onLogin?.(payload.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/验证码/.test(message)) {
        setCaptchaError(message);
      } else {
        setError(t("loginFailed").replace("{{message}}", message));
      }
      setForm((previous) => ({ ...previous, captcha: "" }));
      void fetchCaptcha();
    } finally {
      setLoading(false);
    }
  };
  const handleLogout = async () => {
    try {
      await fetch("/api/ezai-auth/logout", { method: "POST" });
      setAccount(void 0);
      void fetchCaptcha();
      const saved = await loadSavedCredentials();
      if (saved) {
        setForm({ username: saved.username, password: saved.password, captcha: "" });
        setRememberPassword(true);
        setTimeout(() => captchaInputRef.current?.focus(), 150);
      } else {
        setForm({ username: "", password: "", captcha: "" });
      }
      if (typeof window !== "undefined") {
        window.__EZAI_LOGGED_IN__ = false;
        window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || t("networkError"));
    }
  };
  const updateField = (field) => (event) => {
    if (error !== void 0) setError(void 0);
    if (captchaError !== void 0) setCaptchaError(void 0);
    setForm((previous) => ({ ...previous, [field]: event.target.value }));
  };
  const [copiedKey, setCopiedKey] = (0, import_react2.useState)(void 0);
  const copyToClipboard = (text, key) => {
    if (!text) return;
    try {
      void navigator.clipboard?.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(void 0), 1500);
    } catch {
    }
  };
  if (checkingSession) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthLoadingState", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiAuthSpinner", style: { width: "24px", height: "24px", borderWidth: "2.5px" } }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: "13px", color: "var(--dsw-alias-label-secondary, #587372)" }, children: t("checkingSession") })
    ] });
  }
  if (account !== void 0) {
    const quota = account.tokenUsage.quota;
    const used = account.tokenUsage.used;
    const percent = quota > 0 ? Math.min(100, Math.round(used / quota * 100)) : 0;
    const user = account.user;
    const personalInfo = account.personalInfo;
    const displayName = personalInfo?.name || user.name || user.surname_lable || user.login_name;
    const avatarInitial = (personalInfo?.name ? personalInfo.name.slice(-2) : void 0) || user.surname_lable || (user.name ? user.name.slice(-2) : user.login_name.charAt(0).toUpperCase());
    const avatarUrl = personalInfo?.avatar || user.avatar;
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthAccountCard", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiProfileHero", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiProfileUser", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAvatarWrap", children: [
            avatarUrl ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("img", { className: "dshEzaiAvatarImg", src: avatarUrl, alt: displayName }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiAvatarFallback", children: avatarInitial }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiStatusDot", title: "Active" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiProfileMeta", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiNameRow", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiUserName", children: displayName }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dshEzaiVerifiedChip", children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "11", height: "11", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("polyline", { points: "20 6 9 17 4 12" }) }),
                t("verifiedUser")
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiLoginAccount", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#7a9493" }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }),
                /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("polyline", { points: "22,6 12,13 2,6" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: user.login_name })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: "dshEzaiLogoutActionBtn", onClick: handleLogout, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("polyline", { points: "16 17 21 12 16 7" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "21", y1: "12", x2: "9", y2: "12" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("logout") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiInfoGrid", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiInfoTile", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileHeader", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTileLabelWithIcon", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#265C5A" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("workPhone") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileValue", title: personalInfo?.tel_phone || personalInfo?.user_phone || user.user_phone, children: maskPhone(personalInfo?.tel_phone || personalInfo?.user_phone || user.user_phone) })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiInfoTile", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileHeader", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTileLabelWithIcon", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#265C5A" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2", ry: "2" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("post") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileValue", title: personalInfo?.post || "\u2014", children: personalInfo?.post || "\u2014" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiInfoTile", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileHeader", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTileLabelWithIcon", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#265C5A" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "9", cy: "7", r: "4" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("department") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileValue", title: personalInfo?.department || "\u2014", children: personalInfo?.department || "\u2014" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiInfoTile", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileHeader", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTileLabelWithIcon", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#265C5A" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "10", r: "3" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("location") })
          ] }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiTileValue", title: personalInfo?.location || "\u2014", children: personalInfo?.location || "\u2014" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTokenCard", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTokenHead", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTokenLabel", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { color: "#265C5A" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("polygon", { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2" }) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("tokenUsage") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiWeeklyTag", children: t("weeklyResetHint") }),
            account.tokenUsage?.isPeakHours !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: `dshEzaiPeriodTag ${account.tokenUsage.isPeakHours ? "peak" : "offPeak"}`, children: account.tokenUsage.isPeakHours ? t("peakPeriod") : t("offPeakPeriod") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dshEzaiTokenVal", children: [
            percent,
            "%"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiProgressBar", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiProgressFill", style: { width: `${percent}%` } }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiTokenFoot", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            t("tokenUsed"),
            ": ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: formatNumber(used) })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { children: [
            t("tokenQuota"),
            ": ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: formatNumber(quota) }),
            " ",
            t("tokenUnit")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiPeriodHint", children: t("offPeakDiscountHint") })
      ] }),
      account.warning && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { fontSize: "12px", color: "#7a9493", display: "flex", alignItems: "center", gap: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: account.warning })
      ] })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("form", { className: "dshEzaiAuthForm", onSubmit: handleLogin, children: [
    !hideHeader && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { marginBottom: "8px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h3", { className: "dshEzaiAuthTitle", style: { fontSize: "17px" }, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dshEzaiAuthSubtitle", children: t("intro") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dshEzaiAuthField", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthLabel", children: t("username") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthInputWrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthInputIcon", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "7", r: "4" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            className: "dshEzaiAuthInput",
            type: "text",
            value: form.username,
            onChange: updateField("username"),
            placeholder: t("usernamePlaceholder"),
            autoComplete: "username",
            disabled: loading,
            required: true
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dshEzaiAuthField", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthLabel", children: t("password") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthInputWrap", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthInputIcon", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "3", y: "11", width: "18", height: "11", rx: "2", ry: "2" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            className: "dshEzaiAuthInput",
            type: "password",
            value: form.password,
            onChange: updateField("password"),
            placeholder: t("passwordPlaceholder"),
            autoComplete: "current-password",
            disabled: loading,
            required: true
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dshEzaiAuthField", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthLabel", children: t("captcha") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthCaptchaRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthInputWrap dshEzaiAuthCaptchaWrap", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthInputIcon", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              ref: captchaInputRef,
              className: "dshEzaiAuthInput",
              type: "text",
              value: form.captcha,
              onChange: updateField("captcha"),
              placeholder: t("captchaPlaceholder"),
              disabled: loading,
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "div",
          {
            className: "dshEzaiAuthCaptchaBox",
            onClick: fetchCaptcha,
            title: t("refreshHint"),
            role: "button",
            tabIndex: 0,
            children: captchaLoading ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "dshEzaiAuthCaptchaLoading", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "dshEzaiAuthSpinner", style: { width: "12px", height: "12px", borderColor: "rgba(38,92,90,0.25)", borderTopColor: "#98C455" } }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("refreshCaptcha") })
            ] }) : captcha !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "img",
              {
                className: "dshEzaiAuthCaptchaImg",
                src: captcha.imageBase64,
                alt: t("captcha")
              }
            ) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthCaptchaLoading", children: t("refreshCaptcha") })
          }
        )
      ] }),
      captchaError !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthCaptchaError", role: "alert", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: captchaError })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { className: "dshEzaiAuthRememberRow", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "checkbox",
          className: "dshEzaiAuthCheckbox",
          checked: rememberPassword,
          onChange: (e) => setRememberPassword(e.target.checked),
          disabled: loading
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: t("rememberPassword") })
    ] }),
    error !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dshEzaiAuthErrorBanner", role: "alert", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", style: { flexShrink: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "12", cy: "12", r: "10" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: error })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "submit",
        className: "dshEzaiAuthSubmit",
        disabled: loading || captcha === void 0,
        children: [
          loading && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dshEzaiAuthSpinner" }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: loading ? t("loggingIn") : t("login") })
        ]
      }
    )
  ] });
}

// src/client/EzaiLoginModal.tsx
var import_react3 = require("react");
var import_client2 = require("react-dom/client");

// src/client/locales.ts
var NS = "ezai-auth";
var zh = {
  "tabTitle": "EZAI \u8D26\u6237",
  "title": "EZAI \u8D26\u6237",
  "loginTitle": "EZAI \u5E73\u53F0\u767B\u5F55",
  "intro": "\u767B\u5F55 EZAI \u5E73\u53F0\u4EE5\u67E5\u770B\u8D26\u6237\u4FE1\u606F\u548C Token \u7528\u91CF\u3002",
  "loginSubtitle": "\u767B\u5F55\u4EE5\u540C\u6B65\u60A8\u7684\u8D26\u6237\u4FE1\u606F\u53CA Token \u989D\u5EA6",
  "username": "\u90AE\u7BB1 / \u8D26\u53F7",
  "usernamePlaceholder": "\u8BF7\u8F93\u5165\u90AE\u7BB1\u6216\u7528\u6237\u540D",
  "password": "\u5BC6\u7801",
  "passwordPlaceholder": "\u8BF7\u8F93\u5165\u5BC6\u7801",
  "captcha": "\u9A8C\u8BC1\u7801",
  "captchaPlaceholder": "\u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801",
  "rememberPassword": "\u8BB0\u4F4F\u5BC6\u7801",
  "refreshCaptcha": "\u5237\u65B0\u9A8C\u8BC1\u7801",
  "refreshHint": "\u70B9\u51FB\u6362\u4E00\u5F20",
  "login": "\u7ACB\u5373\u767B\u5F55",
  "loggingIn": "\u767B\u5F55\u4E2D\u2026",
  "logout": "\u9000\u51FA\u767B\u5F55",
  "loginFailed": "\u767B\u5F55\u5931\u8D25\uFF1A{{message}}",
  "networkError": "\u7F51\u7EDC\u8FDE\u63A5\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5",
  "notLoggedIn": "\u672A\u767B\u5F55",
  "tokenUsage": "Token \u989D\u5EA6\u7528\u91CF",
  "tokenUsed": "\u5DF2\u6D88\u8017",
  "tokenQuota": "\u603B\u989D\u5EA6",
  "tokenUnit": "Tokens",
  "close": "\u5173\u95ED",
  "name": "\u59D3\u540D",
  "post": "\u5C97\u4F4D",
  "department": "\u6240\u5C5E\u90E8\u95E8",
  "location": "\u5DE5\u4F5C\u5730\u70B9",
  "workPhone": "\u529E\u516C\u7535\u8BDD",
  "loginAccount": "\u767B\u5F55\u8D26\u53F7",
  "email": "\u8054\u7CFB\u90AE\u7BB1",
  "phone": "\u8054\u7CFB\u624B\u673A",
  "userId": "\u7528\u6237\u7F16\u53F7",
  "verifiedUser": "EZAI \u8BA4\u8BC1\u6210\u5458",
  "copied": "\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F",
  "checkingSession": "\u6B63\u5728\u52A0\u8F7D\u8D26\u6237\u4FE1\u606F\u2026",
  "weeklyResetHint": "\u6BCF\u5468\u65E5 24:00 \u5237\u65B0",
  "loginRequiredHint": "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528",
  "peakPeriod": "\u9AD8\u5CF0\u65F6\u6BB5 1.0x",
  "offPeakPeriod": "\u7A7A\u95F2\u65F6\u6BB5 0.5x",
  "offPeakDiscountHint": "\u7A7A\u95F2\u65F6\u6BB5\u4EF7\u683C\u4E3A\u9AD8\u5CF0\u65F6\u6BB5\u4EF7\u683C\u7684\u4E00\u534A\uFF08\u7CFB\u6570 0.5\uFF09\u3002\u9AD8\u5CF0\u65F6\u6BB5\u4E3A\u5317\u4EAC\u65F6\u95F4\u5468\u4E00\u81F3\u5468\u4E94 9:00 - 12:00\u300114:00 - 18:00\uFF0C\u5176\u4F59\u4E3A\u7A7A\u95F2\u65F6\u6BB5\u3002"
};
var en = {
  "tabTitle": "EZAI Account",
  "title": "EZAI Account",
  "loginTitle": "EZAI Login",
  "intro": "Sign in to the EZAI platform to view account info and token usage.",
  "loginSubtitle": "Sign in to access your account and token quota",
  "username": "Email / Account",
  "usernamePlaceholder": "Enter email or username",
  "password": "Password",
  "passwordPlaceholder": "Enter password",
  "captcha": "Captcha",
  "captchaPlaceholder": "Enter captcha",
  "rememberPassword": "Remember password",
  "refreshCaptcha": "Refresh captcha",
  "refreshHint": "Click to refresh",
  "login": "Sign In",
  "loggingIn": "Signing in\u2026",
  "logout": "Sign Out",
  "loginFailed": "Login failed: {{message}}",
  "networkError": "Network error, please retry",
  "notLoggedIn": "Not signed in",
  "tokenUsage": "Token Quota Usage",
  "tokenUsed": "Used",
  "tokenQuota": "Quota",
  "tokenUnit": "Tokens",
  "close": "Close",
  "name": "Name",
  "post": "Job Title",
  "department": "Department",
  "location": "Location",
  "workPhone": "Work Phone",
  "loginAccount": "Login Account",
  "email": "Email",
  "phone": "Phone",
  "userId": "User ID",
  "verifiedUser": "EZAI Verified",
  "copied": "Copied to clipboard",
  "checkingSession": "Loading account information\u2026",
  "weeklyResetHint": "Resets Sun 24:00",
  "loginRequiredHint": "Please log in to your account first",
  "peakPeriod": "Peak Hours 1.0x",
  "offPeakPeriod": "Off-Peak 0.5x",
  "offPeakDiscountHint": "Off-peak hours billed at half price (0.5x coefficient). Peak hours: Mon-Fri 9:00 - 12:00, 14:00 - 18:00 (Beijing Time); all other times are off-peak."
};

// src/client/artwork.ts
var EZAI_MARK_DATA_URI = "data:image/png;base64,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";

// src/client/EzaiLoginModal.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var MODAL_MOUNT_ID = "dsh-ezai-auth-login-modal";
function EzaiLoginModal({ locale, onClose }) {
  const [visible, setVisible] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    injectCss();
    const timer = setTimeout(() => setVisible(true), 16);
    return () => clearTimeout(timer);
  }, []);
  const handleClose = (0, import_react3.useCallback)(() => {
    setVisible(false);
    setTimeout(() => onClose(), 220);
  }, [onClose]);
  const handleLogin = (0, import_react3.useCallback)(() => {
    handleClose();
  }, [handleClose]);
  (0, import_react3.useEffect)(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);
  const dictionary = locale === "zh" ? zh : en;
  const t = (key) => dictionary[key];
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      className: "dshEzaiAuthModalBackdrop",
      "data-visible": visible ? "true" : "false",
      onClick: handleClose,
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "div",
        {
          className: "dshEzaiAuthModal",
          onClick: (event) => event.stopPropagation(),
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": "dsh-ezai-auth-login-title",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "dshEzaiAuthCloseBtn",
                onClick: handleClose,
                "aria-label": t("close"),
                title: t("close"),
                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
                  /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
                ] })
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dshEzaiAuthHeader", children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dshEzaiAuthLogo", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "img",
                {
                  src: EZAI_MARK_DATA_URI,
                  alt: "EZAI Logo",
                  className: "dshEzaiAuthLogoImg"
                }
              ) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { id: "dsh-ezai-auth-login-title", className: "dshEzaiAuthTitle", children: t("loginTitle") }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dshEzaiAuthSubtitle", children: t("loginSubtitle") })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(EzaiAccountTab, { t, onLogin: handleLogin, hideHeader: true })
          ]
        }
      )
    }
  );
}
function showEzaiLoginModal(locale) {
  let root;
  let container;
  const dispose = () => {
    if (root !== void 0) {
      root.unmount();
      root = void 0;
    }
    if (container !== void 0 && container.parentNode !== null) {
      container.parentNode.removeChild(container);
      container = void 0;
    }
  };
  container = document.createElement("div");
  container.id = MODAL_MOUNT_ID;
  document.body.appendChild(container);
  root = (0, import_client2.createRoot)(container);
  root.render(/* @__PURE__ */ (0, import_jsx_runtime3.jsx)(EzaiLoginModal, { locale, onClose: dispose }));
  return dispose;
}

// src/client/index.tsx
var inject = ["slots", "locale"];
var isEzaiLoggedIn = false;
var conversationService = null;
var authBlockedSessions = /* @__PURE__ */ new Set();
function unlockAllSessions() {
  if (!conversationService || !conversationService.blocks) return;
  for (const sessionId of authBlockedSessions) {
    try {
      conversationService.blocks.set(sessionId, void 0);
    } catch {
    }
  }
  authBlockedSessions.clear();
  try {
    const stores = conversationService.blocks.stores;
    if (stores instanceof Map) {
      for (const [sessionId, store] of stores.entries()) {
        const snapshot = store?.getSnapshot?.();
        if (snapshot && typeof snapshot.reason === "string" && (snapshot.reason.includes("\u767B\u5F55") || snapshot.reason.toLowerCase().includes("log in") || snapshot.reason.includes("\u6A21\u578B") || snapshot.reason.toLowerCase().includes("model"))) {
          conversationService.blocks.set(sessionId, void 0);
        }
      }
    }
  } catch {
  }
}
function lockAllSessions(ctx) {
  if (!conversationService || !conversationService.blocks) return;
  const isZh = getActiveLocale(ctx) === "zh";
  const prompt = isZh ? "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528" : "Please log in to your account first";
  try {
    const stores = conversationService.blocks.stores;
    if (stores instanceof Map) {
      for (const [sessionId] of stores.entries()) {
        authBlockedSessions.add(sessionId);
        try {
          conversationService.blocks.set(sessionId, { reason: prompt });
        } catch {
        }
      }
    }
  } catch {
  }
}
function getActiveLocale(ctx) {
  const snapshot = ctx.locale.getSnapshot?.();
  const active = typeof snapshot?.active === "string" ? snapshot.active : "en";
  return active === "zh" ? "zh" : "en";
}
function installModelLockObserver(ctx) {
  if (typeof document === "undefined") return;
  const cleanUI2 = () => {
    const isZh = getActiveLocale(ctx) === "zh";
    const loginPrompt = isZh ? "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528" : "Please log in to your account first";
    const navButtons = document.querySelectorAll('button[class*="navCell"], button[class*="SettingsRoot_navCell"]');
    for (const btn of navButtons) {
      const text = btn.textContent?.trim();
      if (text === "\u6A21\u578B" || text === "Models") {
        btn.style.display = "none";
        btn.classList.add("dshHideModelsNav");
        if (btn.getAttribute("aria-current") === "true" || btn.classList.contains("active") || btn.className.includes("active")) {
          const sibling = btn.parentElement?.querySelector('button[class*="navCell"]:not([style*="display: none"]):not(.dshHideModelsNav)');
          if (sibling && sibling !== btn) {
            sibling.click();
          }
        }
      }
    }
    const modelTriggers = document.querySelectorAll('[class*="ModelSelect_root"], [class*="ModelSelect_trigger"], [data-slot="conversation.input.model"]');
    for (const el of modelTriggers) {
      el.style.display = "none";
    }
    const slashOptions = document.querySelectorAll('button[role="option"]');
    for (const opt of slashOptions) {
      const nameEl = opt.querySelector('span[class*="itemName"]');
      if (nameEl && nameEl.textContent?.trim() === "model") {
        opt.style.display = "none";
      }
    }
    const headings = document.querySelectorAll("h2");
    for (const heading of headings) {
      const headingText = heading.textContent?.trim();
      if (headingText === "\u6DFB\u52A0\u4E00\u4E2A API Key \u5F00\u59CB\u4F7F\u7528" || headingText === "Add an API key to get started") {
        const dialog = heading.closest('div[role="dialog"]') || heading.closest('div[class*="dialog"]');
        if (dialog) {
          const presentationRoot = dialog.closest('div[role="presentation"]');
          if (presentationRoot && !presentationRoot.dataset.dshDismissed) {
            presentationRoot.dataset.dshDismissed = "true";
            presentationRoot.style.display = "none";
            const buttons = dialog.querySelectorAll("button");
            for (const btn of buttons) {
              const bText = btn.textContent?.trim();
              if (bText === "\u7A0D\u540E\u914D\u7F6E" || bText === "Later" || bText === "Configure later") {
                btn.click();
                break;
              }
            }
            const appRoot = document.getElementById("root");
            if (appRoot) {
              appRoot.inert = false;
              appRoot.removeAttribute("inert");
            }
          }
        }
      }
    }
    const textareas = document.querySelectorAll("textarea");
    const composerCards = document.querySelectorAll("[data-composer-card]");
    if (!isEzaiLoggedIn) {
      if (typeof window !== "undefined") {
        window.__EZAI_LOGGED_IN__ = false;
      }
      for (const ta of textareas) {
        ta.placeholder = loginPrompt;
        ta.readOnly = true;
        ta.dataset.ezaiLoggedOut = "true";
      }
      for (const card of composerCards) {
        card.setAttribute("data-ezai-logged-out", "true");
        if (!card._ezaiClickAttached) {
          ;
          card._ezaiClickAttached = true;
          card.addEventListener("click", (e) => {
            if (!isEzaiLoggedIn) {
              e.preventDefault();
              e.stopPropagation();
              showEzaiLoginModal(getActiveLocale(ctx));
            }
          }, true);
        }
      }
      const toasts = document.querySelectorAll('div[role="alert"], div[class*="Toast_toast"]');
      for (const toast of toasts) {
        const text = toast.textContent || "";
        if (text.includes("no adapter serves provider") || text.includes("model-unavailable") || text.includes("\u9009\u62E9\u6A21\u578B")) {
          toast.style.display = "none";
        }
      }
    } else {
      if (typeof window !== "undefined") {
        window.__EZAI_LOGGED_IN__ = true;
      }
      for (const ta of textareas) {
        delete ta.dataset.ezaiLoggedOut;
        if (ta.readOnly) {
          ta.readOnly = false;
        }
        if (ta.disabled) {
          ta.disabled = false;
          ta.removeAttribute("disabled");
        }
        if (ta.placeholder === "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528" || ta.placeholder === "Please log in to your account first") {
          ta.placeholder = isZh ? "\u8F93\u5165\u6D88\u606F\u6216\u4F7F\u7528 / \u8C03\u7528\u547D\u4EE4..." : "Send a message or type / for commands...";
        }
      }
      for (const card of composerCards) {
        card.removeAttribute("data-ezai-logged-out");
      }
    }
    const badges = document.querySelectorAll('span[class*="previewBadge"], span[class*="HeroShell_previewBadge"]');
    for (const badge of badges) {
      const text = badge.textContent?.trim();
      if (text === "\u9884\u89C8\u7248" || text === "Preview" || text === "\u7248\u672C 2.0.2" || text === "\u7248\u672C 2.0.3" || text === "\u7248\u672C 2.0.4") {
        badge.textContent = "\u7248\u672C 2.0.5";
      }
    }
  };
  window.addEventListener("ezai-auth:state-change", (event) => {
    const nextLoggedIn = Boolean(event.detail?.loggedIn);
    isEzaiLoggedIn = nextLoggedIn;
    if (typeof window !== "undefined") {
      window.__EZAI_LOGGED_IN__ = isEzaiLoggedIn;
    }
    if (nextLoggedIn) {
      unlockAllSessions();
      setTimeout(() => {
        const ta = document.querySelector("textarea:not([disabled])");
        if (ta && document.activeElement !== ta) {
          ta.focus();
        }
      }, 50);
    } else {
      lockAllSessions(ctx);
    }
    cleanUI2();
  });
  cleanUI2();
  const observer = new MutationObserver(() => {
    cleanUI2();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
function apply(ctx) {
  injectCss();
  installModelLockObserver(ctx);
  ctx.inject(["commandUi"], (scope) => {
    const commandUi = scope.get("commandUi");
    if (!commandUi) return;
    const origCandidates = commandUi.candidates?.bind(commandUi);
    if (origCandidates) {
      commandUi.candidates = async (...args) => {
        const rows = await origCandidates(...args);
        if (Array.isArray(rows)) {
          return rows.filter((r) => r && r.name !== "model");
        }
        return rows;
      };
    }
    const disableModel = (contribution) => {
      if (contribution && contribution.name === "model") {
        contribution.available = () => false;
      }
    };
    if (commandUi.live?.contributions) {
      disableModel(commandUi.live.contributions.get("model"));
    }
    const origRegister = commandUi.register?.bind(commandUi);
    if (origRegister) {
      commandUi.register = (contribution) => {
        disableModel(contribution);
        return origRegister(contribution);
      };
    }
    const origDispatch = commandUi.dispatch?.bind(commandUi);
    if (origDispatch) {
      commandUi.dispatch = (pick) => {
        if (pick?.candidate?.name === "model") return;
        return origDispatch(pick);
      };
    }
  });
  ctx.inject(["conversation"], (scope) => {
    const conversation = scope.get("conversation");
    conversationService = conversation;
    if (conversation && conversation.blocks) {
      const originalSet = conversation.blocks.set.bind(conversation.blocks);
      conversation.blocks.set = (sessionId, block) => {
        if (!isEzaiLoggedIn) {
          authBlockedSessions.add(sessionId);
          const isZh = getActiveLocale(ctx) === "zh";
          originalSet(sessionId, { reason: isZh ? "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528" : "Please log in to your account first" });
          return;
        }
        authBlockedSessions.delete(sessionId);
        if (block && typeof block.reason === "string" && (block.reason.includes("\u6A21\u578B") || block.reason.toLowerCase().includes("model") || block.reason.includes("\u767B\u5F55") || block.reason.toLowerCase().includes("log in"))) {
          originalSet(sessionId, void 0);
          return;
        }
        originalSet(sessionId, block);
      };
      const originalStoreFor = conversation.blocks.storeFor?.bind(conversation.blocks);
      if (originalStoreFor) {
        conversation.blocks.storeFor = (sessionId) => {
          const store = originalStoreFor(sessionId);
          if (!isEzaiLoggedIn) {
            authBlockedSessions.add(sessionId);
            const current = store.getSnapshot();
            if (!current || !current.reason) {
              const isZh = getActiveLocale(ctx) === "zh";
              store.set({ reason: isZh ? "\u8BF7\u767B\u5F55\u8D26\u53F7\u540E\u4F7F\u7528" : "Please log in to your account first" });
            }
          }
          return store;
        };
      }
      if (isEzaiLoggedIn) {
        unlockAllSessions();
      } else {
        lockAllSessions(ctx);
      }
    }
  });
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "ezai-auth: dictionaries");
  ctx.slots.inject(
    "settings.section",
    () => ctx.slots.register({
      name: "settings.section",
      id: "ezai-account",
      order: 110,
      label: () => {
        const t = ctx.locale.bind(NS);
        return t("tabTitle");
      },
      locale: NS,
      inject: () => ({})
    }, EzaiAccountTab)
  );
  void (async () => {
    try {
      const response = await fetch("/api/ezai-auth/account", { headers: { accept: "application/json" } });
      if (response.status === 200) {
        isEzaiLoggedIn = true;
        if (typeof window !== "undefined") {
          window.__EZAI_LOGGED_IN__ = true;
          window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: true } }));
        }
        unlockAllSessions();
        cleanUI();
        return;
      }
      isEzaiLoggedIn = false;
      if (typeof window !== "undefined") {
        window.__EZAI_LOGGED_IN__ = false;
        window.dispatchEvent(new CustomEvent("ezai-auth:state-change", { detail: { loggedIn: false } }));
      }
      lockAllSessions(ctx);
      if (response.status === 403) {
        const payload = await response.json().catch(() => ({}));
        if (payload.departmentDisallowed) {
          showDepartmentNoticeModal(payload.message, () => {
            showEzaiLoginModal(getActiveLocale(ctx));
          }, payload.title);
          return;
        }
      }
      if (response.status === 401) {
        showEzaiLoginModal(getActiveLocale(ctx));
      }
    } catch {
    }
  })();
}
return module.exports; } });
//# sourceMappingURL=client.js.map
