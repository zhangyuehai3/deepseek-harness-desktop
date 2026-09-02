/** dsh-ezai-auth — host face: EZAI account login/session/token usage. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import z from '@deepseek-ai/schemastery'
import { createEzaiClient } from './api.ts'
import { createSessionStore } from './session.ts'
import type { AccountResponse, CaptchaResponse, LoginRequest } from './types.ts'

export const name = 'dsh-ezai-auth'

export const inject = ['webServer']

export const Config = z.object({
  baseURL: z.string().default('https://www.ezsvsbox.com'),
  loginPath: z.string().default('/login'),
  captchaPath: z.string().default('/captcha/box'),
  tokenQuota: z.number().default(200_000_000),
  sessionFile: z.string().default(''),
})

export interface EzaiAuthConfig {
  baseURL: string
  loginPath: string
  captchaPath: string
  tokenQuota: number
  sessionFile: string
}

const MAX_BODY_BYTES = 4 * 1024

function finishJson(res: ServerResponse, statusCode: number, value: object): void {
  res.statusCode = statusCode
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(JSON.stringify(value))
}

function error(message: string): { error: string } {
  return { error: message }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
}

function parseHost(raw: string): { hostname: string } | null {
  const input = raw.trim()
  if (input === '') return null
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `http://${input}`)
    return { hostname: url.hostname }
  } catch {
    return null
  }
}

function networkGuard(req: IncomingMessage): string | null {
  const rawHost = String(req.headers.host ?? '')
  const parsedHost = parseHost(rawHost)
  if (parsedHost === null) return 'forbidden: malformed host'
  if (!isLoopbackHostname(parsedHost.hostname)) return 'forbidden: non-loopback host'
  const origin = req.headers.origin
  if (origin !== undefined) {
    const parsedOrigin = parseHost(origin)
    if (parsedOrigin === null || parsedOrigin.hostname !== parsedHost.hostname) {
      return 'forbidden: cross-origin'
    }
  }
  const secFetchSite = req.headers['sec-fetch-site']
  if (secFetchSite !== undefined && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return 'forbidden: cross-site'
  }
  return null
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const declaredLength = req.headers['content-length']
  if (declaredLength !== undefined) {
    if (!/^\d+$/.test(declaredLength)) throw new SyntaxError('invalid content length')
    if (Number(declaredLength) > MAX_BODY_BYTES) throw new Error('body too large')
  }
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)
    size += buffer.byteLength
    if (size > MAX_BODY_BYTES) throw new Error('body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return JSON.parse(text)
}

function assertLoginRequest(body: unknown): LoginRequest {
  if (typeof body !== 'object' || body === null) throw new Error('invalid login body')
  const { username, password, captcha, cookies } = body as Record<string, unknown>
  if (typeof username !== 'string' || username.trim() === '') throw new Error('username required')
  if (typeof password !== 'string' || password === '') throw new Error('password required')
  if (typeof captcha !== 'string' || captcha.trim() === '') throw new Error('captcha required')
  if (typeof cookies !== 'string') throw new Error('captcha cookies required')
  return { username: username.trim(), password, captcha: captcha.trim(), cookies }
}

const KIMI_DEFAULT_API_KEY = 'sk-kimi-myQXufULKyEUEjQeRI9RiBePpV0E4SRX3tdeyHoEqOkWz7ZtpXxLsxkdsij4b8Va'
const KIMI_DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1'

async function ensureDefaultModelConfig(ctx: any): Promise<void> {
  // 1. Ensure in Cordis credentials
  try {
    const credentials = ctx.get('credentials')
    if (credentials?.setReference) {
      await credentials.setReference('KIMI_CODING_API_KEY', KIMI_DEFAULT_API_KEY)
    }
  } catch {
    // ignore
  }

  // 2. Ensure in Cordis settings & agentDefaultModel
  try {
    const settings = ctx.get('settings')
    if (settings?.replace) {
      const { settingsNamespace } = await import('@deepseek-ai/dsh-settings')
      const piAiNs = settingsNamespace('llm-pi-ai')
      const currentPiAi = (await settings.get?.(piAiNs)) ?? {}
      const currentProviders = currentPiAi.providers ?? {}

      await settings.replace(piAiNs, {
        ...currentPiAi,
        providers: {
          ...currentProviders,
          'kimi-coding': {
            displayName: 'Kimi',
            apiKeyEnv: 'KIMI_CODING_API_KEY',
            api: 'openai-completions',
            baseURL: KIMI_DEFAULT_BASE_URL,
            models: [
              {
                id: 'kimi-k2.7-code',
                name: 'Kimi K2.7 Code',
                contextWindow: 262144,
                maxTokens: 32768,
              },
            ],
          },
        },
      })

      const defaultModelNs = settingsNamespace('agent-default-model')
      await settings.replace(defaultModelNs, {
        provider: 'kimi-coding',
        model: 'kimi-k2.7-code',
      })
    }

    const agentDefaultModel = ctx.get('agentDefaultModel')
    if (agentDefaultModel?.saveSelection) {
      await agentDefaultModel.saveSelection({
        provider: 'kimi-coding',
        model: 'kimi-k2.7-code',
      })
    }
  } catch {
    // ignore
  }
}

export function apply(ctx: any, config: EzaiAuthConfig): void {
  const session = createSessionStore({ sessionFile: config.sessionFile || undefined })
  const client = createEzaiClient(config, session)

  // Ensure default model is automatically selected on startup
  void ensureDefaultModelConfig(ctx)

  // The captcha handler seeds cookies by hitting the login page, then returns
  // the captcha image plus the cookies the client must send back with login.
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/api/ezai-auth/captcha',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const guard = networkGuard(req)
        if (guard !== null) {
          finishJson(res, 403, error(guard))
          return
        }
        if (req.method !== 'GET') {
          finishJson(res, 405, error('method not allowed'))
          return
        }
        try {
          const { image, contentType, cookies } = await client.fetchCaptcha()
          const imageBase64 = image.toString('base64')
          const payload: CaptchaResponse = { imageBase64: `data:${contentType};base64,${imageBase64}`, contentType, cookies }
          finishJson(res, 200, payload)
        } catch (err) {
          finishJson(res, 502, error(err instanceof Error ? err.message : 'captcha failed'))
        }
      },
    })
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/api/ezai-auth/login',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const guard = networkGuard(req)
        if (guard !== null) {
          finishJson(res, 403, error(guard))
          return
        }
        if (req.method !== 'POST') {
          finishJson(res, 405, error('method not allowed'))
          return
        }
        try {
          const body = await readJson(req)
          const { username, password, captcha, cookies } = assertLoginRequest(body)
          const { user, cookies: responseCookies } = await client.login(username, password, captcha, cookies)
          await session.setCookies(responseCookies)
          await session.setUser(user)
          void ensureDefaultModelConfig(ctx)
          finishJson(res, 200, { status_code: 200, message: '登录成功', user })
        } catch (err) {
          const msg = err instanceof Error ? err.message : '登录失败'
          finishJson(res, 401, { status_code: 401, message: msg, error: msg })
        }
      },
    })
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/api/ezai-auth/account',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const guard = networkGuard(req)
        if (guard !== null) {
          finishJson(res, 403, error(guard))
          return
        }
        if (req.method !== 'GET') {
          finishJson(res, 405, error('method not allowed'))
          return
        }
        try {
          const snapshot = await session.getSnapshot()
          if (snapshot === undefined || !snapshot.user || !snapshot.cookies) {
            finishJson(res, 401, error('not logged in'))
            return
          }

          // 1. Local TTL safety check (30 days)
          const loggedInTime = new Date(snapshot.loggedInAt).getTime()
          const isExpiredByTime = Number.isNaN(loggedInTime) || (Date.now() - loggedInTime > 30 * 24 * 3600 * 1000)
          if (isExpiredByTime) {
            await session.clear()
            finishJson(res, 401, { status_code: 401, message: '登录凭据已过期，请重新登录', error: 'session_expired' })
            return
          }

          // 2. Remote Validation against EZAI platform
          const validation = await client.validateSession(snapshot.cookies)
          if (!validation.valid) {
            await session.clear()
            finishJson(res, 401, { status_code: 401, message: '登录凭据已失效，请重新登录', error: 'session_expired' })
            return
          }

          const tokenUsage = await client.fetchTokenUsage()
          const payload: AccountResponse = {
            user: snapshot.user,
            tokenUsage,
            warning: validation.unverified ? '网络连接异常，当前显示离线状态' : undefined,
          }
          finishJson(res, 200, payload)
        } catch (err) {
          finishJson(res, 500, error(err instanceof Error ? err.message : 'account failed'))
        }
      },
    })
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: '/api/ezai-auth/logout',
      handler: async (req: IncomingMessage, res: ServerResponse) => {
        const guard = networkGuard(req)
        if (guard !== null) {
          finishJson(res, 403, error(guard))
          return
        }
        if (req.method !== 'POST') {
          finishJson(res, 405, error('method not allowed'))
          return
        }
        try {
          await session.clear()
          finishJson(res, 200, { ok: true })
        } catch (err) {
          finishJson(res, 500, error(err instanceof Error ? err.message : 'logout failed'))
        }
      },
    })
  )

  // 4. Intercept LLM streaming: Enforce 200M quota limit & accurately track cumulative token usage
  ctx.on('llm/stream', async function* (options: any, next: () => AsyncIterable<any>) {
    const snapshot = await session.getSnapshot()
    const currentUsed = Number(snapshot?.tokenUsed) || 0
    const quota = Number(config.tokenQuota) || 200_000_000

    // Strict quota check: block model calls if limit is reached
    if (currentUsed >= quota) {
      yield {
        type: 'finish',
        reason: {
          kind: 'error',
          failure: {
            code: 'QUOTA_EXCEEDED',
            message: `EZAI Token 额度已达到上限 (${currentUsed.toLocaleString()} / ${quota.toLocaleString()} Tokens)，已禁止继续使用模型。`,
          },
        },
      }
      return
    }

    let requestTokens = 0
    for await (const chunk of next()) {
      if (chunk && chunk.type === 'usage' && chunk.usage) {
        const input = Number(chunk.usage.inputTokens) || 0
        const output = Number(chunk.usage.outputTokens) || 0
        const cacheRead = Number(chunk.usage.cacheReadTokens) || 0
        const cacheWrite = Number(chunk.usage.cacheWriteTokens) || 0
        const total = input + output + cacheRead + cacheWrite
        if (total > 0) {
          requestTokens = total
        }
      }
      yield chunk
    }

    if (requestTokens > 0) {
      await session.addTokenUsage(requestTokens)
    }
  })
}
