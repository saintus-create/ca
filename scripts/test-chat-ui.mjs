#!/usr/bin/env node
/**
 * Browser-level test of the chat screen.
 *
 * The research routes have a smoke test; this covers the other half: the
 * assistant-ui screen that actually talks to them. The real components are
 * bundled with esbuild for the browser platform and mounted in jsdom, so the
 * assistant-ui runtime, the composer, the SSE reader and the message
 * renderer run as they do for a visitor — only the network is faked.
 *
 * What it pins down:
 *   - the empty state (assistant-ui suggestions), and a composer that stays
 *     disabled until you type
 *   - a send reaching /api/open-researcher with the typed text and the scope
 *   - a stream split into 3-byte pieces still rendering the whole answer
 *   - reasoning, tool calls, markdown and citations all on screen
 *   - Stop cancelling a run and keeping what had already streamed
 *   - Regenerate re-asking the same question without duplicating it
 *   - editing a question re-asking from that point
 *   - a failing deployment showing the plain-language error card
 *   - threads surviving a reload (localStorage) and "New thread"
 *   - voice out: Listen streaming Cartesia TTS with the chosen voice and
 *     speed, and Stop interrupting it
 *   - voice in: dictation through the browser recogniser, and through
 *     Cartesia Ink when the browser has none
 *   - both buttons turning off when the deployment and browser cannot do voice
 *
 *   npm run test:ui
 */

import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'

// Built into the system temp dir: it is generated output, not a source file.
const BUNDLE = path.join(tmpdir(), 'ca-assistant-ui-harness', 'ui-harness.mjs')

const MANIFEST = {
  datasets: [
    { file: 'codes/CIV.jsonl.gz', rows: 1200 },
    { file: 'codes/LAB.jsonl.gz', rows: 900 },
  ],
}

const WEB_RESULTS = [
  '[1] Negligence in California',
  'URL: https://example.gov/negligence',
  'Description: An overview of the elements of negligence.',
].join('\n')

function frame(payload) {
  return `data: ${JSON.stringify(payload)}\n\n`
}

function event(inner) {
  return frame({ type: 'event', event: inner })
}

/** The frames the research route emits for a normal run. */
const RUN_FRAMES = [
  event({ type: 'start', query: 'elements of negligence' }),
  event({ type: 'thinking', number: 1, content: 'I should search the web first.' }),
  event({ type: 'tool_call', number: 1, tool: 'web_search', parameters: { query: 'negligence' } }),
  event({ type: 'tool_result', number: 1, tool: 'web_search', result: WEB_RESULTS }),
  frame({ type: 'response', content: '## Elements of negligence\n\nThe answer cites [1].' }),
  frame({ type: 'done' }),
]

// ---------------------------------------------------------------------------
// jsdom + the bundled app
// ---------------------------------------------------------------------------

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  })
  const { window } = dom

  const expose = (key, value) =>
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })

  expose('window', window)
  expose('document', window.document)
  expose('navigator', window.navigator)
  for (const key of [
    'HTMLElement',
    'HTMLTextAreaElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'Element',
    'Node',
    'Event',
    'KeyboardEvent',
    'MouseEvent',
    'CustomEvent',
    'PointerEvent',
    'MutationObserver',
    'DOMRect',
    'DocumentFragment',
    'Text',
    'NodeFilter',
    'HTMLDivElement',
    'localStorage',
  ]) {
    expose(key, window[key])
  }
  expose('getComputedStyle', window.getComputedStyle.bind(window))

  // jsdom implements neither object URLs nor Web Audio playback, and tests
  // never read the bytes back, so a stub URL is enough.
  window.URL.createObjectURL = () => 'blob:ca-test'
  window.URL.revokeObjectURL = () => {}
  expose('URL', window.URL)

  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  expose('ResizeObserver', Observer)
  expose('IntersectionObserver', Observer)
  window.ResizeObserver = Observer
  window.IntersectionObserver = Observer
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
  window.scrollTo = () => {}
  window.Element.prototype.scrollTo = () => {}
  window.Element.prototype.scrollIntoView = () => {}

  // Radix and assistant-ui animate through rAF; expose jsdom's on the global.
  expose('requestAnimationFrame', (callback) => window.setTimeout(() => callback(Date.now()), 16))
  expose('cancelAnimationFrame', (handle) => window.clearTimeout(handle))

  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  return window
}

async function bundle() {
  mkdirSync(path.dirname(BUNDLE), { recursive: true })
  await build({
    entryPoints: ['scripts/ui-harness-entry.tsx'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    alias: { '@': '.' },
    define: { 'process.env.NODE_ENV': '"test"' },
    outfile: BUNDLE,
    logLevel: 'error',
  })
  return import(pathToFileURL(BUNDLE).href)
}

// ---------------------------------------------------------------------------
// Fake network
// ---------------------------------------------------------------------------

const network = {
  requests: [],
  /** Returns the Response for /api/open-researcher. */
  research: null,
  /**
   * What the fake deployment can do. `configured` is what /api/voice/status
   * reports (a Cartesia key); with it off, Listen falls back to browser speech
   * and dictation needs the browser recogniser.
   */
  voice: {
    configured: true,
    /** When false, playback never ends on its own (so Stop can be tested). */
    autoEnd: true,
    /** Answer that /api/voice/stt gives back. */
    sttText: 'what is negligence',
  },
  /** Fake <audio> elements created by the speech adapter, newest last. */
  audio: [],
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * An SSE response that delivers `text` in `chunkSize`-byte pieces, pausing
 * between them so the test can observe a run in progress, and failing the
 * stream the way a real one does when the request is aborted.
 */
function sseResponse(text, { chunkSize = 7, delayMs = 0, signal } = {}) {
  const bytes = new TextEncoder().encode(text)
  const stream = new ReadableStream({
    async start(controller) {
      let aborted = false
      signal?.addEventListener('abort', () => {
        aborted = true
        try {
          controller.error(Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' }))
        } catch {
          /* already closed */
        }
      })
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        if (aborted) return
        if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs))
        try {
          controller.enqueue(bytes.slice(offset, offset + chunkSize))
        } catch {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      if (!aborted) controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function installFetch() {
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url)
    // JSON bodies are logged parsed; a recording is a FormData and is kept as is.
    const body =
      typeof init.body === 'string' ? JSON.parse(init.body) : init.body instanceof FormData ? init.body : null
    network.requests.push({ url: target, init, body })
    if (target.includes('/corpus/manifest.json')) return jsonResponse(MANIFEST)

    if (target.includes('/api/open-researcher')) {
      if (!network.research) return jsonResponse({ error: 'no research responder installed' }, 500)
      return network.research(init)
    }

    if (target.includes('/api/voice/status')) {
      const configured = network.voice.configured
      return jsonResponse({
        configured,
        speech: configured || typeof window.speechSynthesis !== 'undefined',
        transcription: configured,
        defaultVoiceId: configured ? 'voice-aaa' : null,
      })
    }

    if (target.includes('/api/voice/voices')) {
      if (!network.voice.configured) {
        return jsonResponse({ error: 'Voice is not configured.', voices: [] }, 503)
      }
      return jsonResponse({
        voices: [
          { id: 'voice-aaa', name: 'Brooke', tagline: 'Warm, conversational', gender: 'feminine', language: 'en', previewUrl: '/api/voice/preview?voiceId=voice-aaa' },
          { id: 'voice-bbb', name: 'Ronald', tagline: 'Deep narrator', gender: 'masculine', language: 'en', previewUrl: null },
        ],
        defaultVoiceId: 'voice-aaa',
      })
    }

    if (target.includes('/api/voice/preview')) {
      return new Response(new Uint8Array(16), { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }

    if (target.includes('/api/voice/tts')) {
      if (!network.voice.configured) {
        return jsonResponse({ error: 'Voice is not configured. Add CARTESIA_API_KEY.' }, 503)
      }
      // A short MP3-shaped body is enough: playback is the fake <audio>.
      const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4])
      return new Response(bytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }

    if (target.includes('/api/voice/stt')) {
      return jsonResponse({ text: network.voice.sttText, language: 'en', duration: 1.4 })
    }

    return jsonResponse({})
  }
}

/**
 * jsdom has an HTMLAudioElement but no media pipeline: play() is a no-op that
 * logs "Not implemented". These fakes record what the adapter did and fire the
 * events a real element would, so `ended`/`error` handling is exercised.
 */
function installAudio() {
  class FakeAudio {
    constructor() {
      this.listeners = new Map()
      this.src = ''
      this.paused = true
      this.playCalls = 0
      this.pauseCalls = 0
      network.audio.push(this)
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback)
    }
    dispatch(type) {
      for (const callback of [...(this.listeners.get(type) ?? [])]) callback({ type })
    }
    removeAttribute() {
      this.src = ''
    }
    load() {}
    pause() {
      this.paused = true
      this.pauseCalls++
    }
    play() {
      this.playCalls++
      this.paused = false
      if (network.voice.autoEnd) setTimeout(() => this.dispatch('ended'), 5)
      return Promise.resolve()
    }
  }
  window.Audio = FakeAudio
  globalThis.Audio = FakeAudio
}

/**
 * MediaRecorder and a microphone, for the Cartesia Ink dictation path (jsdom
 * has neither). A recording "produces" one chunk and stops when told to.
 */
function installRecorder() {
  class FakeMediaRecorder {
    static isTypeSupported() {
      return true
    }
    constructor(stream, options) {
      this.stream = stream
      this.mimeType = options?.mimeType || 'audio/webm'
      this.state = 'inactive'
      this.listeners = new Map()
    }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(callback)
    }
    dispatch(type, detail = {}) {
      const event = { type, ...detail }
      // MediaRecorder is used through both APIs; the real one supports both.
      for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event)
      const handler = this[`on${type}`]
      if (typeof handler === 'function') handler(event)
    }
    start() {
      this.state = 'recording'
      setTimeout(() => this.dispatch('dataavailable', { data: new Blob(['audio-bytes'], { type: this.mimeType }) }), 1)
    }
    stop() {
      this.state = 'inactive'
      setTimeout(() => this.dispatch('stop'), 1)
    }
  }
  window.MediaRecorder = FakeMediaRecorder
  globalThis.MediaRecorder = FakeMediaRecorder

  Object.defineProperty(window.navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }),
    },
  })
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const dom = installDom()
installAudio()
installRecorder()
installFetch()
const app = await bundle()

let container = document.getElementById('root')
let root = null

async function tick(ms = 1) {
  await app.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

async function flush(times = 4) {
  for (let i = 0; i < times; i++) await tick()
}

async function waitFor(predicate, description, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await tick(5)
  }
  throw new Error(`timed out waiting for ${description}\n--- screen ---\n${text()}`)
}

async function mount() {
  container?.remove()
  document.body.innerHTML = ''
  container = document.createElement('div')
  document.body.appendChild(container)
  await app.act(async () => {
    root = app.mount(container)
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
}

async function reset({ keepStorage = false } = {}) {
  network.requests = []
  network.research = null
  network.audio = []
  network.voice.configured = true
  network.voice.autoEnd = true
  delete window.SpeechRecognition
  delete window.webkitSpeechRecognition
  if (!keepStorage) window.localStorage.clear()
  await mount()
}

const text = () => container.textContent.replace(/\s+/g, ' ')
// The thread root holds the messages and the composer; the thread list in the
// sidebar repeats the question as a title, so message assertions look only here.
const threadText = () => ($('[data-aui-thread-root]')?.textContent || '').replace(/\s+/g, ' ')
const $ = (selector) => container.querySelector(selector)
const $$ = (selector) => [...container.querySelectorAll(selector)]
const button = (label) => $$('button').find((element) => element.getAttribute('aria-label') === label || element.textContent.trim() === label)
// Popovers and sheets are portalled to <body>, outside the mounted tree.
const hasStop = () => $('button[aria-label="Stop"]') !== null
const hasSend = () => $('button[aria-label="Send"]') !== null
const documentButtons = () => [...document.querySelectorAll('button')]
const documentText = () => document.body.textContent.replace(/\s+/g, ' ')
const documentButton = (label) =>
  documentButtons().find(
    (element) => element.getAttribute('aria-label') === label || element.textContent.trim() === label,
  )
const script = () => node => node.querySelector('button[aria-label="Send"]') || node.button

function composerInput() {
  const input = $('textarea')
  assert.ok(input, 'the composer textarea should be rendered')
  return input
}

async function typeInto(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  await app.act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
}

async function type(value) {
  await typeInto(composerInput(), value)
}

/** Waits for a run to finish (Send back in the composer, Stop gone). */
async function settle() {
  await waitFor(() => !hasStop() && hasSend(), 'the run to finish')
}

/** The last request to a route, e.g. '/api/voice/tts'. */
function lastRequest(fragment) {
  return [...network.requests].reverse().find((request) => request.url.includes(fragment))
}

async function click(element, label) {
  assert.ok(element, `${label} should be on screen`)
  await app.act(async () => {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))
  })
  await tick()
}

async function send(message) {
  await type(message)
  await click($('button[aria-label="Send"]'), 'the Send button')
}

/**
 * Hovers the first citation marker and returns the card's text. Sources are
 * attached when a run finishes and the card only exists on hover, so this
 * waits for the settled screen first.
 */
async function openCitation() {
  await waitFor(() => !hasStop(), 'the run to finish')
  const citation = $('sup.citation')
  assert.ok(citation, 'the [1] in the answer becomes a citation marker')
  await app.act(async () => {
    citation.dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
  })
  await waitFor(() => /Negligence in California/.test(text()), 'the citation card')
}

function lastResearchRequest() {
  return [...network.requests].reverse().find((request) => request.url.includes('/api/open-researcher'))
}

const cases = []
function test(name, fn) {
  cases.push({ name, fn })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('empty state offers suggestions and a disabled composer', async () => {
  await reset()
  assert.match(text(), /Ask about California law/)
  assert.equal(
    $$('button').filter((element) => /security deposit|statute of limitations|without a warrant/i.test(element.textContent))
      .length,
    3,
  )
  assert.equal($('button[aria-label="Send"]').disabled, true, 'Send starts disabled')
  assert.equal(composerInput().getAttribute('placeholder'), 'Ask anything about California law')
  await type('hello')
  assert.equal($('button[aria-label="Send"]').disabled, false, 'typing enables Send')
})

test('a suggestion sends its full question', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  const suggestion = $$('button').find((element) => /security deposit/.test(element.textContent))
  await click(suggestion, 'the security-deposit suggestion')
  await flush()
  const request = lastResearchRequest()
  assert.ok(request, 'a research request should have been made')
  assert.match(request.body.query, /return a security deposit after a tenant moves out/)
  assert.equal(request.body.dataset, undefined, 'no scope means no dataset')
  assert.equal(request.init.method, 'POST')
})

test('a typed question streams reasoning, tools, markdown and citations', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await send('elements of negligence?')
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer to render')

  const request = lastResearchRequest()
  assert.equal(request.body.query, 'elements of negligence?')

  // The question is in a user bubble; the empty state is gone.
  assert.equal(
    (threadText().match(/elements of negligence\?/g) || []).length,
    1,
    'the question appears once, as the user bubble',
  )
  assert.doesNotMatch(text(), /Ask about California law/)

  // Research steps come from the thinking events, tool chips from tool calls.
  assert.match(text(), /Research steps/)
  assert.match(text(), /I should search the web first\./)
  assert.match(text(), /Web Search/)

  // The answer is rendered as markdown, not as a raw string.
  const heading = $('h2')
  assert.ok(heading && heading.textContent.includes('Elements of negligence'), 'the heading is an <h2>')
  assert.match(text(), /The answer cites/)

  // Sources from the search result feed the citation card, which opens on
  // hover over the [1] marker. This also proves the sources arrived from the
  // tool_result frame and not from the answer text alone.
  await openCitation()
  assert.match(text(), /https:\/\/example\.gov\/negligence/)

  // The run finished, so the composer is back to Send and the answer's
  // actions (which the action bar hides while running) are there.
  await waitFor(hasSend, 'Send to return')
  assert.equal(hasStop(), false, 'Stop is gone once the run ends')
  assert.ok(button('Copy'), 'Copy should appear after the answer')
  assert.ok(button('Regenerate'), 'Regenerate should appear after the answer')

  // Threads are persisted for the next visit.
  const stored = window.localStorage.getItem('california-law-threads-v1')
  assert.ok(stored && stored.includes('Elements of negligence'), 'the answer is persisted')
})

test('Enter sends, and the composer text is cleared', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await type('can I break a lease?')
  await app.act(async () => {
    composerInput().dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }),
    )
  })
  await waitFor(() => lastResearchRequest() !== undefined, 'the request')
  assert.equal(lastResearchRequest().body.query, 'can I break a lease?')
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer')
  assert.equal(composerInput().value, '', 'the composer is emptied on send')
})

test('a stream split into 3-byte pieces still renders the whole answer', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''), { chunkSize: 3 })
  await send('elements of negligence?')
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer')
  assert.match(text(), /The answer cites/, 'no frame was dropped or half-parsed')
  assert.match(text(), /I should search the web first\./, 'reasoning survived the split frames')
  await openCitation()
})

test('the scope selector scopes the next question', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  const select = $('#corpus-scope')
  assert.ok(select, 'the scope selector should be rendered')
  await app.act(async () => {
    select.value = 'CIV'
    select.dispatchEvent(new window.Event('change', { bubbles: true }))
  })
  await send('what is a nuisance?')
  await waitFor(() => lastResearchRequest() !== undefined, 'the request')
  assert.equal(lastResearchRequest().body.dataset, 'CIV')
  assert.match(text(), /Civil Code/, 'the dataset is listed by its full name')
})

test('Stop cancels the run and keeps what had streamed', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''), { chunkSize: 12, delayMs: 15 })
  await send('elements of negligence?')
  await waitFor(hasStop, 'the Stop button')
  await waitFor(() => /Research steps/.test(text()) || /Web Search/.test(text()), 'the run to start streaming')
  await click($('button[aria-label="Stop"]'), 'Stop')
  await waitFor(hasSend, 'the composer to return to Send')
  assert.equal(hasStop(), false, 'the run is no longer running')
  // Whatever arrived is kept rather than thrown away.
  assert.match(text(), /elements of negligence\?/, 'the question is still there')
})

test('Stop before any output keeps the thread usable', async () => {
  await reset()
  // Nothing has streamed yet when Stop is pressed.
  network.research = () => sseResponse(RUN_FRAMES.join(''), { chunkSize: 8, delayMs: 40 })
  await send('elements of negligence?')
  await waitFor(hasStop, 'the Stop button')
  await click($('button[aria-label="Stop"]'), 'Stop')
  await waitFor(hasSend, 'the composer to return to Send')
  assert.equal((threadText().match(/elements of negligence\?/g) || []).length, 1, 'the question survives')

  // And the thread still works: the next question runs normally.
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await send('what is a nuisance?')
  await waitFor(() => /Elements of negligence/.test(threadText()), 'the next answer')
  assert.match(threadText(), /what is a nuisance\?/)
})

test('a follow-up question keeps the earlier answer', async () => {
  await reset()
  network.research = (_init) => sseResponse(RUN_FRAMES.join(''))
  await send('elements of negligence?')
  await waitFor(() => /Elements of negligence/.test(threadText()), 'the first answer')
  await waitFor(() => !hasStop(), 'the first run to finish')
  network.research = () =>
    sseResponse(
      event({ type: 'thinking', content: 'Second look.' }) +
        frame({ type: 'response', content: '## Civil Code section 3479\n\nA nuisance is anything injurious.' }) +
        frame({ type: 'done' }),
    )
  await send('what is a nuisance?')
  await waitFor(() => /Civil Code section 3479/.test(threadText()), 'the second answer')
  assert.match(threadText(), /Elements of negligence/, 'the first answer is still there')
  assert.equal(
    (threadText().match(/elements of negligence\?/g) || []).length,
    1,
    'the first question is not duplicated',
  )
  assert.deepEqual(
    network.requests.filter((request) => request.url.includes('/api/open-researcher')).map((request) => request.body.query),
    ['elements of negligence?', 'what is a nuisance?'],
  )
})

test('Regenerate re-asks the last question without duplicating it', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await send('elements of negligence?')
  await waitFor(() => /Elements of negligence/.test(text()), 'the first answer')
  await waitFor(() => !hasStop(), 'the run to finish')
  await waitFor(() => button('Regenerate'), 'Regenerate')
  const before = network.requests.filter((request) => request.url.includes('/api/open-researcher')).length
  await click(button('Regenerate'), 'Regenerate')
  await waitFor(
    () => network.requests.filter((request) => request.url.includes('/api/open-researcher')).length > before,
    'a second request',
  )
  assert.equal(lastResearchRequest().body.query, 'elements of negligence?')
  assert.equal(
    (threadText().match(/elements of negligence\?/g) || []).length,
    1,
    'the question is asked once, not twice',
  )
})

test('a failing deployment shows the plain-language error card', async () => {
  await reset()
  network.research = () =>
    jsonResponse({ error: 'SARVAM_API_KEY is not configured. Add it to your environment variables.' }, 500)
  await send('elements of negligence?')
  await waitFor(() => /not set up yet/.test(text()), 'the error card')
  assert.match(text(), /research service is not set up/)
  assert.ok(button('Try again'), 'Try again should be offered')
})

test('a stream-level error is reported without a fake answer', async () => {
  await reset()
  network.research = () => sseResponse(event({ type: 'thinking', content: 'Looking.' }) + frame({ type: 'error', error: 'upstream exploded' }))
  await send('anything')
  await waitFor(() => /did not finish/.test(text()), 'the error card')
  assert.match(text(), /upstream exploded/)
})

test('the mobile thread drawer opens from the composer', async () => {
  await reset()
  const toggle = $('button[aria-label="Threads"]')
  assert.ok(toggle, 'the drawer toggle should be rendered')
  await click(toggle, 'the Threads toggle')
  // Radix portals the sheet to the end of <body>, outside the mounted tree.
  const drawer = () => document.querySelector('[role="dialog"]')
  await waitFor(() => drawer() !== null, 'the drawer')
  assert.match(drawer().textContent, /New thread/, 'the drawer lists the threads')
  assert.equal(drawer().getAttribute('data-state'), 'open')
})

test('threads persist across a remount, and New thread starts fresh', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await send('elements of negligence?')
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer')

  // A reload: same storage, new mount.
  await reset({ keepStorage: true })
  await waitFor(() => /Elements of negligence/.test(text()), 'the restored thread')
  assert.ok(text().includes('elements of negligence?'), 'the restored question is there')

  // New thread empties the screen.
  await click(button('New thread'), 'New thread')
  await waitFor(() => /Ask about California law/.test(text()), 'the empty state')
  assert.doesNotMatch(text(), /Elements of negligence/)
})

// ---------------------------------------------------------------------------
// Voice: listening (Cartesia Sonic)
// ---------------------------------------------------------------------------

async function askAndSettle(question = 'elements of negligence?') {
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await send(question)
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer')
  await settle()
}

test('Listen streams the answer through Cartesia', async () => {
  await reset()
  await askAndSettle()

  // Hold playback open so Stop is observable.
  network.voice.autoEnd = false
  await click(button('Listen'), 'Listen')

  await waitFor(() => lastRequest('/api/voice/tts') !== undefined, 'the speech request')
  const request = lastRequest('/api/voice/tts')
  assert.equal(request.init.method, 'POST')
  assert.match(request.body.text, /Elements of negligence/, 'the answer text is spoken')
  assert.equal(request.body.voiceId, undefined, 'no voice chosen means the account default')
  assert.equal(request.body.speed, 1)

  // An audio element was created and started.
  await waitFor(() => network.audio.length > 0, 'an audio element')
  const audio = network.audio.at(-1)
  await waitFor(() => audio.playCalls > 0, 'playback to start')

  // While it plays, the same answer offers Stop instead of Listen.
  await waitFor(() => button('Stop reading') !== undefined, 'Stop reading')
  await click(button('Stop reading'), 'Stop reading')
  await waitFor(() => audio.pauseCalls > 0, 'playback to be paused')
  await waitFor(() => button('Stop reading') === undefined, 'Stop reading to disappear')
})

test('the voice picker sets the voice and speed Listen uses', async () => {
  await reset()
  await askAndSettle()

  await click(documentButton('Choose the voice used to read answers aloud'), 'the voice picker')
  await waitFor(() => /Ronald/.test(documentText()), 'the voice list')
  await click(
    documentButtons().find((element) => /Ronald/.test(element.textContent)),
    'the Ronald voice',
  )
  await click(
    documentButtons().find((element) => element.textContent.trim() === '1.25×'),
    'the 1.25x speed',
  )
  assert.equal(window.localStorage.getItem('cartesia_voice_id'), 'voice-bbb')
  assert.equal(window.localStorage.getItem('cartesia_speed'), '1.25')

  await click(documentButton('Choose the voice used to read answers aloud'), 'the picker again')
  await click(button('Listen'), 'Listen')
  await waitFor(() => lastRequest('/api/voice/tts') !== undefined, 'the speech request')
  const request = lastRequest('/api/voice/tts')
  assert.equal(request.body.voiceId, 'voice-bbb', 'the chosen voice is used')
  assert.equal(request.body.speed, 1.25, 'the chosen speed is used')
})

test('a speech failure is reported instead of failing silently', async () => {
  await reset()
  await askAndSettle()
  network.voice.configured = false // the route now answers 503
  await click(button('Listen'), 'Listen')
  await waitFor(() => /not configured|Voice is not configured/i.test(documentText()), 'an error toast')
})

// ---------------------------------------------------------------------------
// Voice: dictation
// ---------------------------------------------------------------------------

test('dictation records and transcribes through Cartesia without a recogniser', async () => {
  await reset()
  network.research = () => sseResponse(RUN_FRAMES.join(''))
  await click(button('Ask by voice'), 'the microphone')
  await waitFor(() => /Listening/.test(text()), 'the listening strip')

  await click(button('Stop and transcribe'), 'stop dictation')
  await waitFor(() => lastRequest('/api/voice/stt') !== undefined, 'the transcription request')
  assert.ok(lastRequest('/api/voice/stt').init.body instanceof FormData, 'the clip is uploaded')
  await waitFor(() => composerInput().value === 'what is negligence', 'the transcript in the composer')

  // The transcript is ordinary composer text: it can be sent as typed.
  await click($('button[aria-label="Send"]'), 'Send')
  await waitFor(() => /Elements of negligence/.test(text()), 'the answer to the spoken question')
  assert.equal(lastResearchRequest().body.query, 'what is negligence')
})

test('dictation uses the browser recogniser when there is one', async () => {
  await reset()
  let recognition = null
  window.SpeechRecognition = class {
    constructor() {
      recognition = this
    }
    start() {
      setTimeout(() => this.onstart?.(), 0)
    }
    stop() {
      setTimeout(() => this.onend?.(), 0)
    }
    abort() {
      setTimeout(() => this.onend?.(), 0)
    }
  }

  await click(button('Ask by voice'), 'the microphone')
  await waitFor(() => recognition !== null, 'the recogniser to start')
  await tick(5)

  const result = (transcript, isFinal) => [{ 0: { transcript }, isFinal }]
  await app.act(async () => {
    recognition.onresult({ resultIndex: 0, results: result('what is', false) })
  })
  await waitFor(() => composerInput().value === 'what is', 'the interim transcript')

  await app.act(async () => {
    recognition.onresult({ resultIndex: 0, results: result('what is negligence', true) })
  })
  await waitFor(() => composerInput().value === 'what is negligence', 'the final transcript')

  await click(button('Stop and transcribe'), 'stop dictation')
  await waitFor(() => !/Listening/.test(text()), 'the listening strip to close')
  assert.equal(lastRequest('/api/voice/stt'), undefined, 'the browser path never uploads audio')
})

// ---------------------------------------------------------------------------
// assistant-ui message actions
// ---------------------------------------------------------------------------

test('editing a question re-asks from that point', async () => {
  await reset()
  await askAndSettle()

  await click(button('Edit'), 'Edit')
  const editor = $('textarea[aria-label="Edit your question"]')
  assert.ok(editor, 'the edit composer should open')
  await typeInto(editor, 'what is a nuisance?')
  await click(button('Save'), 'Save')

  await waitFor(() => lastResearchRequest().body.query === 'what is a nuisance?', 'the edited request')
  await waitFor(() => /Elements of negligence/.test(text()), 'the new answer')
  assert.equal(
    (threadText().match(/elements of negligence\?/g) || []).length,
    0,
    'the edited question replaces the original',
  )
  assert.match(threadText(), /what is a nuisance\?/)
})

test('voice controls turn off when neither Cartesia nor the browser can do it', async () => {
  await reset()
  network.voice.configured = false
  window.localStorage.clear()
  await mount()
  await askAndSettle()

  assert.equal(button('Listen').disabled, true, 'Listen is disabled without a voice')
  assert.equal(button('Ask by voice'), undefined, 'no microphone button')
  assert.equal(documentButton('Choose the voice used to read answers aloud'), undefined, 'no picker')
})

// ---------------------------------------------------------------------------

let failures = 0
for (const { name, fn } of cases) {
  try {
    await fn()
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures++
    console.log(`  FAIL ${name} — ${error.message}`)
    if (process.env.DEBUG_UI) console.log(text().slice(0, 4000))
  }
}

if (root) await app.act(async () => root.unmount())

console.log(`\n${cases.length - failures} passed, ${failures} failed`)
process.exit(failures ? 1 : 0)
