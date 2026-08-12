import api from './api'

export const assessmentEntryService = {
  async getTemplate(): Promise<any> {
    const { data } = await api.get('/assessments/template/')
    return data.data
  },

  async getCoachEntries(studentId: string, date: string): Promise<any[]> {
    const { data } = await api.get('/assessments/coach-entries/', {
      params: { student: studentId, date },
    })
    return data.data
  },

  async submitEntry(payload: {
    student: string
    assessment_date: string
    sessions_completed: number
    notes: string
    action_plan: string
    scores: { criterion_id: string; delta: number; comment: string }[]
  }): Promise<any> {
    const { data } = await api.post('/assessments/coach-entries/', payload)
    return data.data
  },
}
