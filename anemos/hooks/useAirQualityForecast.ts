import { useState, useEffect } from 'react'
import { Colors } from '../constants/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayAQI {
  label: string       // "Today", "Mon", "Tue"
  avgPM25: number
  maxPM25: number
  statusLabel: string // "Good" | "Moderate" | "Unhealthy for Sensitive Groups" | "Unhealthy" | "Very Unhealthy"
  color: string
  softColor: string
}

export type PollenLevel = 'Low' | 'Moderate' | 'High' | 'Very High'

export interface PollenType {
  name: string       // "Grass" | "Tree" | "Weed"
  level: PollenLevel
  color: string
  softColor: string
}

export interface UseAirQualityForecastResult {
  aqiForecast: DayAQI[]
  currentPollen: PollenType[]
  loading: boolean
  error: string | null
  refetch: () => void
}

// ─── AQI helpers ──────────────────────────────────────────────────────────────

// PM2.5 thresholds matching the existing getAQI() used across the app
function pm25Status(pm25: number): { statusLabel: string; color: string; softColor: string } {
  if (pm25 <= 12)    return { statusLabel: 'Good',                           color: Colors.aqiGood,          softColor: Colors.aqiGoodSoft }
  if (pm25 <= 35.4)  return { statusLabel: 'Moderate',                       color: Colors.aqiModerate,      softColor: Colors.aqiModerateSoft }
  if (pm25 <= 55.4)  return { statusLabel: 'Unhealthy for Sensitive Groups',  color: Colors.aqiSensitive,     softColor: Colors.aqiSensitiveSoft }
  if (pm25 <= 150.4) return { statusLabel: 'Unhealthy',                      color: Colors.aqiUnhealthy,     softColor: Colors.aqiUnhealthySoft }
  return              { statusLabel: 'Very Unhealthy',                        color: Colors.aqiVeryUnhealthy, softColor: Colors.aqiVeryUnhealthySoft }
}

// ─── Pollen helpers ───────────────────────────────────────────────────────────

function pollenLevelGrass(v: number): PollenLevel {
  if (v < 10)  return 'Low'
  if (v < 50)  return 'Moderate'
  if (v < 200) return 'High'
  return 'Very High'
}

function pollenLevelTree(v: number): PollenLevel {
  if (v < 15)   return 'Low'
  if (v < 90)   return 'Moderate'
  if (v < 1500) return 'High'
  return 'Very High'
}

function pollenLevelWeed(v: number): PollenLevel {
  if (v < 10)  return 'Low'
  if (v < 50)  return 'Moderate'
  if (v < 500) return 'High'
  return 'Very High'
}

function pollenColor(level: PollenLevel): { color: string; softColor: string } {
  switch (level) {
    case 'Low':       return { color: Colors.aqiGood,         softColor: Colors.aqiGoodSoft }
    case 'Moderate':  return { color: Colors.aqiModerate,     softColor: Colors.aqiModerateSoft }
    case 'High':      return { color: Colors.aqiSensitive,    softColor: Colors.aqiSensitiveSoft }
    case 'Very High': return { color: Colors.aqiUnhealthy,    softColor: Colors.aqiUnhealthySoft }
  }
}

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today'
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

// TODO: Replace hardcoded London coordinates with device location when ready.
// To use device location, remove LOCATION_COORDS below and pass `coords` directly
// into the fetch URL (latitude=${coords.latitude}&longitude=${coords.longitude}).
// The `coords` parameter from useLocation() is already wired up in exposure.tsx.
const LOCATION_COORDS = { latitude: 51.5074, longitude: -0.1278 } // London

export function useAirQualityForecast(
  _coords: { latitude: number; longitude: number } | null
): UseAirQualityForecastResult {
  const [aqiForecast, setAqiForecast] = useState<DayAQI[]>([])
  const [currentPollen, setCurrentPollen] = useState<PollenType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refetch = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const { latitude, longitude } = LOCATION_COORDS
        const url =
          `https://air-quality-api.open-meteo.com/v1/air-quality` +
          `?latitude=${latitude}&longitude=${longitude}` +
          `&hourly=pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen` +
          `&forecast_days=3&timezone=auto`

        const res = await fetch(url)
        if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
        const json = await res.json()

        if (cancelled) return

        const times: string[] = json.hourly.time
        const pm25: (number | null)[] = json.hourly.pm2_5
        const alderPollen: (number | null)[] = json.hourly.alder_pollen
        const birchPollen: (number | null)[] = json.hourly.birch_pollen
        const grassPollen: (number | null)[] = json.hourly.grass_pollen
        const mugwortPollen: (number | null)[] = json.hourly.mugwort_pollen
        const olivePollen: (number | null)[] = json.hourly.olive_pollen
        const ragweedPollen: (number | null)[] = json.hourly.ragweed_pollen

        // Build per-day PM2.5 buckets
        type DayBucket = { sumPM25: number; maxPM25: number; count: number }
        const dayBuckets: Record<string, DayBucket> = {}

        for (let i = 0; i < times.length; i++) {
          const dateKey = times[i].slice(0, 10)
          const val = pm25[i]
          if (val == null) continue
          if (!dayBuckets[dateKey]) dayBuckets[dateKey] = { sumPM25: 0, maxPM25: 0, count: 0 }
          dayBuckets[dateKey].sumPM25 += val
          dayBuckets[dateKey].maxPM25 = Math.max(dayBuckets[dateKey].maxPM25, val)
          dayBuckets[dateKey].count += 1
        }

        const sortedDates = Object.keys(dayBuckets).sort()
        const forecast: DayAQI[] = sortedDates.slice(0, 3).map((date, idx) => {
          const b = dayBuckets[date]
          const avg = b.count > 0 ? Math.round((b.sumPM25 / b.count) * 10) / 10 : 0
          const max = Math.round(b.maxPM25 * 10) / 10
          const { statusLabel, color, softColor } = pm25Status(avg)
          return { label: dayLabel(idx), avgPM25: avg, maxPM25: max, statusLabel, color, softColor }
        })
        setAqiForecast(forecast)

        // Current pollen: find the index matching current hour.
        // API times are in local timezone (timezone=auto), so format now as local "YYYY-MM-DDTHH:00"
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        const currentHourStr =
          `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
          `T${pad(now.getHours())}:00`
        let currentIdx = 0
        for (let i = 0; i < times.length; i++) {
          if (times[i] <= currentHourStr) currentIdx = i
        }

        const grassVal = grassPollen[currentIdx] ?? 0
        const treeVal = Math.max(alderPollen[currentIdx] ?? 0, birchPollen[currentIdx] ?? 0, olivePollen[currentIdx] ?? 0)
        const weedVal = Math.max(ragweedPollen[currentIdx] ?? 0, mugwortPollen[currentIdx] ?? 0)

        const grassLevel = pollenLevelGrass(grassVal)
        const treeLevel = pollenLevelTree(treeVal)
        const weedLevel = pollenLevelWeed(weedVal)

        setCurrentPollen([
          { name: 'Grass', level: grassLevel, ...pollenColor(grassLevel) },
          { name: 'Tree',  level: treeLevel,  ...pollenColor(treeLevel) },
          { name: 'Weed',  level: weedLevel,  ...pollenColor(weedLevel) },
        ])
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load forecast')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [tick]) // TODO: switch to [tick, _coords?.latitude, _coords?.longitude] when using device location

  return { aqiForecast, currentPollen, loading, error, refetch }
}
