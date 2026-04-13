export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
export type ExposureSource = 'synthetic' | 'ble'

export interface UserProfile {
  user_id: string
  age: number | null
  weight: number | null
  gender: Gender | null
  allergies: string | null
  health_conditions: string[]
  preferences: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ExposureReading {
  id: string
  user_id: string
  timestamp: string
  pm1_0: number | null
  pm2_5: number | null
  pm10: number | null
  source: ExposureSource
  created_at: string
}

export type AeroRole = 'user' | 'assistant'

export interface AeroConversation {
  id: string
  user_id: string
  role: AeroRole
  content: string
  created_at: string
}
