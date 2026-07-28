import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { studentsService } from '../../services/students.service'
import { authService } from '../../services/auth.service'
import { Badge } from '../../components/ui/Badge'
import { ThemeToggle } from '../../components/ui/ThemeToggle'
import { Shield, User, Lock, Palette } from 'lucide-react'

const pwSchema = z.object({
  old_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 characters'),
  confirm: z.string(),
}).refine(d => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

type PwForm = z.infer<typeof pwSchema>

function SectionCard({ icon: Icon, title, children }: {
  icon: typeof Shield; title: string; children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgb(var(--c-bg-elevated)) 0%, rgb(var(--c-bg-input)) 100%)',
        border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))',
        clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%)',
      }}>
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.2) 50%, transparent)' }} />
      <div className="absolute top-0 left-0 bottom-0 w-px"
        style={{ background: 'linear-gradient(to bottom, #E11919, transparent 60%)' }} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-[3px] h-4 bg-blood-red" />
          <Icon size={12} className="text-blood-red/50" />
          <h3 className="font-display text-off-white text-xs uppercase tracking-[0.22em]">{title}</h3>
        </div>
        {children}
      </div>
    </div>
  )
}

export function StudentProfilePage() {
  const { user } = useAuth()

  const { data: myStudent } = useQuery({
    queryKey: ['my-student-profile'],
    queryFn: studentsService.getMe,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
  })

  const changePwMutation = useMutation({
    mutationFn: ({ old_password, new_password }: { old_password: string; new_password: string }) =>
      authService.changePassword({ current_password: old_password, new_password, new_password_confirm: new_password }),
    onSuccess: () => reset(),
  })

  const initial = user?.fullName?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="space-y-8 max-w-xl">

      {/* Header */}
      <div>
        <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
          Student Portal
        </p>
        <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.08em', lineHeight: 1 }}>
          My <span className="text-blood-red">Profile</span>
        </h1>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-[2px] w-10 bg-blood-red" />
          <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
            Account details &amp; settings
          </span>
        </div>
      </div>

      {/* Identity card */}
      <div className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(105deg, rgb(var(--c-accent-wash)) 0%, rgb(var(--c-bg-elevated)) 60%, rgba(225,25,25,0.04) 100%)',
          border: '1px solid rgba(225,25,25,0.15)',
          clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
        }}>
        <div className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ background: 'linear-gradient(to bottom, #E11919, rgba(225,25,25,0.2))' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(to right, #E11919, rgba(225,25,25,0.3) 50%, transparent)' }} />

        <div className="pl-6 pr-6 py-6 flex items-center gap-5">
          <div className="shrink-0 w-16 h-16 flex items-center justify-center font-display text-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(225,25,25,0.15), rgba(225,25,25,0.08))',
              border: '1px solid rgba(225,25,25,0.3)',
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
              color: '#E11919',
            }}>
            {initial}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-display text-off-white text-xl truncate">{user?.fullName}</p>
            <p className="text-steel-gray/50 text-sm mt-0.5">{user?.email}</p>
            {myStudent && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="font-display text-blood-red text-sm">{myStudent.student_id}</span>
                <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.3 * var(--c-sec-mult)))' }}>·</span>
                <Badge variant={myStudent.sport}>{myStudent.sport}</Badge>
                <Badge variant={myStudent.level}>{myStudent.level}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      {myStudent && (
        <SectionCard icon={User} title="Account Details">
          <div className="space-y-1">
            {[
              { label: 'Branch', value: myStudent.branch?.name ?? '—' },
              { label: 'Joined', value: myStudent.join_date
                  ? new Date(myStudent.join_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—' },
              { label: 'Status', value: myStudent.is_active ? 'Active' : 'Inactive' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2.5"
                style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}>
                <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.6rem', letterSpacing: '0.24em', textTransform: 'uppercase' }}>{label}</span>
                <span className="text-off-white text-sm">{value}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard icon={Palette} title="Appearance">
        <p style={{ color: 'rgb(var(--c-text-secondary) / calc(0.45 * var(--c-sec-mult)))', fontSize: '0.68rem', marginBottom: 14 }}>
          Choose how the GOAT system looks on this device.
        </p>
        <ThemeToggle />
      </SectionCard>

      <SectionCard icon={Lock} title="Change Password">
        <form
          onSubmit={handleSubmit(d => changePwMutation.mutate({ old_password: d.old_password, new_password: d.new_password }))}
          className="space-y-4"
        >
          {[
            { name: 'old_password' as const, label: 'Current Password' },
            { name: 'new_password' as const, label: 'New Password' },
            { name: 'confirm'      as const, label: 'Confirm New Password' },
          ].map(({ name, label }) => (
            <div key={name}>
              <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: 6 }}>
                {label}
              </label>
              <input
                type="password"
                {...register(name)}
                style={{
                  width: '100%', background: 'rgb(var(--c-bg-input))',
                  border: errors[name] ? '1px solid rgba(225,25,25,0.4)' : '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
                  color: 'rgb(var(--c-text-primary))', padding: '10px 14px', fontSize: 14,
                  outline: 'none', transition: 'border-color 0.2s ease',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(225,25,25,0.4)' }}
                onBlur={e => { e.target.style.borderColor = errors[name] ? 'rgba(225,25,25,0.4)' : 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }}
              />
              {errors[name] && (
                <p style={{ color: '#E11919', fontSize: '0.7rem', marginTop: 4 }}>{errors[name]?.message}</p>
              )}
            </div>
          ))}

          {changePwMutation.isError && (
            <p style={{ color: '#E11919', fontSize: '0.75rem' }}>Incorrect current password.</p>
          )}
          {changePwMutation.isSuccess && (
            <p style={{ color: '#34d399', fontSize: '0.75rem' }}>Password updated successfully.</p>
          )}

          <button
            type="submit"
            disabled={changePwMutation.isPending}
            style={{
              width: '100%', padding: '11px 0',
              background: 'linear-gradient(135deg, #E11919, #B90F16)',
              color: '#fff', fontFamily: 'inherit',
              fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase',
              border: 'none', cursor: changePwMutation.isPending ? 'wait' : 'pointer',
              opacity: changePwMutation.isPending ? 0.6 : 1,
              clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)',
              transition: 'opacity 0.2s ease',
            }}>
            {changePwMutation.isPending ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </SectionCard>
    </div>
  )
}
