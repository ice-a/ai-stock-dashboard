function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim())
}

export function renderMarkdown(content: string): string {
  if (!content.trim()) return '<span class="typing">...</span>'

  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let paragraph: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let inCode = false
  let codeBuffer: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    out.push(`<p>${paragraph.map(renderInline).join('<br>')}</p>`)
    paragraph = []
  }

  const closeList = () => {
    if (!listType) return
    out.push(`</${listType}>`)
    listType = null
  }

  const flushCode = () => {
    out.push(`<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`)
    codeBuffer = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushParagraph()
      closeList()
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        inCode = true
        codeBuffer = []
      }
      continue
    }

    if (inCode) {
      codeBuffer.push(line)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      closeList()
      continue
    }

    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      flushParagraph()
      closeList()
      const headers = parseTableRow(trimmed)
      out.push('<table><thead><tr>')
      for (const header of headers) out.push(`<th>${renderInline(header)}</th>`)
      out.push('</tr></thead><tbody>')
      i += 2
      while (i < lines.length && lines[i].trim().includes('|')) {
        const cells = parseTableRow(lines[i])
        out.push('<tr>')
        for (const cell of cells) out.push(`<td>${renderInline(cell)}</td>`)
        out.push('</tr>')
        i++
      }
      i--
      out.push('</tbody></table>')
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(heading[1].length + 1, 5)
      out.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }

    const quote = trimmed.match(/^>\s+(.+)$/)
    if (quote) {
      flushParagraph()
      closeList()
      out.push(`<blockquote>${renderInline(quote[1])}</blockquote>`)
      continue
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      flushParagraph()
      if (listType !== 'ul') {
        closeList()
        listType = 'ul'
        out.push('<ul>')
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`)
      continue
    }

    const numbered = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numbered) {
      flushParagraph()
      if (listType !== 'ol') {
        closeList()
        listType = 'ol'
        out.push('<ol>')
      }
      out.push(`<li>${renderInline(numbered[1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(trimmed)
  }

  if (inCode) flushCode()
  flushParagraph()
  closeList()
  return out.join('')
}

export function markdownToText(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
