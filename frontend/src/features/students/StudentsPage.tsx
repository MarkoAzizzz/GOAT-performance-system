import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { studentsService } from '../../services/students.service'
import { Badge } from '../../components/ui/Badge'
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton'
import { useToast } from '../../components/ui/Toast'
import type { Sport, Level } from '../../types'
import { Search, Plus, X, Users } from 'lucide-react'

const createSchema = z.object({
  email:     z.string().email('Invalid email'),
  full_name: z.string().min(2, 'Name required'),
  password:  z.string().min(8, 'Min 8 characters'),
  sport:     z.enum(['boxing', 'kickboxing'] as const),
  branch:    z.string().uuid('Select branch'),
  join_date: z.string().min(1, 'Join date required'),
})
type CreateForm = z.infer<typeof createSchema>

const inputStyle = {
  width: '100%', background: 'rgb(var(--c-bg-input))',
  border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
  color: 'rgb(var(--c-text-primary))', padding: '10px 14px', fontSize: 13,
  outline: 'none',
} as const

const filterStyle = {
  background: 'rgb(var(--c-bg-surface))',
  border: '1px solid rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
  color: 'rgb(var(--c-text-secondary))', padding: '8px 14px', fontSize: '0.65rem',
  letterSpacing: '0.18em', textTransform: 'uppercase' as const,
  outline: 'none', cursor: 'pointer',
}

export function StudentsPage() {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch]     = useState('')
  const [sport,  setSport]      = useState<Sport | ''>('')
  const [level,  setLevel]      = useState<Level | ''>('')
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['students', search, sport, level],
    queryFn:  () => studentsService.list({ search: search || undefined, sport: (sport as Sport) || undefined, level: (level as Level) || undefined }),
  })
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: studentsService.getBranches })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const createMutation = useMutation({
    mutationFn: studentsService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['students'] })
      setShowModal(false)
      reset()
      toast('Student created successfully')
    },
    onError: () => toast('Failed to create student', 'error'),
  })

  const students = data?.results ?? data ?? []

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.58rem', letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 6 }}>
            Management
          </p>
          <h1 className="font-display text-off-white" style={{ fontSize: '2.4rem', letterSpacing: '0.1em', lineHeight: 1 }}>
            Students
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-[2px] w-10 bg-blood-red" />
            <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.38 * var(--c-sec-mult)))', fontSize: '0.58rem', letterSpacing: '0.28em', textTransform: 'uppercase' }}>
              {Array.isArray(students) ? students.length : 0} registered
            </span>
          </div>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 text-white font-display text-xs tracking-[0.22em] uppercase px-5 py-3 transition-all duration-200 active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #E11919, #B90F16)', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 30px rgba(225,25,25,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}>
          <Plus size={13} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-steel-gray/40" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or ID..."
            style={{ ...filterStyle, paddingLeft: 36, width: '100%' }}
            onFocus={e => { e.target.style.borderColor = 'rgba(225,25,25,0.4)' }}
            onBlur={e =>  { e.target.style.borderColor = 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }}
          />
        </div>
        {(['', 'boxing', 'kickboxing'] as const).map(v => (
          <button key={v} onClick={() => setSport(v as Sport | '')}
            style={{
              ...filterStyle,
              color: sport === v ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))',
              borderColor: sport === v ? 'rgba(225,25,25,0.4)' : 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
              background: sport === v ? 'rgba(225,25,25,0.08)' : 'rgb(var(--c-bg-surface))',
            }}>
            {v || 'All Sports'}
          </button>
        ))}
        {(['', 'beginner', 'intermediate', 'advanced'] as const).map(v => (
          <button key={v} onClick={() => setLevel(v as Level | '')}
            style={{
              ...filterStyle,
              color: level === v ? 'rgb(var(--c-text-primary))' : 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))',
              borderColor: level === v ? 'rgba(225,25,25,0.4)' : 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))',
              background: level === v ? 'rgba(225,25,25,0.08)' : 'rgb(var(--c-bg-surface))',
            }}>
            {v || 'All Levels'}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : !Array.isArray(students) || students.length === 0 ? (
        <div className="relative overflow-hidden text-center py-20"
          style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
          <Users size={28} style={{ color: 'rgb(var(--c-text-secondary) / calc(0.2 * var(--c-sec-mult)))', margin: '0 auto 12px' }} />
          <p className="font-display text-off-white text-base mb-1">No students found</p>
          <p className="text-steel-gray/40 text-sm mb-6">Add your first student to get started</p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 text-white text-xs tracking-[0.22em] uppercase px-5 py-2.5"
            style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 6px) 0,100% 6px,100% 100%,0 100%)' }}>
            <Plus size={12} /> Add Student
          </button>
        </div>
      ) : (
        <div className="relative overflow-hidden"
          style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))', clipPath: 'polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,0 100%)' }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.2) 50%,transparent)' }} />
          <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 60%)' }} />
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.05 * var(--c-ovl-mult)))' }}>
                  {['ID', 'Name', 'Sport', 'Level', 'Branch', 'Status'].map(h => (
                    <th key={h} className="text-left"
                      style={{ padding: '14px 20px', color: 'rgb(var(--c-text-secondary) / calc(0.4 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(students as any[]).map((s: any) => (
                  <tr key={s.id}
                    onClick={() => navigate(`/admin/students/${s.id}`)}
                    className="cursor-pointer transition-all duration-150 group"
                    style={{ borderBottom: '1px solid rgb(var(--c-overlay) / calc(0.04 * var(--c-ovl-mult)))' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(225,25,25,0.04)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="font-display text-blood-red text-sm">{s.student_id}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span className="text-off-white text-sm">{s.user?.full_name ?? s.full_name}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge variant={s.sport}>{s.sport}</Badge>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge variant={s.level}>{s.level}</Badge>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.75rem' }}>{s.branch?.name ?? '—'}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <Badge variant={s.is_active ? 'success' : 'error'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative overflow-hidden w-full max-w-md"
            style={{ background: 'linear-gradient(145deg,rgb(var(--c-bg-elevated)),rgb(var(--c-bg-input)))', border: '1px solid rgba(225,25,25,0.2)', clipPath: 'polygon(0 0,calc(100% - 20px) 0,100% 20px,100% 100%,20px 100%,0 calc(100% - 20px))' }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(to right,#E11919,rgba(225,25,25,0.3) 50%,transparent)' }} />
            <div className="absolute top-0 left-0 bottom-0 w-px" style={{ background: 'linear-gradient(to bottom,#E11919,transparent 60%)' }} />

            <div className="p-7">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p style={{ color: 'rgba(225,25,25,var(--c-eyebrow-a))', fontSize: '0.52rem', letterSpacing: '0.36em', textTransform: 'uppercase', marginBottom: 4 }}>Management</p>
                  <h3 className="font-display text-off-white text-xl">New Student</h3>
                </div>
                <button onClick={() => { setShowModal(false); reset() }} className="text-steel-gray/40 hover:text-steel-gray transition-colors">
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit(d => createMutation.mutate(d))} className="space-y-4">
                {[
                  { name: 'full_name' as const, label: 'Full Name',  type: 'text' },
                  { name: 'email'     as const, label: 'Email',       type: 'email' },
                  { name: 'password'  as const, label: 'Password',    type: 'password' },
                ].map(({ name, label, type }) => (
                  <div key={name}>
                    <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</label>
                    <input type={type} {...register(name)} style={inputStyle}
                      onFocus={e => { e.target.style.borderColor = 'rgba(225,25,25,0.4)' }}
                      onBlur={e =>  { e.target.style.borderColor = 'rgb(var(--c-overlay) / calc(0.07 * var(--c-ovl-mult)))' }} />
                    {errors[name] && <p style={{ color: '#E11919', fontSize: '0.65rem', marginTop: 4 }}>{errors[name]?.message}</p>}
                  </div>
                ))}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Sport</label>
                    <select {...register('sport')} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="boxing">Boxing</option>
                      <option value="kickboxing">Kickboxing</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Branch</label>
                    <select {...register('branch')} style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="">Select...</option>
                      {(branches as any[])?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    {errors.branch && <p style={{ color: '#E11919', fontSize: '0.65rem', marginTop: 4 }}>{errors.branch.message}</p>}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: 'rgb(var(--c-text-secondary) / calc(0.5 * var(--c-sec-mult)))', fontSize: '0.52rem', letterSpacing: '0.26em', textTransform: 'uppercase', marginBottom: 6 }}>Join Date</label>
                  <input type="date" {...register('join_date')} defaultValue={new Date().toISOString().split('T')[0]} style={inputStyle} />
                  {errors.join_date && <p style={{ color: '#E11919', fontSize: '0.65rem', marginTop: 4 }}>{errors.join_date.message}</p>}
                </div>

                {createMutation.isError && (
                  <p style={{ color: '#E11919', fontSize: '0.72rem' }}>Failed to create student. Check details.</p>
                )}

                <button type="submit" disabled={createMutation.isPending}
                  className="w-full py-3 text-white font-display text-xs tracking-[0.26em] uppercase mt-2 transition-opacity"
                  style={{ background: 'linear-gradient(135deg,#E11919,#B90F16)', clipPath: 'polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%)', opacity: createMutation.isPending ? 0.6 : 1 }}>
                  {createMutation.isPending ? 'Creating...' : 'Create Student'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
