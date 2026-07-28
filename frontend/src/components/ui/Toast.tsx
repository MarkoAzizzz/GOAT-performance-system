import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }

interface ToastCtx { toast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(ToastContext)

let _id = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++_id
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const dismiss = (id: number) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 animate-slide-up"
            style={{
              background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)), rgb(var(--c-bg-input)))',
              border: t.type === 'success'
                ? '1px solid rgba(52,211,153,0.3)'
                : t.type === 'error'
                  ? '1px solid rgba(225,25,25,0.35)'
                  : '1px solid rgb(var(--c-overlay) / calc(0.1 * var(--c-ovl-mult)))',
              clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
              minWidth: 260, maxWidth: 380,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}>
            <div className="shrink-0">
              {t.type === 'success' && <CheckCircle size={14} style={{ color: '#34d399' }} />}
              {t.type === 'error'   && <XCircle     size={14} style={{ color: '#E11919' }} />}
              {t.type === 'info'    && <AlertCircle size={14} style={{ color: 'rgb(var(--c-text-secondary))' }} />}
            </div>
            <p className="flex-1 text-off-white text-xs">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-steel-gray/40 hover:text-steel-gray transition-colors">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
