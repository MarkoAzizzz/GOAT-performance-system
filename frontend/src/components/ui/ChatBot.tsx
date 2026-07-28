import { useState, useEffect, useRef } from 'react'
import { X, Send, Maximize2, Minimize2, Copy, Check, RefreshCw, Square, History, MessageSquarePlus, MessageSquare, Trash2, ArrowLeft, Plus } from 'lucide-react'
import { useAuth } from '../../features/auth/AuthContext'
import { ChatMarkdown } from './ChatMarkdown'

// ── Types ──────────────────────────────────────────────

interface Message {
  id: string
  from: 'bot' | 'user'
  text: string
  time: number
  streaming?: boolean
}

interface GroqMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  history: GroqMessage[]
  updatedAt: number
}

function uid() { return Math.random().toString(36).slice(2) }
function botMsg(text: string, streaming = false): Message { return { id: uid(), from: 'bot', text, time: Date.now(), streaming } }
function userMsg(text: string): Message { return { id: uid(), from: 'user', text, time: Date.now() } }
function makeTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length > 42 ? t.slice(0, 42) + '…' : t
}
function timeAgo(ts: number): string {
  const min = Math.floor((Date.now() - ts) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

function groupConversationsByDate(convs: Conversation[]): { label: string; items: Conversation[] }[] {
  const now = new Date()
  const todayStr = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000

  const buckets: Record<string, Conversation[]> = { Today: [], Yesterday: [], 'This Week': [], Older: [] }
  for (const c of convs) {
    const d = new Date(c.updatedAt).toDateString()
    if (d === todayStr) buckets.Today.push(c)
    else if (d === yesterdayStr) buckets.Yesterday.push(c)
    else if (c.updatedAt >= weekAgo) buckets['This Week'].push(c)
    else buckets.Older.push(c)
  }
  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

const SUGGESTIONS = [
  "What's my current grade?",
  'How do I improve my jab?',
  'Boxing vs kickboxing footwork',
  'Give me a home conditioning workout',
]

// Chat history is scoped per logged-in user id so admin and each student see
// only their own conversations on a shared browser/device.
function conversationsKey(userId: string) { return `goat_chat_conversations_${userId}` }
function activeIdKey(userId: string) { return `goat_chat_active_${userId}` }

function loadConversations(userId: string): Conversation[] {
  try { const r = localStorage.getItem(conversationsKey(userId)); return r ? JSON.parse(r) : [] } catch { return [] }
}
function loadActiveId(userId: string): string | null {
  try { return localStorage.getItem(activeIdKey(userId)) } catch { return null }
}
function saveConversations(userId: string, convs: Conversation[]) {
  localStorage.setItem(conversationsKey(userId), JSON.stringify(convs.slice(-20).map(c => ({
    ...c,
    messages: c.messages.slice(-60),
    history: c.history.slice(-40),
  }))))
}
function saveActiveId(userId: string, id: string | null) {
  if (id) localStorage.setItem(activeIdKey(userId), id)
  else localStorage.removeItem(activeIdKey(userId))
}

// ── Streaming API call ─────────────────────────────────

async function streamChat(history: GroqMessage[], onChunk: (text: string) => void, signal: AbortSignal): Promise<string> {
  const token = localStorage.getItem('access_token')
  const base = import.meta.env.VITE_API_URL ?? '/api/v1'
  const res = await fetch(`${base}/chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages: history }),
    signal,
  })
  if (!res.ok || !res.body) throw new Error('Request failed')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(chunk)
  }
  return full
}

// ── Component ──────────────────────────────────────────

export function ChatBot() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [hasUnread, setHasUnread] = useState(false)
  const openRef = useRef(open)

  const activeConv = conversations.find(c => c.id === activeId) ?? null
  const messages = activeConv?.messages ?? []

  // Load this account's own conversations whenever the logged-in user changes.
  useEffect(() => {
    if (!user) return
    const convs = loadConversations(user.id)
    const savedActive = loadActiveId(user.id)
    setConversations(convs)
    setActiveId(savedActive && convs.some(c => c.id === savedActive) ? savedActive : null)
    setView('chat')
  }, [user?.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming])

  useEffect(() => {
    if (open && view === 'chat') setTimeout(() => textareaRef.current?.focus(), 150)
  }, [open, view])

  useEffect(() => {
    openRef.current = open
    if (open) setHasUnread(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function updateConversation(id: string, patch: Partial<Conversation>) {
    if (!user) return
    setConversations(prev => {
      const next = prev.map(c => (c.id === id ? { ...c, ...patch } : c))
      saveConversations(user.id, next)
      return next
    })
  }

  // Ephemeral UI-only update used while a reply is still streaming in — avoids
  // writing the whole conversation list to localStorage on every token. The
  // final text gets persisted once via updateConversation in runStream's `finally`.
  function updateConversationLive(id: string, patch: Partial<Conversation>) {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)))
  }

  async function runStream(convId: string, hist: GroqMessage[], baseMessages: Message[]) {
    const botId = uid()
    updateConversationLive(convId, { messages: [...baseMessages, { ...botMsg('', true), id: botId }] })
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    let fullText = ''
    try {
      await streamChat(hist, (chunk) => {
        fullText += chunk
        updateConversationLive(convId, { messages: [...baseMessages, { id: botId, from: 'bot', text: fullText, time: Date.now(), streaming: true }] })
      }, controller.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        fullText = fullText || 'Connection error. Make sure the backend is running.'
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      const finalMessages = [...baseMessages, { id: botId, from: 'bot' as const, text: fullText, time: Date.now() }]
      const finalHistory = fullText ? [...hist, { role: 'assistant' as const, content: fullText }] : hist
      updateConversation(convId, { messages: finalMessages, history: finalHistory, updatedAt: Date.now() })
      if (!openRef.current) setHasUnread(true)
    }
  }

  function sendText(rawText: string) {
    if (!user) return
    const trimmed = rawText.trim()
    if (!trimmed || streaming) return
    setInput('')
    requestAnimationFrame(resizeTextarea)

    const current = conversations.find(c => c.id === activeId)
    const isNew = !current
    const convId = current?.id ?? uid()
    const baseMessages = [...(current?.messages ?? []), userMsg(trimmed)]
    const baseHistory = [...(current?.history ?? []), { role: 'user' as const, content: trimmed }]

    const updatedConv: Conversation = {
      id: convId,
      title: current?.title ?? makeTitle(trimmed),
      messages: baseMessages,
      history: baseHistory,
      updatedAt: Date.now(),
    }
    setConversations(prev => {
      const next = isNew ? [updatedConv, ...prev] : prev.map(c => (c.id === convId ? updatedConv : c))
      saveConversations(user.id, next)
      return next
    })
    setActiveId(convId)
    saveActiveId(user.id, convId)

    runStream(convId, baseHistory, baseMessages)
  }

  function send() { sendText(input) }

  function stopStreaming() {
    abortRef.current?.abort()
  }

  function retryLast() {
    if (streaming || !activeConv) return
    const last = activeConv.messages[activeConv.messages.length - 1]
    if (!last || last.from !== 'bot') return
    const trimmedMessages = activeConv.messages.slice(0, -1)
    const trimmedHistory = activeConv.history[activeConv.history.length - 1]?.role === 'assistant'
      ? activeConv.history.slice(0, -1)
      : activeConv.history
    updateConversation(activeConv.id, { messages: trimmedMessages, history: trimmedHistory })
    runStream(activeConv.id, trimmedHistory, trimmedMessages)
  }

  function copyMessage(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1300)
    })
  }

  function newChat() {
    if (!user) return
    abortRef.current?.abort()
    setStreaming(false)
    setActiveId(null)
    saveActiveId(user.id, null)
    setView('chat')
  }

  function selectConversation(id: string) {
    if (!user) return
    abortRef.current?.abort()
    setStreaming(false)
    setActiveId(id)
    saveActiveId(user.id, id)
    setView('chat')
  }

  function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!user) return
    setConversations(prev => {
      const next = prev.filter(c => c.id !== id)
      saveConversations(user.id, next)
      return next
    })
    if (activeId === id) {
      setActiveId(null)
      saveActiveId(user.id, null)
    }
  }

  if (!user) return null

  const name = user.fullName?.split(' ')[0] ?? 'there'
  // Capped against the viewport so the panel (anchored to the bottom) never
  // grows taller/wider than the window — otherwise its top, including the
  // header, gets pushed above the visible area on shorter screens.
  const panelWidth = `min(${expanded ? 460 : 378}px, calc(100vw - 40px))`
  const panelHeight = `min(${expanded ? 680 : 540}px, calc(100vh - 130px))`
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
  const conversationGroups = groupConversationsByDate(sortedConversations)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close Box chat' : 'Open Box chat'}
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 999,
          width: 56, height: 56, borderRadius: '50%',
          border: 'none', padding: 0, cursor: 'pointer', background: 'none',
          boxShadow: open
            ? '0 0 0 3px rgba(225,25,25,0.6), 0 8px 32px rgba(0,0,0,0.7)'
            : '0 0 0 2px rgba(225,25,25,0.3), 0 8px 24px rgba(0,0,0,0.5)',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
      >
        <img src="/logo-badge.png" alt="GOAT Chat"
          style={{ width: 56, height: 56, borderRadius: '50%', display: 'block', filter: 'drop-shadow(0 0 8px rgba(225,25,25,0.6))' }} />
        {hasUnread && !open && (
          <span aria-hidden="true" style={{
            position: 'absolute', top: 1, right: 1, width: 14, height: 14, borderRadius: '50%',
            background: '#E11919', border: '2px solid rgb(var(--c-bg-base))', boxShadow: '0 0 8px rgba(225,25,25,0.9)',
          }} />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="chat-panel-glow" style={{
          position: 'fixed', bottom: 96, right: 28, zIndex: 998,
          width: panelWidth, height: panelHeight,
          background: 'rgb(var(--c-bg-surface))',
          border: '1.5px solid rgba(225,25,25,0.35)',
          display: 'flex', flexDirection: 'column',
          clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)',
          transition: 'width 0.2s ease, height 0.2s ease',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
            background: 'rgb(var(--c-bg-header))',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            {view === 'history' ? (
              <button onClick={() => setView('chat')} title="Back to chat" aria-label="Back to chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.6 * var(--c-sec-mult)))', padding: 4, display: 'flex' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.6 * var(--c-sec-mult)))' }}>
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div style={{ position: 'relative' }}>
                <img src="/logo-badge.png" alt="GOAT" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                <span style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 9, height: 9, borderRadius: '50%',
                  background: '#34d399', border: '2px solid rgb(var(--c-bg-header))',
                }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgb(var(--c-text-primary))', fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>
                {view === 'history' ? 'History' : 'Box'}
              </p>
              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.58rem', margin: 0 }}>
                {view === 'history' ? `${conversations.length} conversation${conversations.length === 1 ? '' : 's'}` : 'Undefeated in the AI Realm'}
              </p>
            </div>
            {view === 'chat' && (
              <>
                <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Collapse' : 'Expand'} aria-label={expanded ? 'Collapse chat panel' : 'Expand chat panel'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', padding: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}>
                  {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
                <button onClick={() => setView('history')} title="History" aria-label="View conversation history"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', padding: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}>
                  <History size={13} />
                </button>
                <button onClick={newChat} title="New chat" aria-label="Start new chat"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', padding: 4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#fbbf24' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}>
                  <MessageSquarePlus size={14} />
                </button>
              </>
            )}
            <button onClick={() => setOpen(false)} title="Close" aria-label="Close chat"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', padding: 4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E11919' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}>
              <X size={15} />
            </button>
          </div>

          {view === 'history' ? (
            /* History list */
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
              <button
                onClick={newChat}
                aria-label="Start new conversation"
                className="chat-newconv-card"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '11px 12px', marginBottom: 16, cursor: 'pointer',
                  background: 'rgba(225,25,25,0.05)', border: '1px dashed rgba(225,25,25,0.4)',
                  color: 'rgb(var(--c-text-primary))', fontSize: '0.72rem', fontWeight: 600,
                  clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)',
                }}
              >
                <Plus size={14} style={{ color: '#E11919' }} />
                Start New Conversation
              </button>

              {sortedConversations.length === 0 ? (
                <div style={{ textAlign: 'center', marginTop: 36 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
                    background: 'rgba(225,25,25,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <History size={20} style={{ color: 'rgba(225,25,25,0.5)' }} />
                  </div>
                  <p style={{ color: 'rgb(var(--c-text-primary) / 0.6)', fontSize: '0.74rem', margin: 0 }}>No conversations yet</p>
                  <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.64rem', margin: '4px 0 0' }}>
                    Start chatting with Box to build your history here.
                  </p>
                </div>
              ) : (
                (() => {
                  let idx = 0
                  return conversationGroups.map(group => (
                    <div key={group.label} style={{ marginBottom: 16 }}>
                      <p style={{
                        color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.22em',
                        textTransform: 'uppercase', margin: '0 0 6px 4px',
                      }}>
                        {group.label}
                      </p>
                      {group.items.map(c => {
                        const delay = idx++ * 35
                        return (
                          <div
                            key={c.id}
                            onClick={() => selectConversation(c.id)}
                            className="chat-history-item"
                            style={{
                              position: 'relative', display: 'flex', alignItems: 'center', gap: 10,
                              padding: '10px 12px 10px 14px', marginBottom: 6, cursor: 'pointer', overflow: 'hidden',
                              background: c.id === activeId ? 'rgba(225,25,25,0.09)' : 'rgb(var(--c-overlay) / calc(0.02 * var(--c-ovl-mult)))',
                              border: `1px solid ${c.id === activeId ? 'rgba(225,25,25,0.3)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))'}`,
                              clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)',
                              animation: `historyItemIn 0.25s ease both`,
                              animationDelay: `${delay}ms`,
                            }}
                          >
                            <div style={{
                              position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                              background: c.id === activeId ? 'linear-gradient(to bottom,#E11919,#7C0D12)' : 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))',
                            }} />
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(225,25,25,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <MessageSquare size={12} style={{ color: '#E11919' }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: 'rgb(var(--c-text-primary))', fontSize: '0.73rem', fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.title || 'New chat'}
                              </p>
                              <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.6rem', margin: '2px 0 0' }}>
                                {timeAgo(c.updatedAt)} · {c.messages.length} messages
                              </p>
                            </div>
                            <button
                              onClick={e => deleteConversation(c.id, e)}
                              title="Delete conversation"
                              aria-label={`Delete conversation: ${c.title || 'New chat'}`}
                              className="chat-history-delete"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))', padding: 4, display: 'flex', flexShrink: 0 }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#E11919' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.35 * var(--c-sec-mult)))' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {messages.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <img src="/logo-badge.png" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{
                        maxWidth: '85%', padding: '10px 14px', background: 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                        border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))', color: 'rgb(var(--c-text-primary))', fontSize: '0.74rem', lineHeight: 1.7,
                        clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                      }}>
                        Hey {name}! 👋 I'm Box, your GOAT AI coach.
                        <br /><br />
                        Ask me anything — boxing technique, kickboxing tips, how to improve your grade, nutrition, mental game, or anything else!
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 34 }}>
                      {SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => sendText(s)}
                          style={{
                            background: 'rgba(225,25,25,0.06)', border: '1px solid rgba(225,25,25,0.22)',
                            color: 'rgb(var(--c-text-primary) / 0.85)', fontSize: '0.68rem', padding: '6px 10px',
                            cursor: 'pointer', textAlign: 'left', lineHeight: 1.3,
                            clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.14)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.06)' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => {
                  const isLastBot = msg.from === 'bot' && idx === messages.length - 1 && !msg.streaming
                  return (
                    <div key={msg.id} className="chat-msg-row" style={{
                      display: 'flex',
                      justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-end', gap: 8,
                    }}>
                      {msg.from === 'bot' && (
                        <img src="/logo-badge.png" style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '85%', gap: 3 }}>
                        <div style={{
                          padding: '10px 14px',
                          background: msg.from === 'user'
                            ? 'linear-gradient(135deg,#E11919,#B90F16)'
                            : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                          border: msg.from === 'bot' ? '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' : 'none',
                          color: 'rgb(var(--c-text-primary))',
                          fontSize: '0.74rem',
                          lineHeight: 1.7,
                          wordBreak: 'break-word',
                          clipPath: msg.from === 'user'
                            ? 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)'
                            : 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,6px 100%,0 calc(100% - 6px))',
                        }}>
                          {msg.from === 'bot'
                            ? (msg.text
                              ? <ChatMarkdown text={msg.text} />
                              : msg.streaming
                                ? <span className="chat-dots"><span /><span /><span /></span>
                                : <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontStyle: 'italic' }}>No response.</span>)
                            : <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>}
                        </div>

                        {/* Hover actions */}
                        {msg.text && !msg.streaming && (
                          <div className="chat-msg-actions" style={{
                            display: 'flex', gap: 8, alignItems: 'center',
                            justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
                            paddingLeft: msg.from === 'bot' ? 2 : 0,
                          }}>
                            <button
                              onClick={() => copyMessage(msg.id, msg.text)}
                              title="Copy"
                              aria-label="Copy message"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', padding: 2, display: 'flex' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))' }}
                            >
                              {copiedId === msg.id ? <Check size={11} /> : <Copy size={11} />}
                            </button>
                            {isLastBot && (
                              <button
                                onClick={retryLast}
                                title="Regenerate"
                                aria-label="Regenerate response"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', padding: 2, display: 'flex' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-primary))' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))' }}
                              >
                                <RefreshCw size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '10px 12px',
                borderTop: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))',
                display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0,
                background: 'rgb(var(--c-bg-surface))',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  rows={1}
                  onChange={e => { setInput(e.target.value); resizeTextarea() }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  placeholder="Ask Box about boxing, kickboxing, or your grade..."
                  disabled={streaming}
                  style={{
                    flex: 1,
                    resize: 'none',
                    background: 'rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))',
                    border: '1px solid rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))',
                    color: 'rgb(var(--c-text-primary))', fontSize: '0.74rem', fontFamily: 'inherit',
                    padding: '9px 12px', outline: 'none',
                    maxHeight: 120,
                    clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%)',
                    opacity: streaming ? 0.5 : 1,
                  }}
                  onFocus={e => { (e.target as HTMLElement).style.borderColor = 'rgba(225,25,25,0.45)' }}
                  onBlur={e => { (e.target as HTMLElement).style.borderColor = 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))' }}
                />
                {streaming ? (
                  <button onClick={stopStreaming} title="Stop generating" aria-label="Stop generating"
                    style={{
                      background: 'rgb(var(--c-overlay) / calc(0.08 * var(--c-ovl-mult)))', border: 'none', cursor: 'pointer', color: 'rgb(var(--c-text-primary))',
                      width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%)',
                    }}>
                    <Square size={12} fill="currentColor" />
                  </button>
                ) : (
                  <button onClick={send} disabled={!input.trim()} aria-label="Send message"
                    style={{
                      background: input.trim() ? 'linear-gradient(135deg,#E11919,#B90F16)' : 'rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
                      border: 'none',
                      cursor: input.trim() ? 'pointer' : 'default',
                      color: input.trim() ? '#fff' : 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))',
                      width: 36, height: 36,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0,
                      clipPath: 'polygon(0 0,calc(100% - 5px) 0,100% 5px,100% 100%,0 100%)',
                    }}>
                    <Send size={14} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatPanelGlow {
          0%, 100% { border-color: rgba(225,25,25,0.35); box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 16px rgba(225,25,25,0.22); }
          50%      { border-color: rgba(225,25,25,0.95); box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 34px rgba(225,25,25,0.6); }
        }
        .chat-panel-glow { animation: chatSlideUp 0.2s ease, chatPanelGlow 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .chat-panel-glow { animation: chatSlideUp 0.2s ease; box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 16px rgba(225,25,25,0.22); }
        }
        @keyframes typingDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .chat-dots { display: inline-flex; gap: 5px; align-items: center; padding: 2px 0; }
        .chat-dots span {
          width: 6px; height: 6px; border-radius: 50%; background: #E11919; display: inline-block;
          animation: typingDot 1.2s ease-in-out infinite;
        }
        .chat-dots span:nth-child(2) { animation-delay: 0.2s; }
        .chat-dots span:nth-child(3) { animation-delay: 0.4s; }
        .chat-msg-actions { opacity: 0; transition: opacity 0.15s ease; }
        .chat-msg-row:hover .chat-msg-actions { opacity: 1; }
        .chat-history-delete { opacity: 0; transition: opacity 0.15s ease; }
        .chat-history-item:hover .chat-history-delete { opacity: 1; }
        @keyframes historyItemIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .chat-history-item {
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .chat-history-item:hover {
          transform: translateX(2px);
          box-shadow: 0 4px 18px rgba(0,0,0,0.4);
        }
        .chat-newconv-card {
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .chat-newconv-card:hover {
          background: rgba(225,25,25,0.12) !important;
          border-color: rgba(225,25,25,0.65) !important;
        }
      `}</style>
    </>
  )
}
