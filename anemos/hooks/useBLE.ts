import { useState, useEffect, useRef } from 'react'
import { BleManager, Device, State } from 'react-native-ble-plx'

export interface PMReading {
  timestamp: Date
  pm1: number
  pm25: number
  pm10: number
  obstructed: boolean
}

export type BLEConnectionState = 'disconnected' | 'scanning' | 'connecting' | 'connected'

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b'
const CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'
const RECONNECT_DELAY_MS = 2000

export function useBLE() {
  const [connectionState, setConnectionState] = useState<BLEConnectionState>('disconnected')
  const [latestReading, setLatestReading] = useState<PMReading | null>(null)

  const manager = useRef<BleManager | null>(null)
  const device = useRef<Device | null>(null)
  const mounted = useRef(true)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    mounted.current = true
    manager.current = new BleManager()
    const mgr = manager.current

    function parseReading(base64: string) {
      try {
        const raw = atob(base64)
        const bytes = Uint8Array.from(raw, c => c.charCodeAt(0))
        if (bytes.length < 12) return
        const view = new DataView(bytes.buffer)
        setLatestReading({
          timestamp: new Date(),
          pm1: view.getFloat32(0, true),
          pm25: view.getFloat32(4, true),
          pm10: view.getFloat32(8, true),
          obstructed: bytes.length >= 13 && bytes[12] === 1,
        })
      } catch {}
    }

    function reconnect() {
      clearTimeout(retryTimer.current)
      retryTimer.current = setTimeout(scan, RECONNECT_DELAY_MS)
    }

    function scan() {
      if (!mounted.current) return
      setConnectionState('scanning')
      mgr.startDeviceScan([SERVICE_UUID], null, (err, d) => {
        if (!mounted.current) return
        if (err || !d) {
          reconnect()
          return
        }
        mgr.stopDeviceScan()
        setConnectionState('connecting')
        d.connect()
          .then(connected => connected.discoverAllServicesAndCharacteristics())
          .then(discovered => {
            if (!mounted.current) return
            device.current = discovered
            setConnectionState('connected')
            discovered.monitorCharacteristicForService(SERVICE_UUID, CHAR_UUID, (err, char) => {
              if (err) {
                device.current = null
                if (mounted.current) {
                  setConnectionState('disconnected')
                  reconnect()
                }
                return
              }
              if (char?.value) parseReading(char.value)
            })
          })
          .catch(() => {
            device.current = null
            if (mounted.current) reconnect()
          })
      })
    }

    const stateSub = mgr.onStateChange(state => {
      if (state === State.PoweredOn) {
        stateSub.remove()
        scan()
      }
    }, true)

    return () => {
      mounted.current = false
      stateSub.remove()
      clearTimeout(retryTimer.current)
      mgr.stopDeviceScan()
      device.current?.cancelConnection().catch(() => {})
      mgr.destroy()
      manager.current = null
    }
  }, [])

  return { connectionState, latestReading }
}
