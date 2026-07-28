type Variant = 'beginner' | 'intermediate' | 'advanced' | 'boxing' | 'kickboxing' | 'success' | 'error' | 'warning' | 'default'

const styles: Record<Variant, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  intermediate: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  advanced: 'bg-blood-red/10 text-blood-red border-blood-red/20',
  boxing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  kickboxing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  error: 'bg-blood-red/10 text-blood-red border-blood-red/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  default: 'bg-overlay/5 text-steel-gray border-overlay/10',
}

interface Props {
  variant?: Variant
  children: React.ReactNode
}

export function Badge({ variant = 'default', children }: Props) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs uppercase tracking-wider border ${styles[variant]}`}>
      {children}
    </span>
  )
}
