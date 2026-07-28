import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { authService } from '../../services/auth.service'
import { studentsService } from '../../services/students.service'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { User as UserIcon, Lock, Info, KeyRound, Search, X, Palette } from 'lucide-react'

const pwSchema = z.object({
  old_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type PwForm = z.infer<typeof pwSchema>

const resetPwSchema = z.object({
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type ResetPwForm = z.infer<typeof resetPwSchema>

const inputStyle = {
  width: '100%', background: 'rgb(var(--c-bg-input))',
  border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
  color: 'rgb(var(--c-text-primary))', padding: '10px 14px', fontSize: 13,
  outline: 'none',
} as const

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 60%)' }} />
      <div className="p-6">{children}</div>
    </div>
  )
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <Icon size={13} style={{ color: '#E11919' }} />
      <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">{title}</h3>
    </div>
  )
}

function initials(name?: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const chars = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (chars || name[0] || '?').toUpperCase()
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

function studentDisplayName(s: any): string {
  return s?.user?.full_name ?? s?.full_name ?? 'Unknown'
}

export function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  // ── Change own password ─────────────────────────────────────────────────
  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  })

  const changePwMutation = useMutation({
    mutationFn: ({ old_password, new_password }: { old_password: string; new_password: string }) =>
      authService.changePassword({ current_password: old_password, new_password, new_password_confirm: new_password }),
    onSuccess: () => { reset(); toast('Password updated successfully') },
    onError:   () => toast('Incorrect current password', 'error'),
  })

  // ── Branches (for System card) ──────────────────────────────────────────
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: studentsService.getBranches })

  // ── Reset a student's password ──────────────────────────────────────────
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null)
  const resetPwForm = useForm<ResetPwForm>({ resolver: zodResolver(resetPwSchema) })

  const { data: studentResults } = useQuery({
    queryKey: ['student-search', studentSearch],
    queryFn: () => studentsService.list({ search: studentSearch }),
    enabled: studentSearch.trim().length > 1 && !selectedStudent,
  })

  const resetStudentPwMutation = useMutation({
    mutationFn: (d: ResetPwForm) => studentsService.resetPassword(selectedStudent.id, d.new_password),
    onSuccess: () => {
      toast(`Password reset for ${studentDisplayName(selectedStudent)}`)
      resetPwForm.reset()
      setSelectedStudent(null)
      setStudentSearch('')
    },
    onError: () => toast('Could not reset password', 'error'),
  })

  return (
    <div className="space-y-8 max-w-xl">

      {/* Header */}
      <div>
        <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
          Management
        </p>
        <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
          Settings
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-[2px] w-10 bg-blood-red" />
          <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
            Account & system configuration
          </span>
        </div>
      </div>

      {/* Account info */}
      <Card>
        <SectionTitle icon={UserIcon} title="Account" />

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-lg shrink-0"
            style={{ background: 'rgba(225,25,25,0.12)', border: '1px solid rgba(225,25,25,0.3)', color: '#E11919' }}>
            {initials(user?.fullName)}
          </div>
          <div className="min-w-0">
            <p className="text-off-white text-sm font-medium truncate">{user?.fullName || '—'}</p>
            <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.7rem' }} className="truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {[
            { label: 'Full Name', value: user?.fullName, capitalize: true },
            { label: 'Email',     value: user?.email,    capitalize: false },
            { label: 'Role',      value: user?.role,     capitalize: true },
          ].map(({ label, value, capitalize }) => (
            <div key={label} className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
              <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>{label}</span>
              <span className={`text-off-white text-sm ${capitalize ? 'capitalize' : ''}`}>{value ?? '—'}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Appearance */}
      <Card>
        <SectionTitle icon={Palette} title="Appearance" />
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.68rem', marginBottom: 14 }}>
          Choose how the GOAT system looks on this device.
        </p>
        <ThemeToggle />
      </Card>

      {/* Change password */}
      <Card>
        <SectionTitle icon={Lock} title="Change Password" />
        <form onSubmit={handleSubmit(d => changePwMutation.mutate({ old_password: d.old_password, new_password: d.new_password }))}
          className="space-y-4">
          {[
            { name: 'old_password' as const, label: 'Current Password' },
            { name: 'new_password' as const, label: 'New Password' },
            { name: 'confirm'      as const, label: 'Confirm New Password' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
              <input type="password" {...register(name)} style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'rgba(225,25,25,0.4)' }}
                onBlur={e =>  { e.target.style.borderColor = 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }} />
              {errors[name] && <p style={{ color: '#E11919', fontSize: '0.65rem', marginTop: 4 }}>{errors[name]?.message}</p>}
            </div>
          ))}

          <button type="submit" disabled={changePwMutation.isPending}
            className="w-full py-3 text-white font-display text-xs tracking-[0.26em] uppercase mt-2 transition-opacity"
            style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)', opacity: changePwMutation.isPending ? 0.6 : 1 }}>
            {changePwMutation.isPending ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </Card>

      {/* Reset student password */}
      <Card>
        <SectionTitle icon={KeyRound} title="Reset Student Password" />
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.68rem', marginBottom: 14, lineHeight: 1.6 }}>
          Search for a student and set a new password on their behalf — useful if they've forgotten it.
        </p>

        <div className="relative mb-3">
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))' }} />
          <input
            value={studentSearch}
            onChange={e => { setStudentSearch(e.target.value); setSelectedStudent(null) }}
            placeholder="Search by name or student ID..."
            style={{ ...inputStyle, paddingLeft: 34 }}
          />
        </div>

        {studentSearch.trim().length > 1 && !selectedStudent && (
          <div className="mb-4" style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid rgb(var(--c-overlay) / calc(0.06 * var(--c-ovl-mult)))' }}>
            {(studentResults ?? []).length === 0 ? (
              <p style={{ padding: 12, color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.68rem' }}>No students found.</p>
            ) : (studentResults as any[]).map(s => (
              <div key={s.id}
                onClick={() => { setSelectedStudent(s); setStudentSearch(studentDisplayName(s)) }}
                className="px-3 py-2.5 cursor-pointer transition-colors"
                style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.06)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                <p className="text-off-white text-sm">{studentDisplayName(s)}</p>
                <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.6rem' }}>{s.student_id}</p>
              </div>
            ))}
          </div>
        )}

        {selectedStudent && (
          <form onSubmit={resetPwForm.handleSubmit(d => resetStudentPwMutation.mutate(d))} className="space-y-3">
            <div className="flex items-center justify-between px-3 py-2.5"
              style={{ background: 'rgba(225,25,25,0.06)', border: '1px solid rgba(225,25,25,0.2)' }}>
              <span className="text-off-white text-sm">
                {studentDisplayName(selectedStudent)} <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))' }}>· {selectedStudent.student_id}</span>
              </span>
              <button type="button" onClick={() => { setSelectedStudent(null); setStudentSearch('') }}
                style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={13} />
              </button>
            </div>
            <div>
              <input type="password" placeholder="New Password" {...resetPwForm.register('new_password')} style={inputStyle} />
              {resetPwForm.formState.errors.new_password && <p style={{ color: '#E11919', fontSize: '0.62rem', marginTop: 4 }}>{resetPwForm.formState.errors.new_password.message}</p>}
            </div>
            <div>
              <input type="password" placeholder="Confirm New Password" {...resetPwForm.register('confirm')} style={inputStyle} />
              {resetPwForm.formState.errors.confirm && <p style={{ color: '#E11919', fontSize: '0.62rem', marginTop: 4 }}>{resetPwForm.formState.errors.confirm.message}</p>}
            </div>
            <button type="submit" disabled={resetStudentPwMutation.isPending}
              className="w-full py-2.5 text-white font-display text-xs tracking-[0.2em] uppercase transition-opacity"
              style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)', opacity: resetStudentPwMutation.isPending ? 0.6 : 1 }}>
              {resetStudentPwMutation.isPending ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </Card>

      {/* System info */}
      <Card>
        <SectionTitle icon={Info} title="System" />
        <div className="space-y-0">
          {[
            { label: 'Version',     value: '1.0.0' },
            { label: 'Branch',      value: branches?.[0]?.name ?? '—' },
            { label: 'Sports',      value: 'Boxing · Kickboxing' },
            { label: 'Last Login',  value: formatDateTime(user?.lastLogin) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3"
              style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
              <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase' }}>{label}</span>
              <span className="text-off-white text-sm">{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
