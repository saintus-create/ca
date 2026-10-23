#!/usr/bin/env node
/**
 * Unit tests for lib/sse.ts.
 *
 * The streaming parser is the one piece of the client that can lose data
 * without anyone noticing: events vanish silently if a network chunk lands
 * mid-frame or mid-character. These cases pin that down without a browser.
 *
 *   npm run test:sse
 */

import assert from 'node:assert/strict'
import { readSse, parseSseFrame } from '../lib/sse.ts'

function streamFromChunks(chunks) {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      const chunk = chunks[index++]
      controller.enqueue(typeof chunk === 'string' ? encoder.encode(chunk) : chunk)
    },
  })
}

async function collect(chunks) {
  const out = []
  for await (const frame of readSse(streamFromChunks(chunks))) {
    const payload = parseSseFrame(frame)
    if (payload !== null) out.push(payload)
  }
  return out
}

const cases = []

function test(name, fn) {
  cases.push({ name, fn })
}

test('parses back-to-back frames', async () => {
  assert.deepEqual(await collect(['data: {"a":1}\n\n', 'data: {"b":2}\n\n']), ['{"a":1}', '{"b":2}'])
})

test('reassembles a frame split across chunks', async () => {
  assert.deepEqual(await collect(['data: {"he', 'llo":"wor', 'ld"}\n\n']), ['{"hello":"world"}'])
})

test('reassembles multi-byte characters split across chunks', async () => {
  const bytes = new TextEncoder().encode('data: {"t":"duty — § 1714 🔥"}\n\n')
  const chunks = []
  for (let i = 0; i < bytes.length; i += 3) chunks.push(bytes.slice(i, i + 3))
  assert.deepEqual(await collect(chunks), ['{"t":"duty — § 1714 🔥"}'])
})

test('accepts CRLF line endings', async () => {
  assert.deepEqual(await collect(['data: {"x":1}\r\n\r\n']), ['{"x":1}'])
})

test('flushes a trailing frame with no blank line', async () => {
  assert.deepEqual(await collect(['data: 1\n\ndata: 2\n\ndata: 3']), ['1', '2', '3'])
})

test('ignores comments and non-data frames', async () => {
  assert.deepEqual(await collect([': keep-alive\n\n', 'data: ok\n\n']), ['ok'])
})

test('joins multiple data: lines in one frame', async () => {
  assert.equal(parseSseFrame('data: one\ndata: two'), 'one\ntwo')
})

test('returns null when a frame carries no data', async () => {
  assert.equal(parseSseFrame('event: ping'), null)
})

let failures = 0
for (const { name, fn } of cases) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures++
    console.log(`  FAIL ${name} — ${error.message}`)
  }
}

console.log(`\n${cases.length - failures} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
