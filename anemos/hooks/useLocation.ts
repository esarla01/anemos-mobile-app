import { useState, useEffect } from 'react'
import * as Location from 'expo-location'

export interface LocationState {
  label: string | null   // e.g. "Shoreditch, London" or "London, W2"
  granted: boolean
  loading: boolean
  error: string | null
  refresh: () => void
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
  if (!results.length) return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
  const r = results[0]
  // Build a compact label: neighbourhood or district + city, fallback to city + postalCode
  const area = r.district ?? r.subregion ?? r.name ?? null
  const city = r.city ?? r.region ?? null
  if (area && city && area !== city) return `${city}, ${area}`
  if (city) return city
  return `${lat.toFixed(3)}, ${lon.toFixed(3)}`
}

export function useLocation(): LocationState {
  const [label, setLabel] = useState<string | null>(null)
  const [granted, setGranted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = () => setTick(t => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return

      if (status !== 'granted') {
        setGranted(false)
        setError('Location permission denied')
        setLoading(false)
        return
      }

      setGranted(true)

      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (cancelled) return
        const loc = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
        if (!cancelled) setLabel(loc)
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not get location')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [tick])

  return { label, granted, loading, error, refresh }
}
