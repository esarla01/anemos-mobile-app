import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { useSession } from '../context/AuthContext'

export interface HealthLog {
  id: string
  user_id: string
  logged_at: string
  wellbeing: number
  symptoms: string[]
  symptoms_notes: string | null
  notes: string | null
  pm2_5_snapshot: number | null
  activity: string | null
}

export interface UseHealthLogsResult {
  logs: HealthLog[]
  loading: boolean
  error: string | null
  submitting: boolean
  submit: (entry: {
    wellbeing: number
    symptoms: string[]
    symptomsNotes: string
    notes: string
    activity: string
    pm2_5Snapshot: number | null
  }) => Promise<void>
}

export function useHealthLogs(): UseHealthLogsResult {
  const { session } = useSession()
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('health_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('logged_at', { ascending: false })
      .limit(20)
    if (error) setError(error.message)
    else setLogs((data ?? []) as HealthLog[])
  }, [session])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setError(null)
    fetchLogs().finally(() => setLoading(false))
  }, [session, fetchLogs])

  const submit = useCallback(
    async (entry: {
      wellbeing: number
      symptoms: string[]
      symptomsNotes: string
      notes: string
      activity: string
      pm2_5Snapshot: number | null
    }) => {
      if (!session) return
      setSubmitting(true)
      setError(null)
      const { data, error } = await supabase
        .from('health_logs')
        .insert({
          user_id: session.user.id,
          wellbeing: entry.wellbeing,
          symptoms: entry.symptoms,
          symptoms_notes: entry.symptomsNotes.trim() || null,
          notes: entry.notes.trim() || null,
          activity: entry.activity.trim() || null,
          pm2_5_snapshot: entry.pm2_5Snapshot,
        })
        .select()
        .single()
      setSubmitting(false)
      if (error) {
        setError(error.message)
      } else {
        setLogs((prev) => [data as HealthLog, ...prev])
      }
    },
    [session]
  )

  return { logs, loading, error, submitting, submit }
}
