#!/usr/bin/env node
/**
 * Unit tests for lib/chat-stream.ts — the reducer that turns the research
 * route's SSE payloads into one assistant turn (reasoning, tool calls,
 * sources, answer).
 *
 * The last case is the one that matters most: the same stream is fed whole and
 * fed in 5-byte pieces, and both must produce the identical turn. That is the
 * path the chat actually takes, because network chunks have nothing to do with
 * frame boundaries.
 *
 *   npm run test:chat
 */

import assert from 'node:assert/strict'
import { readSse, parseSseFrame } from '../lib/sse.ts'
import {
  applyResearchPayload,
  createResearchTurn,
  parseSearchResults,
  turnParts,
} from '../lib/chat-stream.ts'

const LABELS = {
  search_california_law: 'California Law',
  web_search: 'Web Search',
}
const label = (tool) => LABELS[tool] || 'Research Step'

function frame(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function event(inner) {
  return frame({ type: 'event', event: inner })
}

const WEB_RESULTS = [
  '[1] Negligence in California',
  'URL: https://example.gov/negligence',
  'Description: An overview of the elements of negligence.',
  '',
  '[2] Duty of care',
  'URL: https://example.gov/duty',
  '',
].join('\n')

const CORPUS_RESULTS = [
  '[1] Cal. Civ. Code § 1714 - Responsibility for willful acts',
  'Source: https://leginfo.legislature.ca.gov/civ/1714',
  'Description: Everyone is responsible for injury caused by want of ordinary care.',
].join('\n')

/** A full run, the way the route emits it. */
const STREAM = [
  event({ type: 'start', query: 'elements of negligence' }),
  event({ type: 'thinking', number: 1, content: 'I should search the web first.' }),
  event({ type: 'tool_call', number: 1, tool: 'web_search', parameters: { query: 'negligence', limit: 2 } }),
  event({ type: 'tool_result', number: 1, tool: 'web_search', result: WEB_RESULTS }),
  event({ type: 'thinking', number: 2, content: 'Now check the statute itself.' }),
  event({ type: 'tool_call', number: 2, tool: 'search_california_law', parameters: { query: 'negligence' } }),
  event({ type: 'tool_result', number: 2, tool: 'search_california_law', result: CORPUS_RESULTS }),
  event({ type: 'response', content: 'A draft answer that the final response replaces.' }),
  event({ type: 'summary', thinkingBlocks: 2, toolCalls: 2 }),
  frame({ type: 'response', content: '## Elements of negligence\n\nDuty, breach, causation, damages [1].' }),
  frame({ type: 'done' }),
].join('')

async function reduceStream(chunks) {
  const turn = createResearchTurn()
  const encoder = new TextEncoder()
  let index = 0
  const body = new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index++]))
    },
  })
  for await (const raw of readSse(body)) {
    const payload = parseSseFrame(raw)
    if (payload === null) continue
    applyResearchPayload(turn, payload, label)
  }
  return turn
}

const cases = []
function test(name, fn) {
  cases.push({ name, fn })
}

test('accumulates reasoning as separate steps', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(turn, JSON.stringify({ type: 'event', event: { type: 'thinking', content: 'First.' } }), label)
  applyResearchPayload(turn, JSON.stringify({ type: 'event', event: { type: 'thinking', content: 'Second.' } }), label)
  assert.equal(turn.reasoning, 'First.\nSecond.')
})

test('pairs a tool result with the call it belongs to', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_call', tool: 'web_search', parameters: { query: 'x' } } }),
    label,
  )
  assert.equal(turn.toolCalls.length, 1)
  assert.equal(turn.toolCalls[0].name, 'Web Search')
  assert.equal(turn.toolCalls[0].result, undefined)
  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_result', tool: 'web_search', result: 'found it' } }),
    label,
  )
  assert.equal(turn.toolCalls[0].result, 'found it')
  assert.deepEqual(turn.toolCalls[0].args, { query: 'x' })
})

test('truncates long tool results for display', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(turn, JSON.stringify({ type: 'event', event: { type: 'tool_call', tool: 'web_search' } }), label)
  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_result', tool: 'web_search', result: 'x'.repeat(2000) } }),
    label,
  )
  assert.equal(turn.toolCalls[0].result.length, 603)
  assert.ok(turn.toolCalls[0].result.endsWith('...'))
})

test('parses sources from web and corpus results', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_result', tool: 'web_search', result: WEB_RESULTS } }),
    label,
  )
  assert.equal(turn.sources.length, 2)
  assert.equal(turn.sources[0].title, 'Negligence in California')
  assert.equal(turn.sources[0].url, 'https://example.gov/negligence')
  assert.equal(turn.sources[1].url, 'https://example.gov/duty')

  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_result', tool: 'search_california_law', result: CORPUS_RESULTS } }),
    label,
  )
  assert.equal(turn.sources.length, 1)
  assert.ok(turn.sources[0].title.includes('1714'))
  assert.equal(turn.sources[0].url, 'https://leginfo.legislature.ca.gov/civ/1714')
})

test('ignores results from tools that are not sources', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(
    turn,
    JSON.stringify({ type: 'event', event: { type: 'tool_result', tool: 'deep_scrape', result: WEB_RESULTS } }),
    label,
  )
  assert.equal(turn.sources.length, 0)
})

test('keeps titles out of the description slot', async () => {
  assert.deepEqual(parseSearchResults(''), [])
  const parsed = parseSearchResults('[1] Title\nURL: https://x.test')
  assert.equal(parsed[0].title, 'Title')
  assert.equal(parsed[0].description, undefined)
})

test('shows a step answer while the run is still going', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(turn, JSON.stringify({ type: 'event', event: { type: 'response', content: 'partial text' } }), label)
  assert.equal(turn.text, 'partial text')
  applyResearchPayload(turn, JSON.stringify({ type: 'response', content: 'final text' }), label)
  assert.equal(turn.text, 'final text')
})

test('records an error payload', async () => {
  const turn = createResearchTurn()
  applyResearchPayload(turn, JSON.stringify({ type: 'error', error: 'SARVAM_API_KEY is not configured' }), label)
  assert.equal(turn.error, 'SARVAM_API_KEY is not configured')

  const original = createResearchTurn()
  applyResearchPayload(original, JSON.stringify({ type: 'error', originalError: 'upstream exploded' }), label)
  assert.equal(original.error, 'upstream exploded')
})

test('ignores frames the UI does not render', async () => {
  const turn = createResearchTurn()
  assert.equal(applyResearchPayload(turn, 'not json', label), false)
  assert.equal(applyResearchPayload(turn, 'null', label), false)
  assert.equal(applyResearchPayload(turn, JSON.stringify({ type: 'start', query: 'q' }), label), false)
  assert.equal(applyResearchPayload(turn, JSON.stringify({ type: 'summary' }), label), false)
  assert.equal(applyResearchPayload(turn, JSON.stringify({ type: 'done' }), label), false)
  assert.equal(turn.done, true)
  assert.equal(applyResearchPayload(turn, 'data: {"type":"event"}', label), false)
})

test('turnParts orders steps, tool calls, then the answer', async () => {
  const turn = await reduceStream([STREAM])
  const parts = turnParts(turn)
  assert.deepEqual(
    parts.map((part) => part.type),
    ['reasoning', 'tool-call', 'tool-call', 'text'],
  )
  assert.equal(parts[0].text, 'I should search the web first.\nNow check the statute itself.')
  assert.equal(parts[1].toolName, 'Web Search')
  assert.ok(parts[1].result.includes('Negligence in California'))
  assert.ok(parts[3].text.startsWith('## Elements of negligence'))
})

test('turnParts omits empty sections', async () => {
  assert.deepEqual(turnParts(createResearchTurn()), [])
  const turn = createResearchTurn()
  applyResearchPayload(turn, JSON.stringify({ type: 'response', content: 'only text' }), label)
  assert.deepEqual(turnParts(turn).map((part) => part.type), ['text'])
})

test('a stream split into 5-byte pieces reduces to the same turn', async () => {
  const whole = await reduceStream([STREAM])
  const chunks = []
  const bytes = new TextEncoder().encode(STREAM)
  for (let i = 0; i < bytes.length; i += 5) chunks.push(new TextDecoder().decode(bytes.slice(i, i + 5)))
  const split = await reduceStream(chunks)
  assert.deepEqual(split, whole)
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
