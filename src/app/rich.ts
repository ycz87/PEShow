// 讲解正文的轻量标记：$…$ 行内公式（KaTeX），**…** 加粗，以 "- " 开头的行是列表项，其余每行一段。
// 不支持在加粗里嵌公式；正文里不会出现 HTML，所有文字都先转义。
import katex from 'katex'

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inline(s: string): string {
  return s
    .split(/(\$[^$]+\$)/)
    .map((part) =>
      part.length > 2 && part.startsWith('$') && part.endsWith('$')
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' })
        : escape(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
    )
    .join('')
}

export function richHtml(src: string): string {
  let html = ''
  let items: string[] = []
  const flush = () => {
    if (items.length) html += `<ul>${items.join('')}</ul>`
    items = []
  }
  for (const line of src.split('\n')) {
    if (line.startsWith('- ')) {
      items.push(`<li>${inline(line.slice(2))}</li>`)
      continue
    }
    flush()
    if (line.trim()) html += `<p>${inline(line)}</p>`
  }
  flush()
  return html
}
