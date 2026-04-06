import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'
import { useSession } from '../context/AuthContext'
import type { ExposureReading } from '../types/database'

export interface DailyAverage {
  date: string      // 'YYYY-MM-DD'
  avg_pm1_0: number
  avg_pm25: number
  avg_pm10: number
}

export interface UseExposureResult {
  current: ExposureReading | null
  history: DailyAverage[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useExposure(): UseExposureResult {
  const { session } = useSession()
  const [current, setCurrent] = useState<ExposureReading | null>(null)
  const [history, setHistory] = useState<DailyAverage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCurrent = useCallback(async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('exposure_readings')
      .select('*')
      .eq('user_id', session.user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()
    if (error) setError(error.message)
    else setCurrent(data as ExposureReading)
  }, [session])

  const fetchHistory = useCallback(async () => {
    if (!session) return
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data, error } = await supabase
      .from('exposure_readings')
      .select('timestamp, pm1_0, pm2_5, pm10')
      .eq('user_id', session.user.id)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: true })

    if (error) {
      setError(error.message)
      return
    }

    const buckets: Record<string, { s1: number; s25: number; s10: number; count: number }> = {}
    for (const row of (data ?? [])) {
      const date = row.timestamp.slice(0, 10)
      if (!buckets[date]) buckets[date] = { s1: 0, s25: 0, s10: 0, count: 0 }
      buckets[date].s1 += row.pm1_0 ?? 0
      buckets[date].s25 += row.pm2_5 ?? 0
      buckets[date].s10 += row.pm10 ?? 0
      buckets[date].count += 1
    }

    const round = (v: number) => Math.round(v * 10) / 10
    const aggregated = Object.entries(buckets)
      .map(([date, { s1, s25, s10, count }]) => ({
        date,
        avg_pm1_0: count > 0 ? round(s1 / count) : 0,
        avg_pm25: count > 0 ? round(s25 / count) : 0,
        avg_pm10: count > 0 ? round(s10 / count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    setHistory(aggregated)
  }, [session])

  const refetch = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchCurrent(), fetchHistory()]).finally(() => setLoading(false))
  }, [fetchCurrent, fetchHistory])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setError(null)
    Promise.all([fetchCurrent(), fetchHistory()]).finally(() => setLoading(false))
    const interval = setInterval(fetchCurrent, 60_000)
    return () => clearInterval(interval)
  }, [session, fetchCurrent, fetchHistory])

  return { current, history, loading, error, refetch }
}
