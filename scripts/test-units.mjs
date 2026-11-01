#!/usr/bin/env node
/**
 * Unit tests for the pure logic that the end-to-end suite does not reach.
 *
 * These cover the two places where a mistake is silent rather than loud:
 * runtime validation at the request boundary, and the small helpers that decide
 * which provider a key belongs to and how a citation URL is displayed.
 *
 * Run with: npm run test:units
 */

import {
  requiredString,
  optionalString,
  integer,
  readJsonObject,
  DATASET_PATTERN,
} from '../lib/validate.ts'
import { providerForKey } from '../lib/llm.ts'
import { hostnameOf } from '../lib/utils.ts'

let passed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// ---------------------------------------------------------------------------
section('requiredString')

check('accepts a normal string', requiredString('hello', 'q', { max: 10 }).ok)
check('trims before measuring', requiredString('  hi  ', 'q', { max: 10 }).value === 'hi')
check('rejects a number', !requiredString(42, 'q', { max: 10 }).ok)
check('rejects an object', !requiredString({ a: 1 }, 'q', { max: 10 }).ok)
check('rejects null', !requiredString(null, 'q', { max: 10 }).ok)
check('rejects blank', !requiredString('   ', 'q', { max: 10 }).ok)
check('rejects over the limit', !requiredString('x'.repeat(11), 'q', { max: 10 }).ok)
check(
  'names the field in the error',
  requiredString(1, 'query', { max: 10 }).error?.includes('query'),
  requiredString(1, 'query', { max: 10 }).error,
)

// ---------------------------------------------------------------------------
section('optionalString')

check('absent is undefined, not an error', optionalString(undefined, 'd', { max: 5 }).value === undefined)
check('blank is undefined', optionalString('  ', 'd', { max: 5 }).value === undefined)
check('wrong type is an error', !optionalString(5, 'd', { max: 5 }).ok)
check('pattern is enforced', !optionalString('civ', 'd', { max: 5, pattern: DATASET_PATTERN }).ok)
check('pattern passes for a valid code', optionalString('CIV', 'd', { max: 5, pattern: DATASET_PATTERN }).value === 'CIV')

// ---------------------------------------------------------------------------
section('integer')

check('falls back when absent', integer(undefined, 'limit', { min: 1, max: 25, fallback: 5 }).value === 5)
check('parses a numeric string', integer('7', 'limit', { min: 1, max: 25 }).value === 7)
check('rejects NaN', !integer('abc', 'limit', { min: 1, max: 25 }).ok)
check('rejects a fraction', !integer('1.5', 'limit', { min: 1, max: 25 }).ok)
check('rejects below the range', !integer(0, 'limit', { min: 1, max: 25 }).ok)
check('rejects above the range', !integer(99, 'limit', { min: 1, max: 25 }).ok)
check('rejects Infinity', !integer(Infinity, 'limit', { min: 1, max: 25 }).ok)

// ---------------------------------------------------------------------------
section('readJsonObject')

const req = (body) => new Request('http://x/', { method: 'POST', body, headers: { 'content-type': 'application/json' } })

check('accepts an object', (await readJsonObject(req('{"query":"hi"}'))).ok)
check('rejects an array', !(await readJsonObject(req('[1,2]'))).ok)
check('rejects a bare string', !(await readJsonObject(req('"hi"'))).ok)
check('rejects invalid JSON', !(await readJsonObject(req('{oops'))).ok)
check('rejects an empty body', !(await readJsonObject(req(''))).ok)

// ---------------------------------------------------------------------------
section('providerForKey')

check('cloudflare token', providerForKey('cfat_abc123') === 'cloudflare')
check('anthropic key', providerForKey('sk-ant-api03-xyz') === 'anthropic')
check('unknown shape is not guessed', providerForKey('sk_live_abc') === undefined)
check('empty is undefined', providerForKey('') === undefined)
check('undefined is undefined', providerForKey(undefined) === undefined)
check('surrounding space does not break detection', providerForKey('  cfat_abc  ') === 'cloudflare')

// ---------------------------------------------------------------------------
section('hostnameOf')

check('strips www', hostnameOf('https://www.example.gov/a/b') === 'example.gov')
check('keeps a subdomain', hostnameOf('https://api.example.gov') === 'api.example.gov')
check('the citation fallback "#" becomes empty', hostnameOf('#') === '')
check('empty string becomes empty', hostnameOf('') === '')
check('undefined becomes empty', hostnameOf(undefined) === '')
check('a non-URL is returned as-is rather than throwing', hostnameOf('CIV § 1950.5') === 'CIV § 1950.5')

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length > 0) {
  for (const failure of failures) console.log(`  - ${failure}`)
  process.exit(1)
}
