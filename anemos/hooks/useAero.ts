import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useSession } from '../context/AuthContext'
import type { AeroConversation, AeroRole, UserProfile } from '../types/database'

const PAGE_SIZE = 10
const CONTEXT_HISTORY_LIMIT = 10

export interface UseAeroResult {
  messages: AeroConversation[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  sending: boolean
  error: string | null
  suggestions: string[]
  sendMessage: (text: string) => Promise<void>
  loadMore: () => Promise<void>
  clearError: () => void
}

const FOLLOW_UP_RE = /\nFOLLOW_UP: (.+)$/

function parseFollowUps(text: string): { clean: string; suggestions: string[] } {
  const match = text.match(FOLLOW_UP_RE)
  if (!match) return { clean: text.trim(), suggestions: [] }
  const suggestions = match[1].split('|').map(s => s.trim()).filter(Boolean)
  return { clean: text.replace(FOLLOW_UP_RE, '').trim(), suggestions }
}

// ─── Context builders ─────────────────────────────────────────────────────────

const round1 = (v: number) => Math.round(v * 10) / 10

async function buildContext(userId: string): Promise<Record<string, unknown>> {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Fetch all data in parallel
  const [exposureRes, logsRes, profileRes] = await Promise.all([
    supabase
      .from('exposure_readings')
      .select('timestamp, pm1_0, pm2_5, pm10')
      .eq('user_id', userId)
      .gte('timestamp', sevenDaysAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(500),
    supabase
      .from('health_logs')
      .select('logged_at, wellbeing, symptoms, symptoms_notes, activity, notes, pm2_5_snapshot')
      .eq('user_id', userId)
      .gte('logged_at', sevenDaysAgo.toISOString())
      .order('logged_at', { ascending: false })
      .limit(20),
    supabase
      .from('user_profiles')
      .select('age, weight, gender, health_conditions, allergies')
      .eq('user_id', userId)
      .single(),
  ])

  const readings = (exposureRes.data ?? []) as { timestamp: string; pm1_0: number | null; pm2_5: number | null; pm10: number | null }[]
  const logs = (logsRes.data ?? []) as { logged_at: string; wellbeing: number; symptoms: string[]; symptoms_notes: string | null; activity: string | null; notes: string | null; pm2_5_snapshot: number | null }[]
  const profile = (profileRes.data ?? {}) as Partial<UserProfile>

  // ── Schema 1: Exposure Summary ──────────────────────────────────────────────

  const latest = readings[0] ?? null
  const todayStr = new Date().toISOString().slice(0, 10)

  // Today's hourly data
  const todayReadings = readings.filter(r => r.timestamp.startsWith(todayStr))
  const todayPm25 = todayReadings.map(r => r.pm2_5 ?? 0).filter(v => v > 0)
  const todayPm1 = todayReadings.map(r => r.pm1_0 ?? 0).filter(v => v > 0)
  const todayPm10 = todayReadings.map(r => r.pm10 ?? 0).filter(v => v > 0)

  // Hourly buckets for best/peak (today)
  const hourBuckets: Record<number, number[]> = {}
  for (const r of todayReadings) {
    if (r.pm2_5 == null) continue
    const h = new Date(r.timestamp).getHours()
    if (!hourBuckets[h]) hourBuckets[h] = []
    hourBuckets[h].push(r.pm2_5)
  }
  const hourlyAvgs = Object.entries(hourBuckets).map(([h, vals]) => ({
    hour: parseInt(h),
    avg: round1(vals.reduce((a, b) => a + b, 0) / vals.length),
  }))
  const peakHour = hourlyAvgs.sort((a, b) => b.avg - a.avg)[0]
  const bestHour = hourlyAvgs.sort((a, b) => a.avg - b.avg)[0]

  // Daily hourly peaks across all 7 days — used by Schema 2 (Temporal Avoidance)
  const dailyHourBuckets: Record<string, Record<number, number[]>> = {}
  for (const r of readings) {
    if (r.pm2_5 == null) continue
    const date = r.timestamp.slice(0, 10)
    const hour = new Date(r.timestamp).getHours()
    if (!dailyHourBuckets[date]) dailyHourBuckets[date] = {}
    if (!dailyHourBuckets[date][hour]) dailyHourBuckets[date][hour] = []
    dailyHourBuckets[date][hour].push(r.pm2_5)
  }
  const daily_peak_hours = Object.entries(dailyHourBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, hours]) => {
      const avgs = Object.entries(hours).map(([h, vals]) => ({
        hour: parseInt(h),
        avg: round1(vals.reduce((a, b) => a + b, 0) / vals.length),
      }))
      const peak = avgs.reduce((max, cur) => (cur.avg > max.avg ? cur : max), avgs[0])
      const best = avgs.reduce((min, cur) => (cur.avg < min.avg ? cur : min), avgs[0])
      const likely_source =
        peak.hour >= 7 && peak.hour <= 9
          ? 'morning traffic'
          : peak.hour >= 17 && peak.hour <= 19
          ? 'evening traffic'
          : undefined
      return { date, peak_time: `${peak.hour}:00`, peak_value: peak.avg, best_time: `${best.hour}:00`, best_value: best.avg, likely_source }
    })

  // 7-day daily averages
  const dayBuckets: Record<string, { s25: number; s1: number; s10: number; count: number }> = {}
  for (const r of readings) {
    const date = r.timestamp.slice(0, 10)
    if (!dayBuckets[date]) dayBuckets[date] = { s25: 0, s1: 0, s10: 0, count: 0 }
    dayBuckets[date].s25 += r.pm2_5 ?? 0
    dayBuckets[date].s1 += r.pm1_0 ?? 0
    dayBuckets[date].s10 += r.pm10 ?? 0
    dayBuckets[date].count += 1
  }
  const last7days = Object.entries(dayBuckets)
    .map(([date, { s25, s1, s10, count }]) => ({
      date,
      avg_pm2_5: count > 0 ? round1(s25 / count) : 0,
      avg_pm1_0: count > 0 ? round1(s1 / count) : 0,
      avg_pm10: count > 0 ? round1(s10 / count) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const avg7dPm25 = last7days.length > 0
    ? round1(last7days.reduce((s, d) => s + d.avg_pm2_5, 0) / last7days.length)
    : null

  const todayAvgPm25 = todayPm25.length > 0 ? round1(todayPm25.reduce((a, b) => a + b) / todayPm25.length) : null
  const peakPm25Today = todayPm25.length > 0 ? round1(Math.max(...todayPm25)) : null

  const exposure_summary = {
    current: latest ? {
      pm1_0: latest.pm1_0,
      pm2_5: latest.pm2_5,
      pm10: latest.pm10,
      timestamp: latest.timestamp,
    } : null,
    today: {
      avg_pm2_5: todayAvgPm25,
      avg_pm1_0: todayPm1.length > 0 ? round1(todayPm1.reduce((a, b) => a + b) / todayPm1.length) : null,
      avg_pm10: todayPm10.length > 0 ? round1(todayPm10.reduce((a, b) => a + b) / todayPm10.length) : null,
      peak_pm2_5: peakPm25Today,
      peak_hour: peakHour ? `${peakHour.hour}:00` : null,
      best_hour: bestHour ? `${bestHour.hour}:00` : null,
      daily_peak_hours,
    },
    last7days,
    who_guideline_pm2_5: 15,
  }

  // ── Schema 2: Health Context ────────────────────────────────────────────────

  const recent_logs = logs.slice(0, 5).map(l => ({
    logged_at: l.logged_at,
    wellbeing: l.wellbeing,
    symptoms: l.symptoms,
    activity: l.activity,
    pm2_5_snapshot: l.pm2_5_snapshot,
    notes_snippet: (l.symptoms_notes || l.notes || '').slice(0, 100) || null,
  }))

  // Pattern hints from all 7-day logs
  const allSymptoms = logs.flatMap(l => l.symptoms)
  const symptomCounts: Record<string, number> = {}
  for (const sym of allSymptoms) {
    if (sym === 'No symptoms') continue
    symptomCounts[sym] = (symptomCounts[sym] ?? 0) + 1
  }
  const most_common_symptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([s]) => s)

  const wellbeingScores = logs.map(l => l.wellbeing)
  const avg_wellbeing_7d = wellbeingScores.length > 0
    ? round1(wellbeingScores.reduce((a, b) => a + b) / wellbeingScores.length)
    : null

  const pm25Snapshots = logs.map(l => l.pm2_5_snapshot).filter((v): v is number => v !== null)
  const worst_logged_pm2_5 = pm25Snapshots.length > 0 ? Math.max(...pm25Snapshots) : null

  const goodLogs = logs.filter(l => l.wellbeing >= 4 && l.pm2_5_snapshot !== null)
  const best_wellbeing_pm2_5 = goodLogs.length > 0
    ? round1(goodLogs.reduce((s, l) => s + (l.pm2_5_snapshot ?? 0), 0) / goodLogs.length)
    : null

  const health_context = {
    recent_logs,
    pattern_hints: {
      avg_wellbeing_7d,
      most_common_symptoms,
      worst_logged_pm2_5,
      best_wellbeing_pm2_5,
      total_logs_7d: logs.length,
    },
  }

  // ── Schema 3: User Risk Profile ─────────────────────────────────────────────

  const conditions = profile.health_conditions ?? []
  const allergies = profile.allergies ? profile.allergies.split(',').map(s => s.trim()) : []

  const sensitivityParts: string[] = []
  if (conditions.some(c => /asthma/i.test(c))) sensitivityParts.push('elevated PM2.5 sensitivity due to asthma')
  if (conditions.some(c => /hay fever|rhinitis/i.test(c))) sensitivityParts.push('pollen and particulate sensitivity')
  if (conditions.some(c => /COPD/i.test(c))) sensitivityParts.push('high respiratory sensitivity to all PM levels')
  if (conditions.some(c => /heart/i.test(c))) sensitivityParts.push('cardiovascular risk from PM2.5 spikes')
  if (allergies.some(a => /pollen|grass|tree|ragweed/i.test(a))) sensitivityParts.push('outdoor pollen allergen sensitivity')

  const user_profile = {
    age: profile.age ?? null,
    weight: profile.weight ?? null,
    gender: profile.gender ?? null,
    health_conditions: conditions,
    allergies,
    sensitivity_note: sensitivityParts.length > 0 ? sensitivityParts.join('; ') : null,
  }

  // ── Schema 4: Proactive Insight Triggers ────────────────────────────────────

  const currentPm25 = latest?.pm2_5 ?? null
  const current_vs_7d_avg = currentPm25 !== null && avg7dPm25 && avg7dPm25 > 0
    ? round1(((currentPm25 - avg7dPm25) / avg7dPm25) * 100)
    : null

  // Did user log symptoms when PM2.5 was within ±5 of current level?
  const recent_symptom_at_this_level = currentPm25 !== null && logs.some(l =>
    l.pm2_5_snapshot !== null &&
    Math.abs(l.pm2_5_snapshot - currentPm25) <= 5 &&
    l.symptoms.length > 0 &&
    !l.symptoms.includes('No symptoms')
  )

  // Outdoor activity risk
  const highRiskConditions = conditions.some(c => /asthma|COPD|heart/i.test(c))
  const outdoorRisk = currentPm25 === null ? 'unknown'
    : currentPm25 > 35 || (highRiskConditions && currentPm25 > 15) ? 'high'
    : currentPm25 > 15 || (highRiskConditions && currentPm25 > 10) ? 'moderate'
    : 'low'

  const who_exceedance_today = todayReadings.some(r => (r.pm2_5 ?? 0) > 15)

  const insights = {
    current_vs_7d_avg_pct: current_vs_7d_avg,
    recent_symptom_at_this_level,
    outdoor_activity_risk: outdoorRisk,
    best_time_today: bestHour ? `${bestHour.hour}:00 (avg ${bestHour.avg} μg/m³)` : null,
    who_exceedance_today,
  }

  return { exposure_summary, health_context, user_profile, insights }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAero(): UseAeroResult {
  const { session } = useSession()
  const [messages, setMessages] = useState<AeroConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const oldestCursorRef = useState<string | null>(null)

  const fetchInitial = useCallback(async () => {
    if (!session) return
    const { data, error: fetchError } = await supabase
      .from('aero_conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (fetchError) { setError(fetchError.message); return }
    const rows = ((data ?? []) as AeroConversation[]).reverse()
    setMessages(rows)
    setHasMore((data ?? []).length === PAGE_SIZE)
    if (rows.length > 0) oldestCursorRef[1](rows[0].created_at)
  }, [session])

  const loadMore = useCallback(async () => {
    if (!session || loadingMore || !hasMore || !oldestCursorRef[0]) return
    setLoadingMore(true)
    const { data, error: fetchError } = await supabase
      .from('aero_conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .lt('created_at', oldestCursorRef[0])
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (fetchError) { setError(fetchError.message) } else {
      const rows = ((data ?? []) as AeroConversation[]).reverse()
      setMessages(prev => [...rows, ...prev])
      setHasMore((data ?? []).length === PAGE_SIZE)
      if (rows.length > 0) oldestCursorRef[1](rows[0].created_at)
    }
    setLoadingMore(false)
  }, [session, loadingMore, hasMore, oldestCursorRef])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setError(null)
    fetchInitial().finally(() => setLoading(false))
  }, [session, fetchInitial])

  const sendMessage = useCallback(async (text: string) => {
    if (!session || !text.trim() || sending) return
    setSending(true)
    setError(null)

    const optimisticId = `optimistic-${Date.now()}`
    const optimisticMsg: AeroConversation = {
      id: optimisticId,
      user_id: session.user.id,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      // Persist user message
      const { data: savedUserMsg, error: insertError } = await supabase
        .from('aero_conversations')
        .insert({ user_id: session.user.id, role: 'user', content: text.trim() })
        .select()
        .single()
      if (insertError) throw new Error(insertError.message)

      setMessages(prev =>
        prev.map(m => (m.id === optimisticId ? (savedUserMsg as AeroConversation) : m))
      )

      // Build rich context and conversation history in parallel
      const [context, historyData] = await Promise.all([
        buildContext(session.user.id),
        Promise.resolve(messages.slice(-CONTEXT_HISTORY_LIMIT)),
      ])

      // Build Claude messages array (no context prefix — it lives in the system prompt)
      const claudeMessages = [
        ...historyData.map(m => ({ role: m.role as AeroRole, content: m.content })),
        { role: 'user' as AeroRole, content: text.trim() },
      ]

      // Call Claude via Supabase Edge Function
      const { data: claudeData, error: fnError } = await supabase.functions.invoke('aero-query', {
        body: { messages: claudeMessages, context },
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (fnError) throw new Error(fnError.message)
      if (claudeData?.error) throw new Error(claudeData.error)
      const rawText: string = claudeData?.content?.[0]?.text ?? ''
      const { clean: assistantText, suggestions: newSuggestions } = parseFollowUps(rawText)

      // Persist assistant response (store clean text without FOLLOW_UP line)
      const { data: savedAssistantMsg, error: assistantInsertError } = await supabase
        .from('aero_conversations')
        .insert({ user_id: session.user.id, role: 'assistant', content: assistantText })
        .select()
        .single()
      if (assistantInsertError) throw new Error(assistantInsertError.message)

      setMessages(prev => [...prev, savedAssistantMsg as AeroConversation])
      setSuggestions(newSuggestions)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }, [session, messages, sending])

  const clearError = useCallback(() => setError(null), [])

  return { messages, loading, loadingMore, hasMore, sending, error, suggestions, sendMessage, loadMore, clearError }
}
