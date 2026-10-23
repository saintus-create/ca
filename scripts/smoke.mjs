#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 * Starts the production server against local stand-ins for every third-party
 * API this app calls (Sarvam, Firecrawl, Cartesia), then exercises the real
 * routes the browser uses: a full research run over SSE, the corpus, follow-up
 * questions, and voice in both directions — plus the failure modes that matter
 * (bad key, upstream 500, missing key) so a broken deploy surfaces here rather
 * than in front of a user.
 *
 * Usage:
 *   npm run build && npm run smoke
 *
 * Node runs this with --experimental-strip-types so it can import lib/sse.ts,
 * the same parser the browser uses — the point is to exercise the client's
 * streaming path against the real server, not a reimplementation of it.
 *
 * Nothing here talks to the internet: every upstream is a local server, which
 * is also why it can run in CI without secrets.
 */

import http from 'node:http'
import { readSse, parseSseFrame } from '../lib/sse.ts'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const APP_PORT = Number(process.env.SMOKE_PORT || 3310)
const SARVAM_PORT = 4010
const FIRECRAWL_PORT = 4011
const CARTESIA_PORT = 4012

const APP = `http://127.0.0.1:${APP_PORT}`

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
// Fake Sarvam (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

const sarvam = {
  mode: 'ok',
  calls: 0,
  lastBody: null,
}

function startSarvam() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    if (url.pathname === '/__mode') {
      sarvam.mode = url.searchParams.get('mode') || 'ok'
      sarvam.calls = 0
      res.writeHead(200).end('ok')
      return
    }

    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      if (sarvam.mode === 'auth') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'invalid api key' } }))
        return
      }
      if (sarvam.mode === 'boom') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'upstream exploded' } }))
        return
      }

      sarvam.calls++
      sarvam.lastBody = JSON.parse(raw || '{}')

      if (sarvam.mode === 'empty') {
        respond({ choices: [{ message: { content: null } }] })
        return
      }

      if (sarvam.mode === 'slow') {
        // Hold each turn long enough that an abort lands mid-run.
        setTimeout(() => respond({ choices: [{ message: { content: 'partial answer' } }] }), 250)
        return
      }

      if (sarvam.mode === 'followup') {
        respond({
          choices: [
            {
              message: {
                reasoning_content: 'Five angles.',
                content: '```json\n["What is the duty of care?", "How is breach proven?", "What damages are recoverable?", "When does comparative fault apply?", "What is the statute of limitations?"]\n```',
              },
            },
          ],
        })
        return
      }

      // Scripted research run: web search -> corpus search -> final answer.
      if (sarvam.calls === 1) {
        respond({
          choices: [
            {
              message: {
                reasoning_content: 'I should search the web first.',
                content: null,
                tool_calls: [
                  {
                    id: 'call_web',
                    type: 'function',
                    function: {
                      name: 'web_search',
                      arguments: JSON.stringify({ query: 'california negligence elements', limit: 2 }),
                    },
                  },
                ],
              },
            },
          ],
        })
        return
      }

      if (sarvam.calls === 2) {
        respond({
          choices: [
            {
              message: {
                reasoning_content: 'Now check the statute itself.',
                content: null,
                tool_calls: [
                  {
                    id: 'call_corpus',
                    type: 'function',
                    function: {
                      name: 'search_california_law',
                      arguments: JSON.stringify({ query: 'negligence', dataset: 'CIV', limit: 2 }),
                    },
                  },
                ],
              },
            },
          ],
        })
        return
      }

      respond({
        choices: [
          {
            message: {
              reasoning_content: 'I have enough to answer.',
              content: [
                '## Elements of negligence',
                '',
                'California requires duty, breach, causation and damages [1].',
                '',
                '- Duty',
                '- Breach',
                '',
                '```ts',
                'const x = 1',
                '```',
                '',
                'See also [2].',
              ].join('\n'),
            },
          },
        ],
      })
    })

    function respond(payload) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload))
    }
  })

  return listen(server, SARVAM_PORT, 'fake Sarvam')
}

// ---------------------------------------------------------------------------
// Fake Firecrawl
// ---------------------------------------------------------------------------

const firecrawl = { mode: 'ok', lastAuth: null, auths: [] }

function startFirecrawl() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    firecrawl.lastAuth = req.headers.authorization || null
    if (!url.pathname.startsWith('/__mode') && url.pathname !== '/') firecrawl.auths.push(firecrawl.lastAuth)

    if (url.pathname === '/__mode') {
      firecrawl.mode = url.searchParams.get('mode') || 'ok'
      res.writeHead(200).end('ok')
      return
    }

    if (firecrawl.mode === 'boom') {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'search backend unavailable' }))
      return
    }

    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => {
      if (url.pathname.endsWith('/search')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            data: [
              {
                url: 'https://example.gov/negligence',
                title: 'Negligence in California',
                description: 'An overview of the elements of negligence.',
                markdown: '# Negligence\n\nDuty, breach, causation, damages. Published June 12, 2025.',
                metadata: { title: 'Negligence in California', description: 'An overview.' },
                screenshot: 'data:image/png;base64,iVBORw0KGgo=',
              },
              {
                url: 'https://example.gov/duty',
                title: 'Duty of care',
                description: 'When a duty exists.',
                markdown: '# Duty\n\nA duty arises from statute or relationship.',
                metadata: { title: 'Duty of care' },
              },
            ],
          })
        )
        return
      }

      if (url.pathname.endsWith('/scrape')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            data: {
              markdown: '# Scraped page\n\nSome content.',
              links: ['https://example.gov/blog/one'],
              metadata: { title: 'Scraped page', description: 'A page' },
              screenshot: 'data:image/png;base64,iVBORw0KGgo=',
            },
          })
        )
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'not found' }))
    })
  })

  return listen(server, FIRECRAWL_PORT, 'fake Firecrawl')
}

// ---------------------------------------------------------------------------
// Fake Cartesia
// ---------------------------------------------------------------------------

const cartesia = { mode: 'ok', lastTts: null, lastSttBytes: 0 }

const VOICES = [
  {
    id: 'voice-aaa',
    name: 'Brooke',
    tagline: 'Warm, conversational',
    gender: 'feminine',
    language: 'en',
    preview_file_url: `http://127.0.0.1:${CARTESIA_PORT}/preview/voice-aaa.mp3`,
    is_owner: false,
  },
  {
    id: 'voice-bbb',
    name: 'Ronald',
    tagline: 'Deep narrator',
    gender: 'masculine',
    language: 'en',
    preview_file_url: null,
    is_owner: false,
  },
]

const MP3_FRAME = Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Buffer.alloc(413, 0)])

function startCartesia() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    if (url.pathname === '/__mode') {
      cartesia.mode = url.searchParams.get('mode') || 'ok'
      res.writeHead(200).end('ok')
      return
    }

    if (cartesia.mode === 'auth' && !url.pathname.startsWith('/preview/')) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid api key' }))
      return
    }

    if (url.pathname === '/voices') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ data: VOICES, has_more: false, next_page: null }))
      return
    }

    if (url.pathname.startsWith('/preview/')) {
      res.writeHead(200, { 'Content-Type': 'audio/wav' })
      res.end(Buffer.alloc(44))
      return
    }

    if (url.pathname === '/tts/bytes' && req.method === 'POST') {
      let raw = ''
      req.on('data', (chunk) => (raw += chunk))
      req.on('end', () => {
        cartesia.lastTts = JSON.parse(raw || '{}')
        res.writeHead(200, { 'Content-Type': 'audio/mpeg' })
        // Stream in frames so the proxy path is exercised, not a single blob.
        let sent = 0
        const timer = setInterval(() => {
          if (sent++ === 4) {
            clearInterval(timer)
            res.end()
            return
          }
          res.write(MP3_FRAME)
        }, 10)
      })
      return
    }

    if (url.pathname === '/stt' && req.method === 'POST') {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        cartesia.lastSttBytes = Buffer.concat(chunks).length
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ type: 'transcript', text: 'what is negligence', language: 'en', duration: 2.5 }))
      })
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  return listen(server, CARTESIA_PORT, 'fake Cartesia')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listen(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      console.log(`  ${label} on ${port}`)
      resolve(server)
    })
  })
}

function portInUse(port) {
  return new Promise((resolve) => {
    const probe = http.createServer()
    probe.once('error', (error) => resolve(error.code === 'EADDRINUSE'))
    probe.once('listening', () => probe.close(() => resolve(false)))
    probe.listen(port, '127.0.0.1')
  })
}

async function waitForApp(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP}/`, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // not up yet
    }
    await sleep(500)
  }
  return false
}

// The route wraps research events as { type: 'event', event: {...} } and
// sends response/error/done flat. Flatten so assertions read the same shape
// the browser uses after unwrapping.
// Splits a byte stream into fixed-size pieces so every frame boundary lands
// somewhere awkward.
function rechunk(size) {
  let pending = new Uint8Array(0)
  return new TransformStream({
    transform(chunk, controller) {
      const merged = new Uint8Array(pending.length + chunk.length)
      merged.set(pending)
      merged.set(chunk, pending.length)
      let offset = 0
      while (merged.length - offset >= size) {
        controller.enqueue(merged.slice(offset, offset + size))
        offset += size
      }
      pending = merged.slice(offset)
    },
    flush(controller) {
      if (pending.length) controller.enqueue(pending)
    },
  })
}

function parseSse(text) {
  const events = []
  for (const block of text.split('\n\n')) {
    const line = block.split('\n').find((l) => l.startsWith('data: '))
    if (!line) continue
    try {
      const parsed = JSON.parse(line.slice(6))
      events.push(parsed.type === 'event' && parsed.event ? parsed.event : parsed)
    } catch {
      // ignore keep-alives / partial frames
    }
  }
  return events
}

async function postJson(path, body, headers = {}) {
  return fetch(`${APP}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync('.next/BUILD_ID')) {
    console.error('No production build found. Run `npm run build` first.')
    process.exit(1)
  }

  // A server left over from an earlier run would answer this run's requests
  // with stale code, which is worse than failing: it looks like a pass.
  if (await portInUse(APP_PORT)) {
    console.error(`Port ${APP_PORT} is already in use. Stop that server or set SMOKE_PORT.`)
    process.exit(1)
  }

  console.log('Starting local stand-ins:')
  const servers = await Promise.all([startSarvam(), startFirecrawl(), startCartesia()])
  const servers_list = [...servers]

  console.log('\nStarting server:')
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(APP_PORT), '-H', '127.0.0.1'], {
    detached: true,
    env: {
      ...process.env,
      SARVAM_API_KEY: 'sk_test_sarvam',
      SARVAM_BASE_URL: `http://127.0.0.1:${SARVAM_PORT}/v1`,
      FIRECRAWL_API_KEY: 'fc_test_key',
      FIRECRAWL_BASE_URL: `http://127.0.0.1:${FIRECRAWL_PORT}`,
      CARTESIA_API_KEY: 'sk_test_cartesia',
      CARTESIA_BASE_URL: `http://127.0.0.1:${CARTESIA_PORT}`,
      LLM_MAX_STEPS: '6',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverLog = ''
  app.stdout.on('data', (chunk) => (serverLog += chunk))
  app.stderr.on('data', (chunk) => (serverLog += chunk))

  const stopApp = () => {
    if (app.exitCode !== null) return
    try {
      // Negative pid: the whole process group, so no orphan holds the port.
      process.kill(-app.pid, 'SIGTERM')
    } catch {
      app.kill('SIGTERM')
    }
  }

  const cleanup = () => {
    stopApp()
    for (const server of servers_list) server.close()
  }
  process.on('exit', cleanup)

  try {
    if (!(await waitForApp())) {
      console.error('Server never became ready.\n' + serverLog.slice(-2000))
      process.exit(1)
    }
    console.log(`  ready on ${APP_PORT}`)

    // ---------------------------------------------------------------------
    section('Research run (SSE)')
    const research = await postJson('/api/open-researcher', { query: 'elements of negligence in california' })
    check('status 200', research.status === 200, `got ${research.status}`)
    check(
      'content-type is event-stream',
      (research.headers.get('content-type') || '').includes('text/event-stream'),
      research.headers.get('content-type') || 'none'
    )
    const sseText = await research.text()
    const events = parseSse(sseText)
    const types = events.map((event) => event.type)
    check('emits start', types.includes('start'), types.join(','))
    check('emits thinking', types.includes('thinking'))
    check('emits tool_call', types.includes('tool_call'))
    check('emits tool_result', types.includes('tool_result'))
    check('emits response', types.includes('response'))
    check('ends with done', types[types.length - 1] === 'done', types.slice(-3).join(','))

    const toolResult = events.find((event) => event.type === 'tool_result' && event.tool === 'web_search')
    check('web_search returned content', Boolean(toolResult?.result?.includes('Negligence')), String(toolResult?.result).slice(0, 80))
    check('web_search captured screenshots', Array.isArray(toolResult?.screenshots))

    const corpusResult = events.find((event) => event.type === 'tool_result' && event.tool === 'search_california_law')
    check(
      'corpus tool returned statute text',
      Boolean(corpusResult?.result && !corpusResult.result.startsWith('Error')),
      String(corpusResult?.result).slice(0, 80)
    )

    const answer = events.filter((event) => event.type === 'response').map((event) => event.content).join('\n')
    check('answer is non-empty', answer.length > 20, `${answer.length} chars`)
    check('answer kept markdown', answer.includes('## Elements of negligence'))
    check('answer kept citations', answer.includes('[1]'))

    // Replay the same request with the response body chopped into 7-byte
    // pieces, the way a real network delivers it, and parse with the client's
    // own reader. A frame or multi-byte character split mid-flight must not
    // lose an event.
    // Reset the scripted model so it replays the same tool-calling run.
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)
    const fragmented = await postJson('/api/open-researcher', { query: 'elements of negligence in california' })
    const fragmentedEvents = []
    for await (const frame of readSse(fragmented.body.pipeThrough(rechunk(7)))) {
      const payload = parseSseFrame(frame)
      if (!payload) continue
      try {
        const parsed = JSON.parse(payload)
        fragmentedEvents.push(parsed.type === 'event' && parsed.event ? parsed.event : parsed)
      } catch {
        // a keep-alive or non-JSON frame
      }
    }
    const fragmentedTypes = fragmentedEvents.map((event) => event.type)
    check(
      'fragmented stream yields the same events',
      fragmentedTypes.join(',') === types.join(','),
      `${fragmentedTypes.join(',')} vs ${types.join(',')}`
    )
    // The route sends the answer twice (once as a run event, once as the final
    // response), so compare the last response payload rather than a join.
    const finalAnswers = (list) =>
      list.filter((event) => event.type === 'response').map((event) => event.content).pop() || ''
    check(
      'fragmented stream keeps the answer intact',
      finalAnswers(fragmentedEvents) === finalAnswers(events),
      `${finalAnswers(fragmentedEvents).length} vs ${finalAnswers(events).length} chars`
    )

    // Per-request Firecrawl key: the UI can supply one, and it must be used
    // for that request only, never written into shared state.
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)
    const keyed = await postJson(
      '/api/open-researcher',
      { query: 'anything' },
      { 'X-Firecrawl-API-Key': 'fc_from_the_ui' }
    )
    await keyed.text()
    check(
      'per-request Firecrawl key reaches the tool',
      String(firecrawl.lastAuth || '').includes('fc_from_the_ui'),
      `${firecrawl.lastAuth} | seen: ${firecrawl.auths.join(',')}`
    )

    // And it must not leak into the next request, which has no header.
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)
    const unkeyed = await postJson('/api/open-researcher', { query: 'anything' })
    await unkeyed.text()
    check(
      'request key does not leak to the next request',
      String(firecrawl.lastAuth || '').includes('fc_test_key'),
      String(firecrawl.lastAuth)
    )

    check('model received tools', Array.isArray(sarvam.lastBody?.tools) && sarvam.lastBody.tools.length >= 3)
    check('model received tool results', JSON.stringify(sarvam.lastBody?.messages || []).includes('California Legislative Information'))

    // ---------------------------------------------------------------------
    section('Corpus')
    const corpus = await fetch(`${APP}/api/corpus-search?q=negligence&dataset=CIV&limit=3`)
    const corpusBody = await corpus.json()
    check('status 200', corpus.status === 200)
    check('returns hits', Array.isArray(corpusBody.hits) && corpusBody.hits.length > 0, `${corpusBody.count} hits`)
    const missing = await fetch(`${APP}/api/corpus-search`)
    check('rejects missing query', missing.status === 400, String(missing.status))

    // ---------------------------------------------------------------------
    section('Follow-up questions')
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=followup`)
    const followUp = await postJson('/api/open-researcher/follow-up', { query: 'california negligence' })
    const followUpBody = await followUp.json()
    check('status 200', followUp.status === 200, String(followUp.status))
    check('returns five questions', Array.isArray(followUpBody.questions) && followUpBody.questions.length === 5, `${followUpBody.questions?.length} questions`)
    check('tolerates a json code fence', String(followUpBody.questions?.[0] || '').includes('duty of care'))
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)

    // ---------------------------------------------------------------------
    section('Voice')
    const voices = await fetch(`${APP}/api/voice/voices`)
    const voicesBody = await voices.json()
    check('voice list 200', voices.status === 200)
    check('voice list non-empty', Array.isArray(voicesBody.voices) && voicesBody.voices.length === 2)
    check('default voice resolved', voicesBody.defaultVoiceId === 'voice-aaa', String(voicesBody.defaultVoiceId))

    const tts = await postJson('/api/voice/tts', { text: '## Title\n\nRead **this** aloud [1].', voiceId: 'voice-bbb', speed: 1.25 })
    const audioBytes = (await tts.arrayBuffer()).byteLength
    check('tts 200', tts.status === 200, String(tts.status))
    check('tts content-type is audio', (tts.headers.get('content-type') || '').startsWith('audio/'), tts.headers.get('content-type') || '')
    check('tts returned audio', audioBytes > 0, `${audioBytes} bytes`)
    check('tts used requested voice', cartesia.lastTts?.voice === 'voice-bbb', String(cartesia.lastTts?.voice))
    check('tts used requested speed', cartesia.lastTts?.generation_config?.speed === 1.25, String(cartesia.lastTts?.generation_config?.speed))
    check('tts stripped markdown', !String(cartesia.lastTts?.transcript || '').includes('**'))
    check('tts stripped citations', !String(cartesia.lastTts?.transcript || '').includes('[1]'))

    const form = new FormData()
    form.append('audio', new Blob([new Uint8Array(1500)], { type: 'audio/webm' }), 'query.webm')
    const stt = await fetch(`${APP}/api/voice/stt`, { method: 'POST', body: form })
    const sttBody = await stt.json()
    check('stt 200', stt.status === 200, String(stt.status))
    check('stt returned text', sttBody.text === 'what is negligence', String(sttBody.text))
    check('stt forwarded audio', cartesia.lastSttBytes > 0, `${cartesia.lastSttBytes} bytes`)

    const preview = await fetch(`${APP}/api/voice/preview?voiceId=voice-aaa`)
    check('preview 200', preview.status === 200, String(preview.status))
    const previewUnknown = await fetch(`${APP}/api/voice/preview?voiceId=does-not-exist`)
    check('preview rejects unknown voice', previewUnknown.status === 404, String(previewUnknown.status))

    // ---------------------------------------------------------------------
    section('Cancellation')
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=slow`)
    const controller = new AbortController()
    const inFlight = await fetch(`${APP}/api/open-researcher`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'a long research run' }),
      signal: controller.signal,
    })
    const reader = inFlight.body.getReader()
    await reader.read() // first frame arrived; the run is under way
    controller.abort()
    await sleep(150)
    const callsAtAbort = sarvam.calls
    await sleep(1200)
    check('aborted run stops calling the model', sarvam.calls === callsAtAbort, `${callsAtAbort} -> ${sarvam.calls}`)
    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)

    // ---------------------------------------------------------------------
    section('Failure modes')

    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=auth`)
    const authFail = await postJson('/api/open-researcher', { query: 'anything' })
    const authEvents = parseSse(await authFail.text())
    const authError = authEvents.find((event) => event.type === 'error')
    check('bad LLM key surfaces an error event', Boolean(authError))
    check(
      'error names the key variable',
      /SARVAM_API_KEY|key/i.test(authError?.error || ''),
      String(authError?.error).slice(0, 120)
    )

    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=boom`)
    const boom = await postJson('/api/open-researcher', { query: 'anything' })
    const boomEvents = parseSse(await boom.text())
    check('upstream 500 surfaces an error event', boomEvents.some((event) => event.type === 'error'))

    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=empty`)
    const empty = await postJson('/api/open-researcher', { query: 'anything' })
    const emptyEvents = parseSse(await empty.text())
    const terminal = emptyEvents.some((event) => event.type === 'done' || event.type === 'error')
    check('empty model reply still terminates', terminal, emptyEvents.map((e) => e.type).join(','))

    await fetch(`http://127.0.0.1:${SARVAM_PORT}/__mode?mode=ok`)
    await fetch(`http://127.0.0.1:${FIRECRAWL_PORT}/__mode?mode=boom`)
    const firecrawlFail = await postJson('/api/open-researcher', { query: 'anything' })
    const firecrawlEvents = parseSse(await firecrawlFail.text())
    check(
      'search failure does not break the run',
      firecrawlEvents.some((event) => event.type === 'done'),
      firecrawlEvents.map((e) => e.type).join(',')
    )
    await fetch(`http://127.0.0.1:${FIRECRAWL_PORT}/__mode?mode=ok`)

    await fetch(`http://127.0.0.1:${CARTESIA_PORT}/__mode?mode=auth`)
    const ttsAuth = await postJson('/api/voice/tts', { text: 'hello' })
    check('bad voice key passes through 401', ttsAuth.status === 401, String(ttsAuth.status))
    await fetch(`http://127.0.0.1:${CARTESIA_PORT}/__mode?mode=ok`)

    const badJson = await fetch(`${APP}/api/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    check('malformed body rejected', badJson.status === 400, String(badJson.status))

    const emptyText = await postJson('/api/voice/tts', { text: '   ' })
    check('empty text rejected', emptyText.status === 400, String(emptyText.status))
  } finally {
    stopApp()
    // Give the port a moment to come back before a repeat run.
    for (let i = 0; i < 20 && (await portInUse(APP_PORT)); i++) await sleep(100)
    for (const server of servers_list) server.close()
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\nSmoke run crashed:', error)
  process.exit(1)
})
