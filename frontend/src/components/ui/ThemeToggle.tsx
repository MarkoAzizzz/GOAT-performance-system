import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../hooks/ThemeContext'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-input-bg border border-overlay/8" style={{ width: 'fit-content' }}>
      {([
        { value: 'dark' as const, label: 'Dark', Icon: Moon },
        { value: 'light' as const, label: 'Light', Icon: Sun },
      ]).map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-display uppercase tracking-[0.18em] transition-all"
            style={{
              background: active ? 'linear-gradient(135deg,#E11919,#B90F16)' : 'transparent',
              color: active ? '#fff' : 'rgb(var(--c-text-secondary))',
              cursor: 'pointer',
              border: 'none',
              clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
