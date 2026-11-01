import { NextRequest, NextResponse } from 'next/server'
import { providerDefaults, resolveProvider, type LlmProvider } from '@/lib/llm'

// Answers one question: does this key actually work with this provider?
//
// The key is used for this single request and never stored or logged, so it is
// safe to call with a key the visitor has typed but not yet saved. The provider
// is asked for a one-token completion, which is the smallest call that
// distinguishes a good key from a rejected one.

const TIMEOUT_MS = 20_000

function providerFrom(value: string | null): LlmProvider | undefined {
  const provider = value?.trim().toLowerCase()
  return provider === 'sarvam' || provider === 'venice' || provider === 'anthropic'
    ? provider
    : undefined
}

export async function POST(req: NextRequest) {
  let body: { apiKey?: string; provider?: string } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    /* an empty body is fine; the key can come from the header */
  }

  const apiKey = (req.headers.get('X-LLM-API-Key') || body.apiKey || '').trim()
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'No key provided.' }, { status: 400 })
  }

  const provider = providerFrom(req.headers.get('X-LLM-Provider') || body.provider || null) ?? resolveProvider()
  const { model } = providerDefaults(provider)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let url: string
    let headers: Record<string, string>
    let payload: unknown

    if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages'
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      }
      payload = { model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }
    } else {
      const base =
        provider === 'venice'
          ? (process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1')
          : (process.env.SARVAM_BASE_URL || 'https://api.sarvam.ai/v1')
      url = `${base.replace(/\/+$/, '')}/chat/completions`
      headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'api-subscription-key': apiKey,
      }
      payload = { model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (response.ok) {
      return NextResponse.json({ ok: true, provider, model })
    }

    const raw = await response.text().catch(() => '')
    let detail = raw.slice(0, 300)
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string } }
      if (parsed.error?.message) detail = parsed.error.message
      if (parsed.error?.code) detail = `${detail} (${parsed.error.code})`
    } catch {
      /* keep the raw text */
    }

    const hint =
      response.status === 401 || response.status === 403
        ? 'The provider rejected this key.'
        : response.status === 404
          ? `The provider does not recognise the model ${model}.`
          : 'The provider returned an error.'

    return NextResponse.json(
      { ok: false, provider, model, status: response.status, error: `${hint} ${detail}`.trim() },
      { status: 200 },
    )
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `No response within ${TIMEOUT_MS / 1000}s.`
        : error instanceof Error
          ? error.message
          : 'Unknown error'
    return NextResponse.json({ ok: false, provider, model, error: message }, { status: 200 })
  } finally {
    clearTimeout(timer)
  }
}
