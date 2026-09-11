/** Shared request/response types for the EZAI auth plugin. */

/** Login form posted by the client. */
export interface LoginRequest {
  username: string
  password: string
  captcha: string
  /** Cookies captured by the captcha endpoint; must be sent back with login. */
  cookies: string
}

/** User object returned by ezsvsbox.com /login on success. */
export interface EzaiUser {
  id: string
  name: string
  login_name: string
  avatar: string
  gender: number
  birthday: number
  department_id: string
  email: string
  surname_lable: string
  user_phone: string
  qrcode: string
}

/** Login response envelope from ezsvsbox.com. */
export interface LoginResponse {
  status_code: number
  message: string
  error?: string
  data?: EzaiUser
}

/** Weekly token usage record per account. */
export interface AccountWeeklyUsage {
  week: string
  used: number
  /** Timestamp (ms) of the last token accounting activity under this week record. */
  lastActiveTime?: number
}

/** Session snapshot persisted to disk. */
export interface SessionSnapshot {
  cookies: string
  user: EzaiUser
  personalInfo?: EzaiPersonalInfo
  /** ISO timestamp of the last successful login. */
  loggedInAt: string
  /** Cumulative tokens consumed under this account in the current week. */
  tokenUsed?: number
  /** The weekly cycle identifier (Monday YYYY-MM-DD) for tokenUsed. */
  weekKey?: string
  /** Token usage mapping across all accounts on this machine: userId -> AccountWeeklyUsage | number */
  accountTokens?: Record<string, AccountWeeklyUsage | number>
}

/** Enriched personal info parsed from /personalDetails. */
export interface EzaiPersonalInfo {
  name: string
  login_name: string
  avatar?: string
  gender?: string
  birthday?: string
  department?: string
  post?: string
  email?: string
  user_phone?: string
  tel_phone?: string
  hiredate?: string
  code?: string
  location?: string
  leader?: string
  org_uid?: string
  surname_lable?: string
}

/** Account + token usage surfaced to the client. */
export interface AccountResponse {
  user: EzaiUser
  tokenUsage: {
    used: number
    quota: number
    isPeakHours?: boolean
    rateMultiplier?: number
  }
  personalInfo?: EzaiPersonalInfo
  warning?: string
}

/** Captcha response surfaced to the client. */
export interface CaptchaResponse {
  imageBase64: string
  contentType: string
  /** Cookies captured while fetching the captcha; must be sent back with login. */
  cookies: string
}
