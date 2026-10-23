// Markdown -> speakable text.
//
// Reading an answer aloud is not the same as rendering it. Markdown syntax,
// citation markers, URLs and code blocks are all visual conventions: spoken
// aloud they become noise ("bracket one", "asterisk asterisk", "https colon
// slash slash"). This module reduces an answer to the words a person would
// actually say, keeping paragraph breaks so the voice pauses where the page
// breaks.
//
// Kept dependency-free and pure so it can be unit tested without React.

export interface SpeakableOptions {
  /** Hard cap on returned characters. Defaults to the TTS route's limit. */
  maxChars?: number
}

/**
 * Converts markdown (or plain text) to speech-friendly plain text.
 */
export function toSpeakableText(markdown: string, options: SpeakableOptions = {}): string {
  if (!markdown) return ''

  let text = markdown.replace(/\r\n?/g, '\n')

  // Fenced code is meaningless read aloud; drop it and keep the pause.
  text = text.replace(/```[\s\S]*?```/g, '\n\n')
  text = text.replace(/~~~[\s\S]*?~~~/g, '\n\n')

  // Images carry no spoken content beyond their alt text, which is usually a
  // caption; drop them entirely to avoid "image of a chart" noise.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')

  // Links: keep the label, drop the target.
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')

  // Reference-style citation markers like [1], [12] are visual anchors.
  text = text.replace(/\[\d{1,3}\]/g, '')

  // Tables: keep cell text, separate columns with a comma-ish pause.
  text = text
    .split('\n')
    .map((line) => {
      if (!/^\s*\|.*\|\s*$/.test(line)) return line
      // The header separator row carries no content.
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return ''
      const cells = line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean)
      return cells.join(', ')
    })
    .join('\n')

  // Headings and quotes lose their punctuation but keep their line. List
  // items are marked (\u0001) so each one becomes its own spoken paragraph:
  // "first point second point" runs together, "first point. Second point."
  // reads the way the list looks.
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '')
  text = text.replace(/^\s{0,3}>\s?/gm, '')
  text = text.replace(/^\s{0,3}(?:[-*+]|\d+[.)])\s+/gm, '\u0001')

  // Emphasis and inline code markers.
  text = text.replace(/`([^`]+)`/g, '$1')
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2')
  text = text.replace(/(\*|_)(.*?)\1/g, '$2')
  text = text.replace(/~~(.*?)~~/g, '$1')

  // Horizontal rules and raw HTML tags.
  text = text.replace(/^\s*([-*_])\s*\1\s*\1[\s\S]*?$/gm, '')
  text = text.replace(/<[^>]+>/g, ' ')

  // Collapse runs of spaces and join wrapped lines; a typed newline is not a
  // sentence break, but a blank line and the start of a list item are.
  const paragraphs: string[] = []
  let buffer: string[] = []

  const flush = () => {
    const joined = buffer.join(' ').replace(/[ \t]+/g, ' ').trim()
    if (joined) paragraphs.push(joined)
    buffer = []
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('\u0001')) {
      flush()
      buffer.push(trimmed.slice(1))
    } else if (!trimmed) {
      flush()
    } else {
      buffer.push(trimmed)
    }
  }
  flush()

  text = paragraphs.join('\n\n')

  if (options.maxChars && text.length > options.maxChars) {
    text = truncateAtSentence(text, options.maxChars)
  }

  return text
}

/**
 * Cuts at the last sentence boundary before `limit` so the recording does not
 * stop mid-word.
 */
export function truncateAtSentence(text: string, limit: number): string {
  if (text.length <= limit) return text

  const slice = text.slice(0, limit)
  const boundary = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('\n')
  )

  if (boundary > limit * 0.5) {
    return `${slice.slice(0, boundary + 1).trim()} …`
  }

  // No usable boundary: fall back to the last space.
  const space = slice.lastIndexOf(' ')
  return `${slice.slice(0, space > 0 ? space : limit).trim()} …`
}
