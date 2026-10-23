// Server-sent events reader.
//
// The research route streams events as they happen, so the client must parse
// frames that arrive split across network chunks. Two things are easy to get
// wrong and both corrupt data silently:
//
//   1. Frames split mid-JSON. Chunk boundaries have nothing to do with frame
//      boundaries, so a partial `data:` line must be held until the rest of
//      the frame arrives — not parsed and dropped.
//   2. Text split mid-character. `§`, `—` and emoji are multi-byte; decoding
//      each chunk independently replaces them with U+FFFD. `{ stream: true }`
//      keeps the trailing partial sequence for the next chunk.
//
// Pure and dependency-free so it can be tested without a browser.

/**
 * Yields complete SSE frames (the text between blank lines) from a response
 * body, buffering whatever does not yet form a whole frame.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      // Normalise CRLF so a proxy that rewrites line endings does not stall
      // the frame boundary detection.
      buffer = buffer.replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        if (frame.trim()) yield frame
        boundary = buffer.indexOf('\n\n')
      }
    }

    buffer += decoder.decode()
    const rest = buffer.replace(/\r\n/g, '\n').trim()
    if (rest) yield rest
  } finally {
    reader.releaseLock()
  }
}

/**
 * Extracts the payload from one frame. Multiple `data:` lines are joined with
 * newlines, as the SSE spec requires.
 */
export function parseSseFrame(frame: string): string | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))

  if (data.length === 0) return null
  return data.join('\n')
}
