// Runtime validation for values that cross a trust boundary.
//
// Static types do not survive JSON.parse: a request body typed as `{ query:
// string }` is whatever the caller sent. Every route reads its input through
// these helpers so a wrong shape becomes a 400 with a sentence, not a crash
// three layers down or a model prompt containing "[object Object]".
//
// Dependency-free on purpose: the project does not need a schema library to
// check six fields.

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error }
}

/** Reads a JSON body, rejecting anything that is not an object. */
export async function readJsonObject(req: Request): Promise<Parsed<Record<string, unknown>>> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return fail('A JSON request body is required.')
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('The request body must be a JSON object.')
  }
  return { ok: true, value: raw as Record<string, unknown> }
}

/** A required, trimmed, non-empty string within a length budget. */
export function requiredString(
  value: unknown,
  field: string,
  options: { max: number; min?: number },
): Parsed<string> {
  if (typeof value !== 'string') return fail(`${field} must be a string.`)
  const trimmed = value.trim()
  if (trimmed.length < (options.min ?? 1)) return fail(`${field} is required.`)
  if (trimmed.length > options.max) {
    return fail(`${field} is too long (maximum ${options.max} characters).`)
  }
  return { ok: true, value: trimmed }
}

/** An optional string: undefined when absent or blank, invalid when the wrong type. */
export function optionalString(
  value: unknown,
  field: string,
  options: { max: number; pattern?: RegExp; patternHint?: string },
): Parsed<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== 'string') return fail(`${field} must be a string.`)
  const trimmed = value.trim()
  if (!trimmed) return { ok: true, value: undefined }
  if (trimmed.length > options.max) {
    return fail(`${field} is too long (maximum ${options.max} characters).`)
  }
  if (options.pattern && !options.pattern.test(trimmed)) {
    return fail(`${field} must be ${options.patternHint ?? 'in the expected format'}.`)
  }
  return { ok: true, value: trimmed }
}

/** An integer from a query string or JSON value, clamped to a range. */
export function integer(
  value: unknown,
  field: string,
  options: { min: number; max: number; fallback?: number },
): Parsed<number> {
  if (value === undefined || value === null || value === '') {
    if (options.fallback !== undefined) return { ok: true, value: options.fallback }
    return fail(`${field} is required.`)
  }
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return fail(`${field} must be a whole number.`)
  }
  if (parsed < options.min || parsed > options.max) {
    return fail(`${field} must be between ${options.min} and ${options.max}.`)
  }
  return { ok: true, value: parsed }
}

/** The corpus dataset codes: a short uppercase identifier such as CIV or PEN. */
export const DATASET_PATTERN = /^[A-Z]{2,6}$/

export const LIMITS = {
  query: 8_000,
  followUpQuery: 2_000,
  corpusQuery: 400,
  apiKey: 400,
  accountId: 64,
  model: 200,
  speechText: 12_000,
} as const

export const PROVIDERS = ['sarvam', 'cloudflare', 'venice', 'anthropic'] as const
