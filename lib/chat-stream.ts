// Folding the research route's SSE payloads into one assistant turn.
//
// The route streams three kinds of frame:
//
//   { type: 'event', event: { type: 'thinking' | 'tool_call' | 'tool_result'
//                           | 'response' | 'start' | 'summary', ... } }
//   { type: 'response', content }        // the final answer, sent once
//   { type: 'error', error, originalError? }
//
// `lib/sse.ts` owns the transport problem (frames split across network
// chunks); this module owns the meaning, so the reducer can be tested without
// a browser — and so the UI and the tests fold a stream the same way.

export type ChatSource = { url: string; title: string; description?: string }

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown>; result?: string }

/** One tool call, as it arrives and then as its result arrives. */
export type ResearchToolCall = {
  id: string
  name: string
  args: Record<string, unknown>
  result?: string
}

/** Everything one assistant reply accumulates while the run streams. */
export type ResearchTurn = {
  reasoning: string
  toolCalls: ResearchToolCall[]
  sources: ChatSource[]
  text: string
  error: string | null
  done: boolean
}

/** Tool results are shown as a one-line summary, not the full scraped page. */
const MAX_RESULT_CHARS = 600

const SOURCE_TOOLS = new Set(['web_search', 'search_california_law'])

export function createResearchTurn(): ResearchTurn {
  return { reasoning: '', toolCalls: [], sources: [], text: '', error: null, done: false }
}

/**
 * The source list the corpus and web search tools write: `[n] title` followed
 * by `URL:` / `Source:` / `Description:` lines.
 */
export function parseSearchResults(resultText: string): ChatSource[] {
  const results: ChatSource[] = []
  let current: ChatSource | null = null
  for (const line of resultText.split('\n')) {
    const titleMatch = line.match(/^\[(\d+)\]\s+(.+)$/)
    if (titleMatch) {
      if (current && current.title) results.push(current)
      current = { url: '', title: titleMatch[2].replace(' (scraped)', '') }
      continue
    }
    if (line.startsWith('URL: ') && current) {
      current.url = line.substring(5)
      continue
    }
    if (line.startsWith('Source: ') && current) {
      current.url = line.substring(8).trim()
      continue
    }
    if (line.startsWith('Description: ') && current) {
      current.description = line.substring(13)
      continue
    }
    if (
      current &&
      !current.description &&
      line.trim().length > 40 &&
      !/^[A-Za-z][A-Za-z ]{0,12}: /.test(line)
    ) {
      current.description = line.trim()
      continue
    }
  }
  if (current && current.title) results.push(current)
  return results
}

type WireEvent = {
  type?: string
  tool?: string
  parameters?: Record<string, unknown>
  content?: string
  result?: string
}

type WirePayload = {
  type?: string
  event?: WireEvent
  content?: string
  error?: string
  originalError?: string
}

/**
 * Folds one SSE payload (the string `parseSseFrame` returned) into `turn`.
 * Returns whether anything changed, so callers can skip a re-render when the
 * frame carried nothing the UI shows (start, summary, done, keep-alives).
 *
 * `label` maps a tool name from the route (`search_california_law`) to the
 * name shown in the transcript (`California Law`).
 */
export function applyResearchPayload(
  turn: ResearchTurn,
  payload: string,
  label: (tool?: string) => string,
): boolean {
  let data: WirePayload
  try {
    data = JSON.parse(payload) as WirePayload
  } catch {
    return false
  }
  if (!data || typeof data !== 'object') return false

  if (data.type === 'event' && data.event) {
    const event = data.event
    if (event.type === 'thinking' && event.content) {
      turn.reasoning += (turn.reasoning ? '\n' : '') + event.content
      return true
    }
    if (event.type === 'tool_call') {
      turn.toolCalls.push({
        id: `call-${turn.toolCalls.length}`,
        name: label(event.tool),
        args: event.parameters ?? {},
      })
      return true
    }
    if (event.type === 'tool_result') {
      const name = label(event.tool)
      const open = [...turn.toolCalls].reverse().find((call) => call.name === name && call.result === undefined)
      if (open && event.result) {
        open.result =
          event.result.length > MAX_RESULT_CHARS ? `${event.result.slice(0, MAX_RESULT_CHARS)}...` : event.result
      }
      if (event.tool && SOURCE_TOOLS.has(event.tool) && event.result) {
        const parsed = parseSearchResults(event.result)
        if (parsed.length > 0) turn.sources = parsed
      }
      return true
    }
    // A text block finished inside a step: show it now and let the final
    // response replace it, so a long run is readable while it works.
    if (event.type === 'response' && typeof event.content === 'string' && event.content) {
      turn.text = event.content
      return true
    }
    return false
  }

  if (data.type === 'response') {
    turn.text = data.content ?? ''
    return true
  }

  if (data.type === 'error') {
    turn.error = data.error || data.originalError || 'The research request failed.'
    return true
  }

  if (data.type === 'done') {
    turn.done = true
    return false
  }

  return false
}

/** The assistant-ui parts for a turn: steps, then tool calls, then the answer. */
export function turnParts(turn: ResearchTurn): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  if (turn.reasoning) parts.push({ type: 'reasoning', text: turn.reasoning })
  for (const call of turn.toolCalls) {
    parts.push({
      type: 'tool-call',
      toolCallId: call.id,
      toolName: call.name,
      args: call.args,
      ...(call.result !== undefined ? { result: call.result } : {}),
    })
  }
  if (turn.text) parts.push({ type: 'text', text: turn.text })
  return parts
}
