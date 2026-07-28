import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import {
  LayoutDashboard, TrendingUp, ClipboardList, Trophy, User, LogOut, Menu, X, ChevronRight,
} from 'lucide-react'
import { LiveClock } from '../components/ui/LiveClock'
import { ChatBot } from '../components/ui/ChatBot'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/progress', icon: TrendingUp, label: 'My Progress' },
  { to: '/history', icon: ClipboardList, label: 'History' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/profile', icon: User, label: 'Profile' },
]

export function StudentLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initial = user?.fullName?.[0]?.toUpperCase() ?? 'S'

  return (
    <div className="min-h-screen bg-coal flex scanlines">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-overlay/[0.05]
        flex flex-col transition-transform duration-300 ease-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:flex
      `}>
        <div className="px-5 py-6 border-b border-overlay/[0.05] flex items-center gap-3">
          <div className="logo-pulse-ring shrink-0">
            <img
              src="/logo-badge.png"
              alt="GOAT"
              style={{ width: 52, height: 52, borderRadius: '50%', filter: 'drop-shadow(0 0 8px rgba(225,25,25,0.55))' }}
            />
          </div>
          <div>
            <h1 className="font-display text-blood-red text-3xl tracking-[0.18em] leading-none">GOAT</h1>
            <p className="text-steel-gray/50 text-[9px] uppercase tracking-[0.28em] mt-1">Student Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, end }, i) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 text-xs transition-all duration-200 relative
                animate-slide-in-left stagger-${Math.min(i + 1, 6)}
                ${isActive
                  ? 'bg-blood-red/10 text-off-white nav-active-glow'
                  : 'text-steel-gray hover:text-off-white hover:bg-overlay/[0.035] border-l-2 border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={15}
                    className={`transition-all duration-200 ${isActive
                      ? 'text-blood-red drop-shadow-[0_0_6px_rgba(225,25,25,0.8)]'
                      : 'text-steel-gray group-hover:text-off-white'
                    }`}
                  />
                  <span className="uppercase tracking-[0.12em] font-medium">{label}</span>
                  {isActive && (
                    <ChevronRight size={11} className="ml-auto text-blood-red/70 animate-fade-in" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 py-4 border-t border-overlay/[0.05] space-y-1">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 bg-blood-red/10 border border-blood-red/20 flex items-center justify-center clip-corner-sm shrink-0
              transition-all duration-300 hover:bg-blood-red/20 hover:border-blood-red/40">
              <span className="text-blood-red text-xs font-display">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-off-white text-xs font-medium truncate">{user?.fullName}</p>
              <p className="text-steel-gray/50 text-[9px] uppercase tracking-wider">Student</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-steel-gray hover:text-blood-red text-xs transition-all duration-200 group hover:bg-blood-red/5"
          >
            <LogOut size={13} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="uppercase tracking-[0.12em]">Sign Out</span>
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden animate-fade-in" onClick={() => setOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-sidebar border-b border-overlay/[0.05] flex items-center px-6 gap-4 sticky top-0 z-30">
          <button className="lg:hidden text-steel-gray hover:text-off-white transition-colors" onClick={() => setOpen(!open)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="hidden lg:block h-3 w-px bg-overlay/10" />
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-red" />
            <span className="text-[9px] uppercase tracking-widest text-emerald-400/60">Live</span>
          </div>
          <div className="h-3 w-px bg-overlay/10" />
          <LiveClock />
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-auto combat-grid-bg">
          <div className="max-w-[1200px] mx-auto animate-slide-up">
            <Outlet />
          </div>
        </main>
      </div>
      <ChatBot />
    </div>
  )
}
