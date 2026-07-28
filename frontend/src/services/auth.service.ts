import api from './api'
import type { ApiResponse, User } from '../types'

interface LoginPayload { email: string; password: string }
interface LoginData { access: string; refresh: string; user: User }
interface ChangePasswordPayload {
  current_password: string
  new_password: string
  new_password_confirm: string
}

// The API returns snake_case fields; map them onto the frontend's camelCase User shape.
function mapUser(raw: any): User {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.full_name,
    role: raw.role,
    isActive: raw.is_active,
    lastLogin: raw.last_login,
    createdAt: raw.created_at,
  }
}

export const authService = {
  async login(payload: LoginPayload): Promise<LoginData> {
    const { data } = await api.post<ApiResponse<any>>('/auth/login/', payload)
    return { access: data.data.access, refresh: data.data.refresh, user: mapUser(data.data.user) }
  },

  async logout(refreshToken: string): Promise<void> {
    await api.post('/auth/logout/', { refresh: refreshToken })
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<ApiResponse<any>>('/auth/me/')
    return mapUser(data.data)
  },

  async updateMe(payload: Partial<Pick<User, 'fullName'>>): Promise<User> {
    const { data } = await api.patch<ApiResponse<any>>('/auth/me/', {
      full_name: payload.fullName,
    })
    return mapUser(data.data)
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await api.post('/auth/change-password/', payload)
  },

  async refreshToken(refresh: string): Promise<string> {
    const { data } = await api.post<{ access: string }>('/auth/token/refresh/', { refresh })
    return data.access
  },
}
