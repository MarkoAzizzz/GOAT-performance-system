import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'p'; text: string }
  | { type: 'code'; lang: string; code: string }

function parseBlocks(raw: string): Block[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let paraBuf: string[] = []
  let listBuf: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let i = 0

  const flushPara = () => {
    if (paraBuf.length) { blocks.push({ type: 'p', text: paraBuf.join(' ') }); paraBuf = [] }
  }
  const flushList = () => {
    if (listBuf.length && listType) { blocks.push({ type: listType, items: listBuf }); listBuf = []; listType = null }
  }

  while (i < lines.length) {
    const line = lines[i]

    const fence = line.match(/^```\s*(\w*)\s*$/)
    if (fence) {
      flushPara(); flushList()
      const lang = fence[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { codeLines.push(lines[i]); i++ }
      i++
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') })
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushPara(); flushList()
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, text: heading[2].trim() })
      i++
      continue
    }

    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ul) {
      flushPara()
      if (listType && listType !== 'ul') flushList()
      listType = 'ul'
      listBuf.push(ul[1])
      i++
      continue
    }
    if (ol) {
      flushPara()
      if (listType && listType !== 'ol') flushList()
      listType = 'ol'
      listBuf.push(ol[1])
      i++
      continue
    }

    if (line.trim() === '') { flushPara(); flushList(); i++; continue }

    flushList()
    paraBuf.push(line.trim())
    i++
  }
  flushPara(); flushList()
  return blocks
}

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(p => p !== '')
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ color: 'rgb(var(--c-text-primary))', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={inlineCodeStyle}>{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

const inlineCodeStyle: CSSProperties = {
  background: 'rgba(225,25,25,0.1)',
  color: 'rgb(var(--c-code-accent))',
  padding: '1px 5px',
  fontSize: '0.82em',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ margin: '6px 0', border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', background: 'rgb(var(--c-bg-base))' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
        fontSize: '0.62rem', letterSpacing: '0.08em', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', textTransform: 'uppercase',
      }}>
        <span>{lang || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 'inherit' }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '10px 12px', overflowX: 'auto' }}>
        <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.78rem', color: 'rgb(var(--c-text-primary))', whiteSpace: 'pre' }}>
          {code}
        </code>
      </pre>
    </div>
  )
}

const headingStyle: Record<1 | 2 | 3, CSSProperties> = {
  1: { fontSize: '0.98rem', fontWeight: 700, color: 'rgb(var(--c-text-primary))', margin: '10px 0 4px' },
  2: { fontSize: '0.9rem', fontWeight: 700, color: 'rgb(var(--c-text-primary))', margin: '8px 0 4px' },
  3: { fontSize: '0.82rem', fontWeight: 700, color: 'rgb(var(--c-text-primary) / 0.9)', margin: '6px 0 3px' },
}

export function ChatMarkdown({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {blocks.map((b, i) => {
        const key = i
        switch (b.type) {
          case 'heading':
            return <p key={key} style={headingStyle[b.level]}><InlineText text={b.text} /></p>
          case 'ul':
            return (
              <ul key={key} style={{ margin: '2px 0', paddingLeft: 18 }}>
                {b.items.map((it, j) => <li key={j} style={{ marginBottom: 3 }}><InlineText text={it} /></li>)}
              </ul>
            )
          case 'ol':
            return (
              <ol key={key} style={{ margin: '2px 0', paddingLeft: 18 }}>
                {b.items.map((it, j) => <li key={j} style={{ marginBottom: 3 }}><InlineText text={it} /></li>)}
              </ol>
            )
          case 'code':
            return <CodeBlock key={key} lang={b.lang} code={b.code} />
          case 'p':
          default:
            return <p key={key} style={{ margin: '2px 0' }}><InlineText text={b.text} /></p>
        }
      })}
    </div>
  )
}
