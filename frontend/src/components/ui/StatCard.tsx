import { type LucideIcon } from 'lucide-react'
import { useCountUp } from '../../hooks/useCountUp'

interface Props {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  trend?: 'up' | 'down' | null
  icon?: LucideIcon
}

function AnimatedNumber({ value }: { value: number }) {
  const isDecimal = !Number.isInteger(value)
  const displayed = useCountUp(value, 900, isDecimal ? 1 : 0)
  return <>{isDecimal ? displayed.toFixed(1) : Math.round(displayed)}</>
}

export function StatCard({ label, value, sub, accent, trend, icon: Icon }: Props) {
  const isNumeric = typeof value === 'number'
  const isPercentStr = typeof value === 'string' && value.endsWith('%')
  const numericVal = isPercentStr ? parseFloat(value) : (isNumeric ? value : null)

  return (
    <div
      className="relative overflow-hidden flex flex-col gap-2 group animate-slide-up"
      style={{
        background: accent
          ? 'linear-gradient(145deg, rgb(var(--c-accent-wash)) 0%, rgb(var(--c-bg-elevated)) 100%)'
          : 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
        border: accent ? '1px solid rgb(var(--c-accent-border-rgb) / var(--c-accent-border-a))' : '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
        boxShadow: 'var(--c-card-shadow)',
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
        padding: '18px 18px 16px',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)'
        e.currentTarget.style.boxShadow = accent
          ? '0 0 0 1px rgba(225,25,25,0.28), 0 12px 32px rgba(0,0,0,0.6), 0 0 40px rgba(225,25,25,0.1)'
          : '0 0 0 1px rgba(225,25,25,0.12), 0 12px 32px rgba(0,0,0,0.5)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = ''
      }}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-px transition-opacity duration-300
        ${accent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.3) 55%, transparent)' }}
      />
      {/* Left accent bar */}
      <div className={`absolute top-0 left-0 bottom-0 w-[2px] transition-opacity duration-300
        ${accent ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
        style={{ background: 'linear-gradient(to bottom, #E11919, rgba(225,25,25,0.1) 60%, transparent)' }}
      />

      {/* Icon + label row */}
      <div className="flex items-center justify-between">
        <p style={{
          color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))',
          fontSize: '0.56rem',
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}>
          {label}
        </p>
        {Icon && (
          <Icon
            size={13}
            className={`transition-colors duration-300 ${accent ? 'text-blood-red/60' : 'text-steel-gray/30 group-hover:text-blood-red/50'}`}
          />
        )}
      </div>

      {/* Value */}
      <p className={`font-display leading-none ${accent ? 'text-blood-red' : 'text-off-white'}`}
        style={{ fontSize: '2rem', letterSpacing: '0.04em' }}>
        {numericVal !== null
          ? <><AnimatedNumber value={numericVal} />{isPercentStr ? '%' : ''}</>
          : value
        }
      </p>

      {/* Sub label */}
      {sub && (
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))', fontSize: '0.56rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {sub}
        </p>
      )}

      {trend && (
        <p className={`text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : 'text-blood-red'}`}>
          {trend === 'up' ? '▲' : '▼'}
        </p>
      )}

      {/* Subtle red glow on accent hover */}
      {accent && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at bottom right, rgba(225,25,25,0.06) 0%, transparent 70%)' }} />
      )}
    </div>
  )
}
