// Markdown -> semantic HTML for the research answers.
//
// Typography lives in app/globals.css (`.markdown-content`), not in class
// strings here, so every element renders with the same size, leading, colour
// and spacing rules as the rest of the app. This module is pure (no React) so
// it can be exercised on its own.

// ---------------------------------------------------------------------------
// Markdown -> semantic HTML
//
// Typography lives in app/globals.css (`.markdown-content`), not in class
// strings here, so every element renders with the same size, leading, colour
// and spacing rules as the rest of the app.
//
// This is deliberately a small parser, not a spec-complete one; it emits real
// block elements (h1-h4, ul/ol/li, p, pre/code, table, blockquote, hr) and
// leaves all presentation to CSS.
// ---------------------------------------------------------------------------

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

function inline(text: string): string {
  // Code spans are protected first so their contents are never bolded,
  // linked or turned into citation markers.
  const codeSpans: string[] = [];
  let out = text.replace(/`([^`]+)`/g, (_match, code: string) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  out = escapeHtml(out);

  // Links: [label](url)
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_match, label: string, url: string) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );

  // Citations: [1], [2], ... (cannot match markdown links, handled above)
  out = out.replace(
    /\[(\d+)\]/g,
    '<sup class="citation">[$1]</sup>'
  );

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');

  out = out.replace(
    /\u0000CODE(\d+)\u0000/g,
    (_match, index: string) => `<code>${escapeHtml(codeSpans[Number(index)] ?? '')}</code>`
  );

  return out;
}

interface TableBlock {
  kind: 'table';
  rows: string[][];
}

interface ListItem {
  ordered: boolean;
  indent: number;
  text: string;
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: ListItem[] }
  | { kind: 'code'; code: string }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'hr' }
  | TableBlock;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: ListItem[] | null = null;
  let listInterrupted = false;
  let quote: string[] = [];
  let table: string[][] | null = null;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'list', items: list });
      list = null;
    }
    listInterrupted = false;
  };
  const flushQuote = () => {
    if (quote.length > 0) {
      const paragraphs = quote
        .join('\n')
        .split(/\n\s*\n/)
        .map((section) => section.split('\n').map((line) => line.trim()).join(' ').trim())
        .filter(Boolean);
      blocks.push({ kind: 'blockquote', lines: paragraphs });
      quote = [];
    }
  };
  const flushTable = () => {
    if (table && table.length > 0) {
      const rows = table.filter((row) => !isTableSeparator(row.join('|')));
      if (rows.length > 0) blocks.push({ kind: 'table', rows });
      table = null;
    }
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
    flushTable();
  };

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const line = raw.trimEnd();

    // Fenced code block
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      flushAll();
      const code: string[] = [];
      index++;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index++;
      }
      blocks.push({ kind: 'code', code: code.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\s*(\1\s*){2,}$/.test(line)) {
      flushAll();
      blocks.push({ kind: 'hr' });
      continue;
    }

    // Heading (# .. ####)
    const heading = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (heading) {
      flushAll();
      blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2].trim() });
      continue;
    }

    // Table rows
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushParagraph();
      flushList();
      flushQuote();
      table = table ?? [];
      table.push(splitRow(line));
      continue;
    }
    flushTable();

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      quote.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    flushQuote();

    // Blank line ends a paragraph and stops lazy list continuation
    if (line.trim() === '') {
      flushParagraph();
      if (list) listInterrupted = true;
      continue;
    }

    // Bullet / ordered list item, indentation aware
    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    const numbered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushParagraph();
      const indent = (bullet ? bullet[1] : numbered![1]).length;
      const itemText = bullet ? bullet[2] : numbered![3];
      const ordered = Boolean(numbered);
      if (!list || listInterrupted) {
        flushList();
        list = [];
      }
      list.push({ ordered, indent, text: itemText });
      continue;
    }

    // Indented or lazy continuation of the previous item
    if (list && !listInterrupted && (/^\s+/.test(raw) || true)) {
      list[list.length - 1].text += ' ' + line.trim();
      continue;
    }
    flushList();

    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
}

export function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case 'heading': {
          const tag = `h${Math.min(block.level, 4)}`;
          return `<${tag}>${inline(block.text)}</${tag}>`;
        }
        case 'paragraph':
          return `<p>${inline(block.text)}</p>`;
        case 'list': {
          // Build nested lists from indentation so sub-points keep their
          // hierarchy instead of collapsing into one flat run.
          let html = '';
          const stack: Array<{ indent: number; ordered: boolean }> = [];
          for (const item of block.items) {
            while (stack.length > 0 && item.indent < stack[stack.length - 1].indent) {
              const closed = stack.pop()!;
              html += `</li></${closed.ordered ? 'ol' : 'ul'}>`;
            }
            const top = stack[stack.length - 1];
            if (!top || item.indent > top.indent) {
              html += `<${item.ordered ? 'ol' : 'ul'}><li>${inline(item.text)}`;
              stack.push({ indent: item.indent, ordered: item.ordered });
            } else if (top.ordered !== item.ordered) {
              html += `</li></${top.ordered ? 'ol' : 'ul'}>`;
              stack.pop();
              html += `<${item.ordered ? 'ol' : 'ul'}><li>${inline(item.text)}`;
              stack.push({ indent: item.indent, ordered: item.ordered });
            } else {
              html += `</li><li>${inline(item.text)}`;
            }
          }
          while (stack.length > 0) {
            const closed = stack.pop()!;
            html += `</li></${closed.ordered ? 'ol' : 'ul'}>`;
          }
          return html;
        }
        case 'code':
          return `<pre><code>${escapeHtml(block.code)}</code></pre>`;
        case 'blockquote':
          return `<blockquote>${block.lines.map((line) => `<p>${inline(line)}</p>`).join('')}</blockquote>`;
        case 'hr':
          return '<hr />';
        case 'table': {
          const [head, ...body] = block.rows;
          const headHtml = `<thead><tr>${(head ?? [])
            .map((cell) => `<th>${inline(cell)}</th>`)
            .join('')}</tr></thead>`;
          const bodyHtml = `<tbody>${body
            .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
            .join('')}</tbody>`;
          return `<div class="table-wrapper"><table>${headHtml}${bodyHtml}</table></div>`;
        }
        default:
          return '';
      }
    })
    .join('\n');
}


export function renderMarkdown(content: string): string {
  return renderBlocks(parseBlocks(content));
}
