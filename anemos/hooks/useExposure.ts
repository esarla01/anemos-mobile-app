import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'
import { useSession } from '../context/AuthContext'
import type { ExposureReading } from '../types/database'
import type { PMReading } from './useBLE'

export interface DailyAverage {
  date: string      // 'YYYY-MM-DD'
  avg_pm1_0: number
  avg_pm25: number
  avg_pm10: number
}

// A single time-bucketed data point for charting
export interface TimePoint {
  label: string       // Primary x-axis label (e.g. "6a", "Mon", "Apr 1")
  sublabel?: string   // Secondary label shown above (e.g. day name for 3-day view)
  isNewDay?: boolean  // True when this point starts a new day (3-day view)
  pm1_0: number
  pm2_5: number
  pm10: number
}

export interface UseExposureResult {
  current: ExposureReading | null
  todayHourly: TimePoint[]       // Up to 24 hourly points for today
  threeDaySixHour: TimePoint[]   // 12 six-hourly points over the last 3 days
  sevenDayDaily: DailyAverage[]  // 7 daily averages
  loading: boolean
  error: string | null
  refetch: () => void
}

const round1 = (v: number) => Math.round(v * 10) / 10

function hourLabel(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

function dayAbbr(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

export function useExposure(bleReading?: PMReading | null): UseExposureResult {
  const { session } = useSession()
  const [current, setCurrent] = useState<ExposureReading | null>(null)
  const lastBleWrite = useRef(0)
  const [todayHourly, setTodayHourly] = useState<TimePoint[]>([])
  const [threeDaySixHour, setThreeDaySixHour] = useState<TimePoint[]>([])
  const [sevenDayDaily, setSevenDayDaily] = useState<DailyAverage[]>([])
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

    const rows = (data ?? []) as { timestamp: string; pm1_0: number | null; pm2_5: number | null; pm10: number | null }[]
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    // ── 7-day daily averages ─────────────────────────────────────────────────
    const dayBuckets: Record<string, { s1: number; s25: number; s10: number; count: number }> = {}
    for (const row of rows) {
      const date = row.timestamp.slice(0, 10)
      if (!dayBuckets[date]) dayBuckets[date] = { s1: 0, s25: 0, s10: 0, count: 0 }
      dayBuckets[date].s1 += row.pm1_0 ?? 0
      dayBuckets[date].s25 += row.pm2_5 ?? 0
      dayBuckets[date].s10 += row.pm10 ?? 0
      dayBuckets[date].count += 1
    }
    const daily = Object.entries(dayBuckets)
      .map(([date, { s1, s25, s10, count }]) => ({
        date,
        avg_pm1_0: count > 0 ? round1(s1 / count) : 0,
        avg_pm25: count > 0 ? round1(s25 / count) : 0,
        avg_pm10: count > 0 ? round1(s10 / count) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
    setSevenDayDaily(daily)

    // ── Today: hourly buckets (hour 0–23) ────────────────────────────────────
    const hourBuckets: Record<number, { s1: number; s25: number; s10: number; count: number }> = {}
    for (const row of rows) {
      if (!row.timestamp.startsWith(todayStr)) continue
      const h = new Date(row.timestamp).getHours()
      if (!hourBuckets[h]) hourBuckets[h] = { s1: 0, s25: 0, s10: 0, count: 0 }
      hourBuckets[h].s1 += row.pm1_0 ?? 0
      hourBuckets[h].s25 += row.pm2_5 ?? 0
      hourBuckets[h].s10 += row.pm10 ?? 0
      hourBuckets[h].count += 1
    }
    const currentHour = now.getHours()
    // Fill all hours 0..currentHour, interpolating missing ones with 0
    const hourlyPoints: TimePoint[] = []
    for (let h = 0; h <= currentHour; h++) {
      const b = hourBuckets[h]
      hourlyPoints.push({
        label: hourLabel(h),
        pm1_0: b && b.count > 0 ? round1(b.s1 / b.count) : 0,
        pm2_5: b && b.count > 0 ? round1(b.s25 / b.count) : 0,
        pm10: b && b.count > 0 ? round1(b.s10 / b.count) : 0,
      })
    }
    setTodayHourly(hourlyPoints)

    // ── 3-day: 6-hour buckets ────────────────────────────────────────────────
    // 3 days * 4 buckets = 12 points. Buckets: 0-5, 6-11, 12-17, 18-23
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 2)
    threeDaysAgo.setHours(0, 0, 0, 0)

    type Bucket6Key = string  // "YYYY-MM-DD-{0|6|12|18}"
    const sixHourBuckets: Record<Bucket6Key, { s1: number; s25: number; s10: number; count: number; date: string; bucketHour: number }> = {}

    for (const row of rows) {
      const ts = new Date(row.timestamp)
      if (ts < threeDaysAgo) continue
      const date = row.timestamp.slice(0, 10)
      const h = ts.getHours()
      const bucketHour = h < 6 ? 0 : h < 12 ? 6 : h < 18 ? 12 : 18
      const key = `${date}-${bucketHour}`
      if (!sixHourBuckets[key]) sixHourBuckets[key] = { s1: 0, s25: 0, s10: 0, count: 0, date, bucketHour }
      sixHourBuckets[key].s1 += row.pm1_0 ?? 0
      sixHourBuckets[key].s25 += row.pm2_5 ?? 0
      sixHourBuckets[key].s10 += row.pm10 ?? 0
      sixHourBuckets[key].count += 1
    }

    // Build ordered 12-slot array for last 3 days
    const sixHourPoints: TimePoint[] = []
    for (let d = 2; d >= 0; d--) {
      const day = new Date()
      day.setDate(day.getDate() - d)
      const dateStr = day.toISOString().slice(0, 10)
      const dayName = dayAbbr(day)
      for (const bucketHour of [0, 6, 12, 18]) {
        const key = `${dateStr}-${bucketHour}`
        const b = sixHourBuckets[key]
        sixHourPoints.push({
          label: hourLabel(bucketHour),
          sublabel: bucketHour === 0 ? dayName : undefined,
          isNewDay: bucketHour === 0,
          pm1_0: b && b.count > 0 ? round1(b.s1 / b.count) : 0,
          pm2_5: b && b.count > 0 ? round1(b.s25 / b.count) : 0,
          pm10: b && b.count > 0 ? round1(b.s10 / b.count) : 0,
        })
      }
    }
    setThreeDaySixHour(sixHourPoints)
  }, [session])

  // ── BLE live reading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!bleReading || !session) return

    // Immediately update current for live display
    setCurrent({
      id: 'ble-live',
      user_id: session.user.id,
      timestamp: bleReading.timestamp.toISOString(),
      pm1_0: bleReading.pm1,
      pm2_5: bleReading.pm25,
      pm10: bleReading.pm10,
      source: 'ble',
      created_at: bleReading.timestamp.toISOString(),
    })

    // Write to Supabase throttled to once per minute so history charts stay current
    const now = Date.now()
    if (now - lastBleWrite.current < 5_000) return
    lastBleWrite.current = now
    supabase
      .from('exposure_readings')
      .insert({
        user_id: session.user.id,
        timestamp: bleReading.timestamp.toISOString(),
        pm1_0: bleReading.pm1,
        pm2_5: bleReading.pm25,
        pm10: bleReading.pm10,
        source: 'ble',
      })
      .then(({ error }) => { if (!error) fetchHistory() })
  }, [bleReading, session, fetchHistory])

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

  return { current, todayHourly, threeDaySixHour, sevenDayDaily, loading, error, refetch }
}
