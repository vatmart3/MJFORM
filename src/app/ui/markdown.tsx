// Rendu Markdown minimal et sûr (aucun HTML injecté) : ## titres, listes, **gras**, *italique*, [liens](url).
import { Fragment, type ReactNode } from 'react'

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    const k = `${keyBase}-${i++}`
    if (tok.startsWith('**')) out.push(<strong key={k}>{tok.slice(2, -2)}</strong>)
    else if (tok.startsWith('*')) out.push(<em key={k}>{tok.slice(1, -1)}</em>)
    else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!
      const href = /^(https?:|mailto:|tel:|\/)/.test(lm[2]) ? lm[2] : '#'
      out.push(
        <a key={k} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
          {lm[1]}
        </a>,
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r/g, '').split('\n')
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{2,3})\s+(.*)$/.exec(line)
    if (h) {
      const Tag = h[1].length === 2 ? 'h2' : 'h3'
      blocks.push(<Tag key={key++}>{inline(h[2], `h${key}`)}</Tag>)
      i++
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: ReactNode[] = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''), `li${key}-${items.length}`)}</li>)
        i++
      }
      blocks.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{2,3})\s/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
      para.push(lines[i])
      i++
    }
    blocks.push(<p key={key++}>{inline(para.join(' '), `p${key}`)}</p>)
  }
  return (
    <div className="prose">
      {blocks.map((b, j) => (
        <Fragment key={j}>{b}</Fragment>
      ))}
    </div>
  )
}
