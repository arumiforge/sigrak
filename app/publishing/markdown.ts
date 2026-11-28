/**
 * Safe rich text for Kabar, Acara, Cerita Sekolah and the legal pages
 * (R2-05). Staff write Markdown; it is stored as written and turned
 * into HTML here, on the server for the app and sigrak.com, and in the
 * browser for the editor preview (one implementation, no imports).
 *
 * Two walls:
 * 1. The renderer escapes every character of the input first and only
 *    then adds its own tags, so raw HTML in the Markdown always shows
 *    as text.
 * 2. Its output goes through `sanitizeHtml`, an allowlist of tags and
 *    attributes; anything else is escaped, and links keep only http,
 *    https, mailto and same-site paths.
 *
 * The supported subset is small on purpose: headings (## to ####),
 * paragraphs with line breaks, **bold**, *italic*, `code`, links,
 * bulleted and numbered lists, quotes and a horizontal rule.
 */

export const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'code',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'hr',
] as const

const allowedTags = new Set<string>(ALLOWED_TAGS)
const voidTags = new Set(['br', 'hr'])
const LINK_REL = 'nofollow noopener noreferrer'

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function unescapeHtml(text: string) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * A link target the page may carry: http(s), mailto, or a path on the
 * same site ("/kabar/…", not "//host"). Anything else (javascript:,
 * data:, vbscript:, …) is refused. Control characters and spaces never
 * pass, so "java\tscript:" cannot sneak through.
 */
export function safeUrl(url: string): string | null {
  const value = url.trim()
  if (value.length === 0 || value.length > 2000) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f-\u009f]/.test(value)) return null
  if (/^\/(?![/\\])/.test(value)) return value
  if (/^(https?:\/\/[^/\\]|mailto:[^/])/i.test(value)) return value
  return null
}

/* ----------------------------------------------------------------------
 * Inline
 * -------------------------------------------------------------------- */

/** Bold and italic on text that is already escaped. */
function emphasis(escaped: string) {
  return escaped
    .replace(/\*\*(?=\S)([^*]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}*])\*(?=\S)([^*]*?\S)\*(?![\p{L}\p{N}*])/gu, '$1<em>$2</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([^_]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
}

const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g

/** Links, then emphasis, on raw (unescaped) text without code spans. */
function linksAndEmphasis(raw: string) {
  let html = ''
  let last = 0
  for (const match of raw.matchAll(LINK)) {
    html += emphasis(escapeHtml(raw.slice(last, match.index)))
    const label = emphasis(escapeHtml(match[1]))
    const url = safeUrl(match[2])
    html += url ? `<a href="${escapeHtml(url)}" rel="${LINK_REL}">${label}</a>` : label
    last = match.index + match[0].length
  }
  return html + emphasis(escapeHtml(raw.slice(last)))
}

function inline(raw: string) {
  let html = ''
  let last = 0
  for (const match of raw.matchAll(/`([^`\n]+)`/g)) {
    html += linksAndEmphasis(raw.slice(last, match.index))
    html += `<code>${escapeHtml(match[1])}</code>`
    last = match.index + match[0].length
  }
  return html + linksAndEmphasis(raw.slice(last))
}

/* ----------------------------------------------------------------------
 * Blocks
 * -------------------------------------------------------------------- */

const HEADING = /^(#{1,4})\s+(.+?)\s*#*\s*$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/
const QUOTE = /^\s*>\s?(.*)$/
const RULE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

function renderBlock(lines: string[]): string {
  const first = lines[0]
  const heading = HEADING.exec(first)
  if (heading && lines.length === 1) {
    // The page title is the h1; "#" and "##" both become h2.
    const level = Math.max(2, heading[1].length)
    return `<h${level}>${inline(heading[2])}</h${level}>`
  }
  if (RULE.test(first) && lines.length === 1) return '<hr>'
  if (lines.every((line) => BULLET.test(line))) {
    return `<ul>${lines.map((line) => `<li>${inline(BULLET.exec(line)![1])}</li>`).join('')}</ul>`
  }
  if (lines.every((line) => NUMBERED.test(line))) {
    return `<ol>${lines.map((line) => `<li>${inline(NUMBERED.exec(line)![1])}</li>`).join('')}</ol>`
  }
  if (lines.every((line) => QUOTE.test(line))) {
    const text = lines.map((line) => inline(QUOTE.exec(line)![1])).join('<br>')
    return `<blockquote><p>${text}</p></blockquote>`
  }
  return `<p>${lines.map((line) => inline(line.trim())).join('<br>')}</p>`
}

/**
 * Splits the text into blocks at blank lines, and also before a
 * heading, rule or a change between list and text, so a heading right
 * above a paragraph still renders as a heading.
 */
function blocksOf(markdown: string): string[][] {
  const kindOf = (line: string) =>
    HEADING.test(line) || RULE.test(line)
      ? 'single'
      : BULLET.test(line)
        ? 'bullet'
        : NUMBERED.test(line)
          ? 'numbered'
          : QUOTE.test(line)
            ? 'quote'
            : 'text'
  const blocks: string[][] = []
  let current: string[] = []
  let currentKind = ''
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') {
      if (current.length > 0) blocks.push(current)
      current = []
      currentKind = ''
      continue
    }
    const kind = kindOf(line)
    if (current.length > 0 && (kind === 'single' || kind !== currentKind)) {
      blocks.push(current)
      current = []
    }
    current.push(line)
    currentKind = kind === 'single' ? 'single-done' : kind
  }
  if (current.length > 0) blocks.push(current)
  return blocks
}

/** Markdown → safe HTML (rendered, then passed through the allowlist). */
export function renderMarkdown(markdown: string): string {
  return sanitizeHtml(
    blocksOf(markdown ?? '')
      .map(renderBlock)
      .join('\n')
  )
}

/** Plain text of the Markdown, for summaries and meta descriptions. */
export function markdownToText(markdown: string, maxLength = 200): string {
  const text = unescapeHtml(renderMarkdown(markdown).replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

/* ----------------------------------------------------------------------
 * Allowlist sanitiser
 * -------------------------------------------------------------------- */

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^<>]*)>/g

/**
 * Keeps only the allowlisted tags, without attributes except `href`
 * (checked by safeUrl) on links, which also get a fixed rel. Every
 * other tag, and every stray < or >, is escaped so it shows as text.
 * Open tags are closed at the end so a broken fragment cannot leak
 * into the page around it.
 */
export function sanitizeHtml(html: string): string {
  let out = ''
  let last = 0
  const open: string[] = []
  const text = (part: string) => part.replace(/</g, '&lt;').replace(/>/g, '&gt;')

  for (const match of html.matchAll(TAG)) {
    out += text(html.slice(last, match.index))
    last = match.index + match[0].length
    const closing = match[1] === '/'
    const name = match[2].toLowerCase()
    if (!allowedTags.has(name)) {
      out += escapeHtml(match[0])
      continue
    }
    if (voidTags.has(name)) {
      if (!closing) out += `<${name}>`
      continue
    }
    if (closing) {
      const index = open.lastIndexOf(name)
      if (index === -1) continue
      while (open.length > index) out += `</${open.pop()}>`
      continue
    }
    if (name === 'a') {
      const href = /\shref\s*=\s*"([^"]*)"/i.exec(` ${match[3]}`)?.[1]
      const url = href === undefined ? null : safeUrl(unescapeHtml(href))
      out += url ? `<a href="${escapeHtml(url)}" rel="${LINK_REL}">` : '<a>'
    } else {
      out += `<${name}>`
    }
    open.push(name)
  }
  out += text(html.slice(last))
  while (open.length > 0) out += `</${open.pop()}>`
  return out
}
