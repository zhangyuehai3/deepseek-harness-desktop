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

/** EZAI quota and key information returned under data.ezai. */
export interface EzaiLoginEzaiData {
  can_use: number
  quota_type: string
  token_quota: number
  used_tokens: number
  total_used_tokens: number
  api_key: string
  key_id?: string
  key_source?: string
  department_id?: number | string | null
  department_name?: string
}

/** User response payload with optional EZAI permissions and encrypted keys. */
export interface EzaiUserData extends EzaiUser {
  ezai?: EzaiLoginEzaiData
  api_key?: string
}

/** Login response envelope from ezsvsbox.com. */
export interface LoginResponse {
  status_code: number
  message: string
  error?: string
  data?: EzaiUserData
}

/** Weekly token usage record per account. */
export interface AccountWeeklyUsage {
  week: string
  used: number
  /** Cumulative total tokens consumed across all time. */
  totalUsed?: number
  /** Timestamp (ms) of the last token accounting activity under this week record. */
  lastActiveTime?: number
  /** Cryptographic HMAC signature to prevent manual tampering of local files. */
  _sig?: string
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
  /** Cumulative tokens consumed under this account across all time. */
  totalTokenUsed?: number
  /** Cryptographic HMAC signature to prevent manual tampering of local files. */
  _sig?: string
  /** The weekly cycle identifier (Monday YYYY-MM-DD) for tokenUsed. */
  weekKey?: string
  /** Token usage mapping across all accounts on this machine: userId -> AccountWeeklyUsage | number */
  accountTokens?: Record<string, AccountWeeklyUsage | number>
  /** Individual weekly token quota override from whitelist or API (if absent, defaults to 200,000,000). */
  tokenQuota?: number
  /** Whitelist department override if matched in whitelist (e.g. 欧洲大区). */
  whitelistDepartment?: string
  /** Decrypted API Key issued by server for this session. */
  apiKey?: string
  /** Effective department name returned from server or personal info. */
  departmentName?: string
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
    totalUsed?: number
    quota: number
    isPeakHours?: boolean
    rateMultiplier?: number
  }
  personalInfo?: EzaiPersonalInfo
  warning?: string
  departmentName?: string
}

/** Server Token Usage response data. */
export interface EzaiTokenUsageResult {
  user_id: number | string
  name: string
  email: string
  can_use: number
  quota_type: string
  token_quota: number
  used_tokens: number
  total_used_tokens: number
  remaining_tokens: number
  usage_percent?: number
  last_active_at?: string | null
}

/** Captcha response surfaced to the client. */
export interface CaptchaResponse {
  imageBase64: string
  contentType: string
  /** Cookies captured while fetching the captcha; must be sent back with login. */
  cookies: string
}
