import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock } from 'lucide-react'
import { useAuth } from './AuthContext'

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
})
type FormData = z.infer<typeof schema>

const TAP_LETTERS = 'TAP TO ENTER'.split('')

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [phase, setPhase] = useState<'intro' | 'form'>('intro')
  const [go, setGo] = useState(false)
  const [showForgotHelp, setShowForgotHelp] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setGo(true), 80)
    return () => clearTimeout(t)
  }, [])

  const handleEnter = () => {
    setPhase('form')
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      const me = await login(data.email, data.password)
      navigate(me.role === 'admin' ? '/admin' : '/dashboard', { replace: true })
    } catch {
      setServerError('Invalid email or password.')
    }
  }

  return (
    <div data-theme="dark" className="min-h-screen bg-[#020202] flex items-center justify-center overflow-hidden relative">

      <style>{`
        /* ── Intro sequence ────────────────────────────── */
        @keyframes spotlight-expand {
          0%   { opacity: 0; transform: scale(0.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes badge-spin-in {
          0%   { transform: rotate(-200deg) scale(0.3); opacity: 0; filter: brightness(2.5); }
          65%  { transform: rotate(6deg)   scale(1.08); opacity: 1; filter: brightness(1.1); }
          80%  { transform: rotate(-2deg)  scale(0.97); filter: brightness(1); }
          90%  { transform: rotate(1deg)   scale(1.02); }
          100% { transform: rotate(0deg)   scale(1);    opacity: 1; filter: brightness(1); }
        }
        @keyframes burst-1 {
          0%   { transform: scale(0.95); opacity: 1;   border-width: 3px; }
          100% { transform: scale(3.6);  opacity: 0;   border-width: 0px; }
        }
        @keyframes burst-2 {
          0%   { transform: scale(0.95); opacity: 0.7; border-width: 2px; }
          100% { transform: scale(4.8);  opacity: 0;   border-width: 0px; }
        }
        @keyframes burst-3 {
          0%   { transform: scale(0.95); opacity: 0.4; border-width: 1px; }
          100% { transform: scale(6.2);  opacity: 0;   border-width: 0px; }
        }
        @keyframes wordmark-write {
          from { clip-path: inset(0 100% 0 0); }
          to   { clip-path: inset(0 0%   0 0); }
        }
        @keyframes line-right {
          from { transform: scaleX(0); transform-origin: left center; }
          to   { transform: scaleX(1); transform-origin: left center; }
        }
        @keyframes line-left {
          from { transform: scaleX(0); transform-origin: right center; }
          to   { transform: scaleX(1); transform-origin: right center; }
        }
        @keyframes fade-up-soft {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes letter-drop {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cursor-blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes vert-line {
          from { transform: scaleY(0); transform-origin: top center; opacity: 0; }
          to   { transform: scaleY(1); transform-origin: top center; opacity: 1; }
        }

        /* ── Continuous ───────────────────────────────── */
        @keyframes badge-breathe {
          0%,100% { filter: drop-shadow(0 0 28px rgba(225,25,25,0.55)) drop-shadow(0 0 80px rgba(225,25,25,0.18)); }
          50%      { filter: drop-shadow(0 0 55px rgba(225,25,25,0.9))  drop-shadow(0 0 130px rgba(225,25,25,0.32)); }
        }
        @keyframes badge-breathe-sm {
          0%,100% { filter: drop-shadow(0 0 18px rgba(225,25,25,0.5)); }
          50%      { filter: drop-shadow(0 0 34px rgba(225,25,25,0.85)); }
        }
        @keyframes ring-idle {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes ring-idle2 {
          0%   { transform: scale(1);   opacity: 0.28; }
          100% { transform: scale(3.0); opacity: 0; }
        }
        @keyframes slash-drift {
          0%   { background-position: 0 0; }
          100% { background-position: 80px 80px; }
        }
        @keyframes tap-pulse {
          0%,100% { opacity: 0.35; transform: scale(1); }
          50%      { opacity: 0.8;  transform: scale(1.02); }
        }
        @keyframes word-glow-anim {
          0%,100% { filter: invert(1) hue-rotate(180deg) drop-shadow(0 0 18px rgba(225,25,25,0.6)); }
          50%      { filter: invert(1) hue-rotate(180deg) drop-shadow(0 0 36px rgba(225,25,25,1.0)) drop-shadow(0 0 70px rgba(225,25,25,0.4)); }
        }
        @keyframes word-glow-sm {
          0%,100% { filter: invert(1) hue-rotate(180deg) drop-shadow(0 0 12px rgba(225,25,25,0.5)); }
          50%      { filter: invert(1) hue-rotate(180deg) drop-shadow(0 0 24px rgba(225,25,25,0.9)); }
        }
        @keyframes line-expand {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes form-rise {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .badge-breathe    { animation: badge-breathe    4s ease-in-out infinite; }
        .badge-breathe-sm { animation: badge-breathe-sm 4s ease-in-out infinite; }
        .word-glow-cont   { animation: word-glow-anim   4s ease-in-out infinite 2s; }
        .word-glow-sm     { animation: word-glow-sm     4s ease-in-out infinite; }
      `}</style>

      {/* ── Always-on BG ─────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(135deg,rgba(225,25,25,0.025) 0px,rgba(225,25,25,0.025) 1px,transparent 1px,transparent 42px)',
        animation: 'slash-drift 16s linear infinite',
      }} />
      {/* Ghost watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="font-display leading-none tracking-widest"
          style={{ fontSize:'clamp(120px,32vw,480px)', color:`rgba(255,255,255,${phase==='intro'?0.022:0.014})`, userSelect:'none', transition:'color 1s ease' }}>
          GOAT
        </span>
      </div>
      {/* Corner brackets */}
      {(['top-5 left-5 border-t-2 border-l-2','top-5 right-5 border-t-2 border-r-2','bottom-5 left-5 border-b-2 border-l-2','bottom-5 right-5 border-b-2 border-r-2'] as const).map((cls,i) => (
        <div key={i} className={`absolute w-7 h-7 border-blood-red/32 ${cls} pointer-events-none`}
          style={{ opacity: go ? 1 : 0, transition:`opacity 0.5s ease ${0.3+i*0.07}s` }} />
      ))}
      {/* Top line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none" style={{
        background: 'linear-gradient(to right,transparent,#E11919 25%,#E11919 75%,transparent)',
        opacity: go ? 1 : 0, transition: 'opacity 0.8s ease 0.5s',
      }} />

      {/* ══════════════════════════════════════════════ */}
      {/* PHASE 1 — INTRO                               */}
      {/* ══════════════════════════════════════════════ */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{
        opacity: phase === 'form' ? 0 : 1,
        pointerEvents: phase === 'form' ? 'none' : 'auto',
        transition: 'opacity 0.6s cubic-bezier(0.4,0,0.2,1)',
      }}>

        {/* Spotlight glow behind badge */}
        {go && (
          <div className="absolute pointer-events-none" style={{
            width: 600, height: 600,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(225,25,25,0.16) 0%, rgba(225,25,25,0.06) 40%, transparent 70%)',
            animation: 'spotlight-expand 1.0s cubic-bezier(0.22,0.61,0.36,1) forwards',
          }} />
        )}

        {/* Badge */}
        <div className="relative flex items-center justify-center cursor-pointer" onClick={handleEnter}>

          {/* Burst rings — fire on spin completion */}
          {go && <>
            <div className="absolute rounded-full border-blood-red pointer-events-none" style={{
              width: 280, height: 280,
              animation: 'burst-1 0.65s ease-out forwards 0.78s',
              border: '3px solid rgba(225,25,25,0.9)',
            }} />
            <div className="absolute rounded-full pointer-events-none" style={{
              width: 280, height: 280,
              animation: 'burst-2 0.9s ease-out forwards 0.88s',
              border: '2px solid rgba(225,25,25,0.6)',
            }} />
            <div className="absolute rounded-full pointer-events-none" style={{
              width: 280, height: 280,
              animation: 'burst-3 1.2s ease-out forwards 0.98s',
              border: '1px solid rgba(225,25,25,0.35)',
            }} />
          </>}

          {/* Idle pulse rings — start after burst, hidden until animation begins */}
          <div className="absolute rounded-full border border-blood-red/50 pointer-events-none" style={{
            width: 280, height: 280,
            opacity: 0,
            animation: 'ring-idle 2.8s ease-out infinite 2.0s',
          }} />
          <div className="absolute rounded-full border border-blood-red/28 pointer-events-none" style={{
            width: 280, height: 280,
            opacity: 0,
            animation: 'ring-idle2 2.8s ease-out infinite 3.0s',
          }} />

          {/* Badge image */}
          <img
            src="/logo-badge.png"
            alt="GOAT Martial Arts"
            className="badge-breathe relative z-10 hover:scale-[1.032] active:scale-[0.97] transition-transform duration-300 select-none"
            style={{
              width: 260, height: 260,
              borderRadius: '50%',
              opacity: go ? undefined : 0,
              animation: go ? 'badge-spin-in 0.85s cubic-bezier(0.22,0.61,0.36,1) forwards' : 'none',
            }}
          />
        </div>

        {/* Wordmark — clip-path write-on reveal */}
        <div style={{ marginTop: 14, overflow: 'hidden' }}>
          <img
            src="/logo-wordmark.png"
            alt="Goat"
            onClick={handleEnter}
            className="word-glow-cont cursor-pointer select-none"
            style={{
              height: '105px',
              width: 'auto',
              display: 'block',
              filter: 'invert(1) hue-rotate(180deg)',
              clipPath: go ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)',
              animation: go ? 'wordmark-write 0.7s cubic-bezier(0.22,0.61,0.36,1) forwards 0.9s' : 'none',
              opacity: go ? undefined : 0,
            }}
          />
        </div>

        {/* Flanking lines + label */}
        <div className="flex items-center gap-0 mt-2" style={{ width: 320 }}>
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(to left, rgba(225,25,25,0.45), transparent)',
            animation: go ? 'line-left 0.5s ease forwards 1.55s' : 'none',
            transform: 'scaleX(0)', transformOrigin: 'right center',
            opacity: go ? undefined : 0,
          }} />
          <span style={{
            color: 'rgba(155,163,167,0.36)',
            fontSize: '0.56rem',
            letterSpacing: '0.5em',
            textTransform: 'uppercase',
            padding: '0 14px',
            whiteSpace: 'nowrap',
            animation: go ? 'fade-up-soft 0.45s ease forwards 1.6s' : 'none',
            opacity: 0,
          }}>
            Martial Arts
          </span>
          <div style={{
            flex: 1, height: 1,
            background: 'linear-gradient(to right, rgba(225,25,25,0.45), transparent)',
            animation: go ? 'line-right 0.5s ease forwards 1.55s' : 'none',
            transform: 'scaleX(0)', transformOrigin: 'left center',
            opacity: go ? undefined : 0,
          }} />
        </div>

        {/* Vertical drop line */}
        <div style={{
          width: 1,
          height: 40,
          background: 'linear-gradient(to bottom, rgba(225,25,25,0.5), transparent)',
          marginTop: 36,
          animation: go ? 'vert-line 0.4s ease forwards 1.85s' : 'none',
          transform: 'scaleY(0)',
          opacity: 0,
        }} />

        {/* TAP TO ENTER — letter by letter */}
        <div
          className="flex items-center gap-[3px] mt-2 cursor-pointer"
          onClick={handleEnter}
          style={{ animation: go ? 'tap-pulse 2.6s ease-in-out infinite 2.8s' : 'none' }}
        >
          {TAP_LETTERS.map((ch, i) => (
            <span
              key={i}
              className="font-display text-blood-red/55 hover:text-blood-red transition-colors duration-300"
              style={{
                fontSize: ch === ' ' ? '0' : '0.62rem',
                letterSpacing: ch === ' ' ? '0' : '0.18em',
                width: ch === ' ' ? '10px' : undefined,
                display: 'inline-block',
                animation: go ? `letter-drop 0.3s ease forwards ${1.95 + i * 0.045}s` : 'none',
                opacity: 0,
              }}
            >
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
          {/* Blinking cursor */}
          <span className="font-display text-blood-red/40 ml-1" style={{
            fontSize: '0.62rem',
            animation: go ? 'cursor-blink 1s step-end infinite 2.8s' : 'none',
            opacity: 0,
          }}>_</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/* PHASE 2 — FORM                                */}
      {/* ══════════════════════════════════════════════ */}
      <div className="relative z-10 flex flex-col items-center w-full px-4" style={{
        maxWidth: 440,
        opacity: phase === 'form' ? 1 : 0,
        pointerEvents: phase === 'form' ? 'auto' : 'none',
        transition: 'opacity 0.5s ease 0.2s',
      }}>
        {/* Badge */}
        <div className="relative flex items-center justify-center mb-0">
          <div className="absolute rounded-full border border-blood-red/50" style={{
            width: 160, height: 160,
            opacity: 0,
            animation: phase==='form' ? 'ring-idle 2.8s ease-out infinite' : 'none',
          }} />
          <div className="absolute rounded-full border border-blood-red/28" style={{
            width: 160, height: 160,
            opacity: 0,
            animation: phase==='form' ? 'ring-idle2 2.8s ease-out infinite 1.4s' : 'none',
          }} />
          <img src="/logo-badge.png" alt="GOAT" className="badge-breathe-sm relative z-10"
            style={{ width: 136, height: 136, borderRadius: '50%' }} />
        </div>

        {/* Wordmark */}
        <img src="/logo-wordmark.png" alt="Goat" className="word-glow-sm select-none"
          style={{ height:'64px', width:'auto', marginTop:'6px', filter:'invert(1) hue-rotate(180deg)' }} />

        {/* Subtitle */}
        <div className="flex items-center gap-3 mt-3 mb-4" style={{ width: 280 }}>
          <div className="flex-1 h-px" style={{ background:'linear-gradient(to right,transparent,rgba(225,25,25,0.38))' }} />
          <span style={{ color:'rgba(155,163,167,0.34)', fontSize:'0.56rem', letterSpacing:'0.46em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Martial Arts
          </span>
          <div className="flex-1 h-px" style={{ background:'linear-gradient(to left,transparent,rgba(225,25,25,0.38))' }} />
        </div>

        {/* Form */}
        <div className="w-full" style={{ animation: phase==='form' ? 'form-rise 0.65s ease 0.22s both' : 'none' }}>
          <div className="mb-4">
            <p style={{ color:'rgba(225,25,25,0.58)', fontSize:'0.57rem', letterSpacing:'0.42em', textTransform:'uppercase', marginBottom:8 }}>
              Member Portal
            </p>
            <h2 className="text-off-white font-display" style={{ fontSize:'2.2rem', letterSpacing:'0.12em', lineHeight:1 }}>
              Sign In
            </h2>
            <div className="mt-2 h-[2px] w-12 bg-blood-red origin-left"
              style={{ animation: phase==='form' ? 'line-expand 0.5s ease 0.6s both' : 'none' }} />
          </div>

          <div className="relative overflow-hidden" style={{
            background:'linear-gradient(145deg,#0d0d0d 0%,#070707 100%)',
            border:'1px solid rgba(255,255,255,0.05)',
            clipPath:'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))',
          }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background:'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 55%,transparent)' }} />
            <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background:'linear-gradient(to bottom,#E11919,rgba(225,25,25,0.08) 45%,transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background:'linear-gradient(to left,rgba(225,25,25,0.14),transparent 55%)' }} />
            <div className="absolute top-0 right-0 bottom-0 w-px" style={{ background:'linear-gradient(to top,rgba(225,25,25,0.14),transparent 55%)' }} />

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label style={{ display:'block', color:'rgba(155,163,167,0.5)', fontSize:'0.57rem', letterSpacing:'0.3em', textTransform:'uppercase' }}>
                  Email Address
                </label>
                <input {...register('email')} type="email" autoComplete="email" placeholder="coach@goat.com"
                  className="w-full text-off-white text-sm px-4 py-2.5 outline-none placeholder:text-white/10 transition-all duration-300"
                  style={{ background:'rgba(255,255,255,0.025)', borderBottom:'1px solid rgba(255,255,255,0.08)', borderTop:'none', borderLeft:'none', borderRight:'none' }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor='#E11919'; e.currentTarget.style.background='rgba(225,25,25,0.04)' }}
                  onBlur={e => { e.currentTarget.style.borderBottomColor='rgba(255,255,255,0.08)'; e.currentTarget.style.background='rgba(255,255,255,0.025)' }}
                />
                {errors.email && <p className="text-blood-red text-xs">{errors.email.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label style={{ display:'block', color:'rgba(155,163,167,0.5)', fontSize:'0.57rem', letterSpacing:'0.3em', textTransform:'uppercase' }}>
                  Password
                </label>
                <input {...register('password')} type="password" autoComplete="current-password" placeholder="••••••••"
                  className="w-full text-off-white text-sm px-4 py-2.5 outline-none placeholder:text-white/10 transition-all duration-300"
                  style={{ background:'rgba(255,255,255,0.025)', borderBottom:'1px solid rgba(255,255,255,0.08)', borderTop:'none', borderLeft:'none', borderRight:'none' }}
                  onFocus={e => { e.currentTarget.style.borderBottomColor='#E11919'; e.currentTarget.style.background='rgba(225,25,25,0.04)' }}
                  onBlur={e => { e.currentTarget.style.borderBottomColor='rgba(255,255,255,0.08)'; e.currentTarget.style.background='rgba(255,255,255,0.025)' }}
                />
                {errors.password && <p className="text-blood-red text-xs">{errors.password.message}</p>}
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowForgotHelp(v => !v)}
                    className="cursor-pointer transition-colors duration-200 hover:text-blood-red"
                    style={{ color: 'rgba(155,163,167,0.5)', fontSize: '0.62rem', letterSpacing: '0.08em' }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              {serverError && (
                <div className="flex items-center gap-3 px-4 py-2.5" style={{ border:'1px solid rgba(225,25,25,0.3)', background:'rgba(225,25,25,0.06)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-blood-red flex-shrink-0" />
                  <p className="text-blood-red text-sm">{serverError}</p>
                </div>
              )}

              <div className="pt-1">
                <button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}
                  className="relative w-full py-3.5 text-white font-display text-sm tracking-[0.22em] uppercase disabled:opacity-50 transition-all duration-300 active:scale-[0.98] overflow-hidden group cursor-pointer"
                  style={{ background:'linear-gradient(135deg,#E11919 0%,#B90F16 100%)', clipPath:'polygon(0 0,calc(100% - 12px) 0,100% 12px,100% 100%,0 100%)' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow='0 0 40px rgba(225,25,25,0.55),0 8px 32px rgba(0,0,0,0.6)'; e.currentTarget.style.background='linear-gradient(135deg,#F02020 0%,#CA1218 100%)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow='none'; e.currentTarget.style.background='linear-gradient(135deg,#E11919 0%,#B90F16 100%)' }}
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{ background:'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.13) 50%,transparent 70%)' }} />
                  <span className="relative">{isSubmitting ? 'Signing in…' : 'Enter the System'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-35"
                  style={{ animation:'ping 2.2s cubic-bezier(0,0,0.2,1) infinite' }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span style={{ color:'rgba(52,211,153,0.4)', fontSize:'0.57rem', letterSpacing:'0.3em', textTransform:'uppercase' }}>System Online</span>
            </div>
            <p style={{ color:'rgba(255,255,255,0.08)', fontSize:'0.57rem', letterSpacing:'0.28em', textTransform:'uppercase' }}>
              GOAT © {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>

      {/* Forgot-password — radial spotlight, no card */}
      {showForgotHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', animation: 'fade-up-soft 0.25s ease both' }}
          onClick={() => setShowForgotHelp(false)}
        >
          <div
            className="relative flex flex-col items-center text-center"
            style={{ maxWidth: 300, animation: 'form-rise 0.4s cubic-bezier(0.22,0.61,0.36,1) both' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Spotlight glow */}
            <div className="absolute pointer-events-none" style={{
              top: -60, left: '50%', transform: 'translateX(-50%)',
              width: 260, height: 260, borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(225,25,25,0.22) 0%, rgba(225,25,25,0.07) 45%, transparent 72%)',
            }} />

            {/* Glowing lock icon with idle pulse rings */}
            <div className="relative flex items-center justify-center mb-5" style={{ width: 60, height: 60 }}>
              <div className="absolute rounded-full border border-blood-red/50" style={{ width: 60, height: 60, opacity: 0, animation: 'ring-idle 2.4s ease-out infinite' }} />
              <div className="absolute rounded-full border border-blood-red/28" style={{ width: 60, height: 60, opacity: 0, animation: 'ring-idle2 2.4s ease-out infinite 1.2s' }} />
              <div className="relative rounded-full flex items-center justify-center" style={{
                width: 56, height: 56,
                boxShadow: '0 0 0 1px rgba(225,25,25,0.45), 0 0 28px 6px rgba(225,25,25,0.28)',
              }}>
                <Lock size={20} className="text-blood-red" />
              </div>
            </div>

            <p style={{ color: 'rgba(225,25,25,0.75)', fontSize: '0.56rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 10 }}>
              Access Locked
            </p>
            <p className="text-off-white" style={{ fontSize: '1rem', lineHeight: 1.55, marginBottom: 20 }}>
              Your admin holds the keys — reach out and they'll get you back in.
            </p>
            <button
              type="button"
              onClick={() => setShowForgotHelp(false)}
              className="cursor-pointer transition-colors duration-200 hover:text-blood-red"
              style={{ color: 'rgba(155,163,167,0.55)', fontSize: '0.62rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
