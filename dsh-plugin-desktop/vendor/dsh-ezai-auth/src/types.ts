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

/** Session snapshot persisted to disk. */
export interface SessionSnapshot {
  cookies: string
  user: EzaiUser
  /** ISO timestamp of the last successful login. */
  loggedInAt: string
  /** Cumulative tokens consumed under this account. */
  tokenUsed?: number
  /** Token usage mapping across all accounts on this machine: userId -> tokenUsed */
  accountTokens?: Record<string, number>
}

/** Account + token usage surfaced to the client. */
export interface AccountResponse {
  user: EzaiUser
  tokenUsage: {
    used: number
    quota: number
  }
  warning?: string
}

/** Captcha response surfaced to the client. */
export interface CaptchaResponse {
  imageBase64: string
  contentType: string
  /** Cookies captured while fetching the captcha; must be sent back with login. */
  cookies: string
}
