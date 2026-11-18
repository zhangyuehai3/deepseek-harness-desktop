/** HTTP client for ezsvsbox.com login/captcha/session. */

import https from 'node:https'
import http from 'node:http'
import { constants, privateDecrypt } from 'node:crypto'
import { ezaiLog } from './logger.ts'
import type { EzaiSessionStore } from './session.ts'
import { updateServerTime } from './trusted-time.ts'
import type { EzaiPersonalInfo, EzaiUser, EzaiLoginEzaiData, LoginResponse, EzaiTokenUsageResult } from './types.ts'

/**
 * Fixed RSA Private Key matching the server's public key (from storage/app/ezai_rsa_keypair.json).
 * Used to decrypt server-encrypted API keys upon login.
 */
export const EZAI_RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCmI7rbzXFny3Yg
RUbYjvejnPMFAje7spEJi5sSJZxYmwzJ/Y1FR+/4Fdvze/bBuXVb+DqSCytYwu73
ILsymllUeh7hjVdnaB+IZRN7uZk7obG8+DoP5qSxZpBUt3EZ3Rk8LDITmkcEldhQ
kaVI7WkvTyS3FT0qAKpCcmSY5r9SzpYaMomH+LPi9DGGwEtEeQW24dMcfjIVW6kr
XVQhHO2WgHRA9fQKijR8sJhdq32Ef7GFR5v/RgdKa9Kx3daeNia6GyG8k1EeFvOH
/tI1koaim0u/p7I0xIZOQusjcWBJ61zXy7I7+ZI+rKbEyIJ/V5D2asxVnvWPiHDz
cZd4Ji/xAgMBAAECggEABVKEtHDu7p/Of3cor1xZI5UuFd190pYEXnVp+Nlaml4R
OVFVmsAUuHJe0vyIKama0GDx42bXMyc/h4w1Ywgdz36ACcLA54+m3vQ5/Q8zkPz7
mC2tkn/Vi9dYzVX5GhaCrfJOgmFBYCy6us4HqP/uDDVxXCoihPtzeOB4R4uw2mK1
koxzmvTNO3jJrBymvHdiQj7Xp33vxzYuzxZrkr3rhWpVbJiApFWSBvL9y+SvuleK
zKwRG0lFp545q5MpMgLd1rcChgLdZiWpEau2wnItd5UJy22zUTTf/8BnxZj0r8Hv
+Nc8DB2s4TvgKtmH/kdjm9+UiTzXboWq+6E+yw9hlwKBgQDl85vcmdiwx3VYH6BL
vprfgsKidn+gaKu3hZKfAdYEm6srZE6E7NBUALPScP/837julH+CRD/e0p5VY40F
L1EpzAGkaNGSinqwKvDLCYgYgxiY7Kiz0DBKy3N6WteWPOUvFEBzNlzblxtOBGVi
nP8pfbG5DbBfhrmsG2yd5pX3AwKBgQC49aEVAwxL/Y7tSk8k4Zu6lM2RTRf1lMsC
vxCtiuJnkTH5TwlwmWbq996vvyE2/f+/j618JiheIdqfiGB0IgH3MHM0KhGu2H7p
ZZ3bgA+P3fhwzRU3eCA/lJA3DC9tqPZcP2dKEz3ZekyWi2H8Pd74yN8RmJsppuH5
Dl/Dk18A+wKBgAeZk48o7oZ5MSGmee/G7utwMOqZrAIrM3GvUnc64k3orzGR8R5n
jUMZetf7sBo1crE/6y7s/odowp7j2WdQdwhAm9VJOZP0S7XC1Y6AVCUrQAbd232F
5fKy4rAqjHGEtbZmnvKv20XOqrJbZtZphe1jIBqTnz6o/z328hIN6urtAoGATq+o
1NCUJav8ZzTq0KzuXIU7oyoiHEctysBQLxRb12Ws1fxq7q1EXIgRA8GTNtr+N5e/
XYa6O7m5UY9qQV3KakgBatrO5QyTiWXCr4Qemrz7GboV4aBIT+Q7KkAT2Vo9XOdY
YOoosOHXvWAU0oPb3QlP5SOAN0sY7aTQ1tpWW4sCgYAEjqtm+JtYDRsYi3J/GS9I
FUIeD3XWyP5v4Lurg+LKaJba6DwBbEBUhSAbycJZ9elkWy9mm4yPnHCHI7STckIu
ghOAxQNdzu2tPPp0tIVw3bAVhBoVGw8HVHuH5lCW12UQr0HeC0FzgQ2Qtqukcy/x
gvnBmUIoEvxdkwfroAgsSA==
-----END PRIVATE KEY-----`

export interface EzaiClientOptions {
  /** Base URL without trailing slash, e.g. https://www.ezsvsbox.com */
  baseURL: string
  /** Login path, defaults to /login */
  loginPath: string
  /** Captcha path, defaults to /captcha/box */
  captchaPath: string
  /** Hard-coded token quota until the real API is available. */
  tokenQuota: number
}

export interface EzaiCaptcha {
  image: Buffer
  contentType: string
  cookies: string
}

export interface EzaiLoginResult {
  user: EzaiUser
  cookies: string
  ezaiData?: EzaiLoginEzaiData
  decryptedApiKey?: string
}

export interface EzaiClient {
  fetchCaptcha(): Promise<EzaiCaptcha>
  login(username: string, password: string, captcha: string, captchaCookies: string): Promise<EzaiLoginResult>
  fetchTokenUsage(customQuota?: number): Promise<{ used: number; totalUsed?: number; quota: number; isPeakHours?: boolean; rateMultiplier?: number }>
  validateSession(cookies: string): Promise<{ valid: boolean; unverified?: boolean; reason?: string }>
  fetchPersonalInfo(cookies: string): Promise<EzaiPersonalInfo | undefined>
  reportTokenUsage(params: { tokens: number; userId?: string | number; email?: string; loginName?: string; model?: string; cookies?: string; apiKey?: string }): Promise<EzaiTokenUsageResult | undefined>
  fetchRemoteTokenUsage(params: { userId?: string | number; email?: string; loginName?: string; cookies?: string; apiKey?: string }): Promise<EzaiTokenUsageResult | undefined>
}

/**
 * Decrypt RSA encrypted API key with private key (tries OAEP SHA-256, OAEP default, and PKCS1).
 */
export function decryptApiKeyWithPrivateKey(encryptedBase64: string, privateKeyPem = EZAI_RSA_PRIVATE_KEY): string {
  const trimmed = encryptedBase64.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('sk-')) return trimmed

  const buffer = Buffer.from(trimmed, 'base64')

  // Try OAEP with SHA-256
  try {
    const decrypted = privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer,
    )
    return decrypted.toString('utf8')
  } catch {}

  // Try OAEP default (sha1)
  try {
    const decrypted = privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      buffer,
    )
    return decrypted.toString('utf8')
  } catch {}

  // Try PKCS1 padding
  try {
    const decrypted = privateDecrypt(
      {
        key: privateKeyPem,
        padding: constants.RSA_PKCS1_PADDING,
      },
      buffer,
    )
    return decrypted.toString('utf8')
  } catch {}

  return trimmed
}

interface HttpResponse {
  statusCode: number
  statusMessage: string
  headers: http.IncomingHttpHeaders
  body: Buffer
}

function parseSetCookieHeader(values: string | string[] | undefined): string {
  if (values === undefined) return ''
  const list = Array.isArray(values) ? values : [values]
  const pairs: string[] = []
  for (const value of list) {
    const trimmed = value.trim()
    if (trimmed === '') continue
    // Only keep the NAME=VALUE part; discard Expires/Path/HttpOnly/etc.
    const semi = trimmed.indexOf(';')
    const pair = semi === -1 ? trimmed : trimmed.slice(0, semi)
    if (pair.includes('=')) pairs.push(pair)
  }
  return pairs.join('; ')
}

/**
 * Merge multiple cookie strings, keeping the last value for each cookie name.
 * This is important when the captcha request refreshes the session cookie:
 * we want the seed cookies (XSRF-TOKEN, original session) plus any updated
 * cookies returned by the captcha/login response.
 */
function mergeCookieStrings(...sources: string[]): string {
  const map = new Map<string, string>()
  for (const source of sources) {
    if (source === undefined || source.trim() === '') continue
    for (const pair of source.split(';')) {
      const trimmed = pair.trim()
      if (trimmed === '') continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const name = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim()
      map.set(name, `${name}=${value}`)
    }
  }
  return Array.from(map.values()).join('; ')
}

function buildUserAgent(): string {
  // Match the real browser UA observed from the EZSVS_BOX web login so WAF /
  // captcha treat the request like a normal browser.
  return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'
}

const REQUEST_TIMEOUT_MS = 30000

function request(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:')
    const client = isHttps ? https : http
    const req = client.request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          if (res.headers.date) {
            updateServerTime(res.headers.date)
          }
          resolve({
            statusCode: res.statusCode ?? 0,
            statusMessage: res.statusMessage ?? '',
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        })
      },
    )

    const timer = setTimeout(() => {
      req.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`))
    }, REQUEST_TIMEOUT_MS)

    req.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    req.on('close', () => {
      clearTimeout(timer)
    })

    if (options.body !== undefined) {
      req.write(options.body)
    }
    req.end()
  })
}

export function createEzaiClient(options: EzaiClientOptions, session: EzaiSessionStore): EzaiClient {
  const { baseURL, loginPath, captchaPath, tokenQuota } = options

  async function seedCookies(): Promise<string> {
    // Request the login page so the server hands out XSRF-TOKEN / session / WAF cookies.
    const url = `${baseURL}${loginPath}`
    try {
      const response = await request(url, {
        method: 'GET',
        headers: {
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'upgrade-insecure-requests': '1',
          'user-agent': buildUserAgent(),
        },
      })
      const cookies = parseSetCookieHeader(response.headers['set-cookie'])
      await ezaiLog(`seedCookies ${url} status=${response.statusCode} cookies=${cookies.length} bytes`)
      return cookies
    } catch (err) {
      await ezaiLog(`seedCookies ${url} error: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  return {
    async fetchCaptcha(): Promise<EzaiCaptcha> {
      const seed = await seedCookies()
      const cacheBust = `?${Math.random().toString(36).slice(2)}${Date.now()}`
      const url = `${baseURL}${captchaPath}${cacheBust}`
      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cookie': seed,
            'referer': `${baseURL}${loginPath}`,
            'sec-fetch-dest': 'image',
            'sec-fetch-mode': 'no-cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': buildUserAgent(),
          },
        })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`获取验证码失败: ${response.statusCode} ${response.statusMessage}`)
        }
        const contentType = String(response.headers['content-type'] ?? 'image/png')
        const responseCookies = parseSetCookieHeader(response.headers['set-cookie'])
        const cookies = mergeCookieStrings(seed, responseCookies)
        await ezaiLog(`fetchCaptcha ${url} status=${response.statusCode} cookies=${cookies.length} bytes`)
        return {
          image: response.body,
          contentType,
          cookies,
        }
      } catch (err) {
        await ezaiLog(`fetchCaptcha ${url} error: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      }
    },

    async login(username: string, password: string, captcha: string, captchaCookies: string): Promise<EzaiLoginResult> {
      const body = new URLSearchParams({
        username,
        password,
        captcha,
        from: 'ezai',
      }).toString()
      const url = `${baseURL}${loginPath}`
      try {
        const response = await request(url, {
          method: 'POST',
          headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'content-length': String(Buffer.byteLength(body)),
            'cookie': captchaCookies,
            'origin': baseURL,
            'referer': `${baseURL}${loginPath}`,
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin',
            'user-agent': buildUserAgent(),
            'x-requested-with': 'XMLHttpRequest',
          },
          body,
        })

        let payload: LoginResponse | undefined
        try {
          payload = JSON.parse(response.body.toString('utf8')) as LoginResponse
        } catch {
          // Ignore JSON parse error if body is not JSON
        }

        if (payload !== undefined) {
          if (payload.status_code !== 200 || payload.data === undefined || Array.isArray(payload.data)) {
            throw new Error(payload.message || payload.error || '账号或密码错误')
          }
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(`登录请求失败 (${response.statusCode})`)
        }

        if (!payload || !payload.data || Array.isArray(payload.data)) {
          throw new Error('登录失败，返回数据异常')
        }

        const responseCookies = parseSetCookieHeader(response.headers['set-cookie'])
        const cookies = mergeCookieStrings(captchaCookies, responseCookies)
        await ezaiLog(`login ${url} status=${response.statusCode} user=${payload.data.login_name}`)

        const ezaiData = payload.data.ezai
        let decryptedApiKey: string | undefined
        const rawKey = ezaiData?.api_key || payload.data.api_key
        if (rawKey) {
          decryptedApiKey = decryptApiKeyWithPrivateKey(rawKey, EZAI_RSA_PRIVATE_KEY)
        }

        return {
          user: payload.data,
          cookies,
          ezaiData,
          decryptedApiKey,
        }
      } catch (err) {
        await ezaiLog(`login ${url} error: ${err instanceof Error ? err.message : String(err)}`)
        throw err
      }
    },

    async fetchTokenUsage(customQuota?: number): Promise<{ used: number; totalUsed?: number; quota: number; isPeakHours: boolean; rateMultiplier: number }> {
      const used = await session.getTokenUsage()
      const totalUsed = (await session.getTotalTokenUsage?.()) ?? 0
      const isPeakHours = await session.isCurrentPeakHours()
      const rateMultiplier = await session.getTokenRateMultiplier()
      const quota = typeof customQuota === 'number' && customQuota > 0
        ? customQuota
        : (await session.getTokenQuota?.() ?? tokenQuota)
      return { used, totalUsed, quota, isPeakHours, rateMultiplier }
    },

    async reportTokenUsage(params: {
      tokens: number
      userId?: string | number
      email?: string
      loginName?: string
      model?: string
      cookies?: string
      apiKey?: string
    }): Promise<EzaiTokenUsageResult | undefined> {
      const url = `${baseURL}/api/ezai/token-usage`
      const body = JSON.stringify({
        tokens: params.tokens,
        user_id: params.userId,
        email: params.email,
        login_name: params.loginName,
        model: params.model || 'deepseek-chat',
      })
      try {
        const response = await request(url, {
          method: 'POST',
          headers: {
            'accept': 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/json',
            'content-length': String(Buffer.byteLength(body)),
            ...(params.cookies ? { 'cookie': params.cookies } : {}),
            ...(params.apiKey ? { 'authorization': `Bearer ${params.apiKey}`, 'x-ezai-api-key': params.apiKey } : {}),
            'user-agent': buildUserAgent(),
          },
          body,
        })
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const json = JSON.parse(response.body.toString('utf8'))
          if (json && json.status_code === 200 && json.data) {
            await ezaiLog(`reportTokenUsage success: tokens=${params.tokens} server_used=${json.data.used_tokens} total=${json.data.total_used_tokens}`)
            return json.data as EzaiTokenUsageResult
          }
        }
        await ezaiLog(`reportTokenUsage response: status=${response.statusCode} body=${response.body.toString('utf8').slice(0, 200)}`)
        return undefined
      } catch (err) {
        await ezaiLog(`reportTokenUsage failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    },

    async fetchRemoteTokenUsage(params: {
      userId?: string | number
      email?: string
      loginName?: string
      cookies?: string
      apiKey?: string
    }): Promise<EzaiTokenUsageResult | undefined> {
      const q = new URLSearchParams()
      if (params.userId) q.set('user_id', String(params.userId))
      if (params.email) q.set('email', params.email)
      if (params.loginName) q.set('login_name', params.loginName)
      const url = `${baseURL}/api/ezai/token-usage?${q.toString()}`

      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            ...(params.cookies ? { 'cookie': params.cookies } : {}),
            ...(params.apiKey ? { 'authorization': `Bearer ${params.apiKey}`, 'x-ezai-api-key': params.apiKey } : {}),
            'user-agent': buildUserAgent(),
          },
        })
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const json = JSON.parse(response.body.toString('utf8'))
          if (json && json.status_code === 200 && json.data) {
            return json.data as EzaiTokenUsageResult
          }
        }
        return undefined
      } catch (err) {
        await ezaiLog(`fetchRemoteTokenUsage failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    },

    async validateSession(cookies: string): Promise<{ valid: boolean; unverified?: boolean; reason?: string }> {
      const url = `${baseURL}/`
      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'cookie': cookies,
            'user-agent': buildUserAgent(),
          },
        })
        const location = String(response.headers['location'] || '')
        if (response.statusCode === 302 && (location.includes('/login') || location.includes('login'))) {
          await ezaiLog(`validateSession: session expired (302 -> ${location})`)
          return { valid: false, reason: 'session_expired' }
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
          await ezaiLog(`validateSession: unauthorized status ${response.statusCode}`)
          return { valid: false, reason: 'unauthorized' }
        }
        return { valid: true }
      } catch (err) {
        // Network timeout / DNS offline:
        // Do NOT evict user on offline/timeout, flag as unverified
        await ezaiLog(`validateSession: network check skipped (${err instanceof Error ? err.message : String(err)})`)
        return { valid: true, unverified: true, reason: 'network_error' }
      }
    },

    async fetchPersonalInfo(cookies: string): Promise<EzaiPersonalInfo | undefined> {
      const url = `${baseURL}/personalDetails`
      try {
        const response = await request(url, {
          method: 'GET',
          headers: {
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'cookie': cookies,
            'referer': `${baseURL}/`,
            'user-agent': buildUserAgent(),
          },
        })
        if (response.statusCode < 200 || response.statusCode >= 300) {
          await ezaiLog(`fetchPersonalInfo: request failed (${response.statusCode})`)
          return undefined
        }
        const html = response.body.toString('utf8')
        const info = parsePersonalDetailsHtml(html, cookies)
        await ezaiLog(`fetchPersonalInfo: resolved ${info?.name ?? 'none'}, post=${info?.post ?? 'none'}`)
        return info
      } catch (err) {
        await ezaiLog(`fetchPersonalInfo failed: ${err instanceof Error ? err.message : String(err)}`)
        return undefined
      }
    },
  }
}

function parsePersonalDetailsHtml(html: string, cookies?: string): EzaiPersonalInfo | undefined {
  try {
    const info: Partial<EzaiPersonalInfo> = {}

    // Extract key-value pairs from <div class="left control-label">KEY：</div>\s*<div class="left">VALUE</div>
    const pairRegex = /<div\s+class=["']left\s+control-label["']>\s*([^：<]+?)\s*[：:]\s*<\/div>\s*<div\s+class=["']left["']>([\s\S]*?)<\/div>/g
    let match: RegExpExecArray | null
    while ((match = pairRegex.exec(html)) !== null) {
      const label = match[1].trim()
      const rawVal = match[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .trim()
      if (!rawVal) continue

      switch (label) {
        case '姓名':
          info.name = rawVal
          break
        case '岗位':
          info.post = rawVal
          break
        case '性别':
          info.gender = rawVal
          break
        case '生日':
          info.birthday = rawVal
          break
        case '私人电话':
          info.user_phone = rawVal
          break
        case '办公电话':
          info.tel_phone = rawVal
          break
        case '入职日期':
          info.hiredate = rawVal
          break
        case 'OA登录名':
          info.login_name = rawVal
          break
        case '人员编码':
          info.code = rawVal
          break
        case '公司邮箱':
          info.email = rawVal
          break
        case '所属部门':
          info.department = rawVal
          break
        case '直属上级':
          info.leader = rawVal
          break
        case '工作地点':
          info.location = rawVal
          break
      }
    }

    if (cookies) {
      const avatarMatch = /(?:^|;\s*)avatar=([^;]+)/.exec(cookies)
      if (avatarMatch) {
        try {
          info.avatar = decodeURIComponent(avatarMatch[1])
        } catch {
          info.avatar = avatarMatch[1]
        }
      }
      const nickMatch = /(?:^|;\s*)nickName=([^;]+)/.exec(cookies)
      if (nickMatch && !info.name) {
        try {
          info.name = decodeURIComponent(nickMatch[1])
        } catch {
          info.name = unescape(nickMatch[1])
        }
      }
    }

    if (!info.name && !info.login_name) return undefined
    return info as EzaiPersonalInfo
  } catch {
    return undefined
  }
}
