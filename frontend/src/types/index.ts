export type Role = 'admin' | 'student'
export type Sport = 'boxing' | 'kickboxing'
export type Level = 'beginner' | 'intermediate' | 'advanced'
export type MartialArt = 'boxing' | 'kickboxing'

export interface User {
  id: string
  email: string
  fullName: string
  role: Role
  isActive?: boolean
  lastLogin?: string | null
  createdAt?: string
}

export interface Student {
  id: string
  studentId: string
  fullName: string
  email: string
  sport: Sport
  level: Level
  branch: string
  joinDate: string
  isActive: boolean
  userId: string
}

export interface CriterionScore {
  id: string
  criterionName: string
  pillarName: string
  boxingScore: number | null
  kickboxingScore: number | null
  sectionAverage: number | null
  coachComment: string
}

export interface Assessment {
  id: string
  studentId: string
  studentName: string
  assessmentDate: string
  martialArt: MartialArt
  sessionsCompleted: number
  criterionScores: CriterionScore[]
  pillarScores: Record<string, number>
  overallScore: number
  gradePercentage: number
  level: Level
  coachNotes: string
  actionPlan: string
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  studentId: string
  studentName: string
  sport: Sport
  level: Level
  currentScore: number
  previousScore: number | null
  improvement: number | null
}

export interface AnalyticsSummary {
  total_students: number
  active_students: number
  weekly_assessments: number
  average_score: number
  highest_score: number
  lowest_score: number
  biggest_improvement: {
    student_name: string | null
    student_id: string | null
    improvement: number | null
  }
  grade_distribution: {
    beginner?: number
    intermediate?: number
    advanced?: number
  }
  weekly_trend: {
    week: string
    average_score: number
    assessment_count: number
  }[]
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface SyncLog {
  id: string
  syncedAt: string
  status: 'success' | 'partial' | 'failed'
  recordsSynced: number
  errors: string[]
}
