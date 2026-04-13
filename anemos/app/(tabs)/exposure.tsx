import { useState, useMemo } from 'react'
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  Dimensions, TouchableOpacity, Pressable,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, {
  Path, Defs, LinearGradient as SvgGradient, Stop,
  Line, Text as SvgText, Circle, G,
} from 'react-native-svg'
import { useExposure } from '../../hooks/useExposure'
import { useLocation } from '../../hooks/useLocation'
import { useAirQualityForecast } from '../../hooks/useAirQualityForecast'
import { useBLE } from '../../hooks/useBLE'
import type { TimePoint, DailyAverage } from '../../hooks/useExposure'
import type { BLEConnectionState } from '../../hooks/useBLE'
import type { DayAQI, PollenType } from '../../hooks/useAirQualityForecast'
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CHART_H_PADDING = 20
const CHART_WIDTH = SCREEN_WIDTH - CHART_H_PADDING * 2

// ─── AQI helpers ─────────────────────────────────────────────────────────────

interface AQIStatus {
  label: string
  color: string
  softColor: string
  gradient: readonly [string, string]
}

function getAQI(pm25: number): AQIStatus {
  if (pm25 <= 12) return { label: 'Good', color: Colors.aqiGood, softColor: Colors.aqiGoodSoft, gradient: Colors.gradientGood }
  if (pm25 <= 35.4) return { label: 'Moderate', color: Colors.aqiModerate, softColor: Colors.aqiModerateSoft, gradient: Colors.gradientModerate }
  if (pm25 <= 55.4) return { label: 'Unhealthy for Sensitive Groups', color: Colors.aqiSensitive, softColor: Colors.aqiSensitiveSoft, gradient: Colors.gradientSensitive }
  if (pm25 <= 150.4) return { label: 'Unhealthy', color: Colors.aqiUnhealthy, softColor: Colors.aqiUnhealthySoft, gradient: Colors.gradientUnhealthy }
  return { label: 'Very Unhealthy', color: Colors.aqiVeryUnhealthy, softColor: Colors.aqiVeryUnhealthySoft, gradient: Colors.gradientVeryUnhealthy }
}

// WHO daily guidelines (μg/m³)
const WHO: Record<'pm1_0' | 'pm2_5' | 'pm10', number | null> = {
  pm1_0: null,
  pm2_5: 15,
  pm10: 45,
}

// ─── Relative timestamp ──────────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} days ago`
}

// ─── Smooth bezier path ───────────────────────────────────────────────────────

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }
  return d
}

// ─── Trend Chart ─────────────────────────────────────────────────────────────

type MetricKey = 'pm1_0' | 'pm2_5' | 'pm10'
type TabKey = 'today' | '3day' | '7day'

interface TrendChartProps {
  points: (TimePoint | DailyAverage)[]
  metric: MetricKey
  tab: TabKey
}

const CHART_SVG_HEIGHT = 180
const MARGIN = { top: 12, right: 12, bottom: 30, left: 32 }
const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = CHART_SVG_HEIGHT - MARGIN.top - MARGIN.bottom

function TrendChart({ points, metric, tab }: TrendChartProps) {
  const values = points.map(p => {
    if ('avg_pm1_0' in p) {
      return metric === 'pm1_0' ? p.avg_pm1_0 : metric === 'pm10' ? p.avg_pm10 : p.avg_pm25
    }
    return p[metric]
  })

  const whoThreshold = WHO[metric]
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const yMin = Math.max(0, Math.floor(dataMin * 0.85 / 5) * 5)
  const yMax = Math.ceil(Math.max(dataMax * 1.1, whoThreshold ?? 0, yMin + 5) / 5) * 5

  const toX = (i: number) => MARGIN.left + (i / (points.length - 1)) * PLOT_W
  const toY = (v: number) => MARGIN.top + PLOT_H - ((v - yMin) / (yMax - yMin)) * PLOT_H

  const coords = values.map((v, i) => ({ x: toX(i), y: toY(v) }))
  const linePath = smoothPath(coords)
  const areaPath = coords.length > 0
    ? `${linePath} L ${coords[coords.length - 1].x} ${MARGIN.top + PLOT_H} L ${coords[0].x} ${MARGIN.top + PLOT_H} Z`
    : ''

  // Y-axis grid lines (4 ticks)
  const yStep = (yMax - yMin) / 4
  const yTicks = [0, 1, 2, 3, 4].map(i => yMin + i * yStep)

  // X-axis labels — sparse to avoid clutter
  const xLabels = useMemo(() => {
    if (tab === 'today') {
      // Show hours: 0, 3, 6, 9, 12, 15, 18, 21, and last
      const showHours = new Set([0, 3, 6, 9, 12, 15, 18, 21, 23])
      return points.map((p, i) => {
        const tp = p as TimePoint
        const hour = parseInt(tp.label) // won't parse "12a" perfectly, use index approach
        const h = i  // index corresponds to hour since todayHourly starts at 0
        if (!showHours.has(h) && i !== points.length - 1) return null
        return { i, label: tp.label }
      }).filter(Boolean) as { i: number; label: string }[]
    }
    if (tab === '3day') {
      // Show label at each new day (isNewDay) and at noon (index 2 of each day)
      return points.map((p, i) => {
        const tp = p as TimePoint
        if (tp.isNewDay || tp.sublabel) return { i, label: tp.label, sublabel: tp.sublabel }
        return null
      }).filter(Boolean) as { i: number; label: string; sublabel?: string }[]
    }
    // 7-day: show each day
    return points.map((p, i) => {
      const d = p as DailyAverage
      const date = new Date(d.date + 'T12:00:00')
      return { i, label: date.toLocaleDateString('en-US', { weekday: 'short' }) }
    })
  }, [points, tab])

  const showDots = points.length <= 12

  if (points.length < 2) {
    return (
      <View style={[s.chartPlaceholder, { height: CHART_SVG_HEIGHT }]}>
        <Text style={s.chartPlaceholderText}>No data yet</Text>
      </View>
    )
  }

  return (
    <Svg width={CHART_WIDTH} height={CHART_SVG_HEIGHT}>
      <Defs>
        <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A7C7C" stopOpacity="0.14" />
          <Stop offset="1" stopColor="#3A7C7C" stopOpacity="0.01" />
        </SvgGradient>
      </Defs>

      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <Line
          key={i}
          x1={MARGIN.left}
          y1={toY(tick)}
          x2={MARGIN.left + PLOT_W}
          y2={toY(tick)}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={1}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick, i) => (
        <SvgText
          key={i}
          x={MARGIN.left - 4}
          y={toY(tick) + 3}
          fontSize={9}
          fill={Colors.textTertiary}
          textAnchor="end"
          fontFamily={FontFamily.regular}
        >
          {Math.round(tick)}
        </SvgText>
      ))}

      {/* WHO guideline dashed line */}
      {whoThreshold != null && whoThreshold >= yMin && whoThreshold <= yMax && (
        <Line
          x1={MARGIN.left}
          y1={toY(whoThreshold)}
          x2={MARGIN.left + PLOT_W}
          y2={toY(whoThreshold)}
          stroke={Colors.whoRed}
          strokeWidth={1}
          strokeDasharray="4,4"
          strokeOpacity={0.5}
        />
      )}

      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaFill)" />

      {/* Line */}
      <Path
        d={linePath}
        fill="none"
        stroke="#3A7C7C"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data dots (only when ≤12 points) */}
      {showDots && coords.map((c, i) => (
        <Circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={3.5}
          fill="#FFFFFF"
          stroke="#3A7C7C"
          strokeWidth={1.5}
        />
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ i, label, sublabel }: any) => {
        const x = toX(i)
        const baseY = MARGIN.top + PLOT_H + 16
        return (
          <G key={i}>
            {sublabel ? (
              <SvgText
                x={x}
                y={baseY - 8}
                fontSize={9}
                fill={Colors.textSecondary}
                textAnchor="middle"
                fontFamily={FontFamily.bold}
              >
                {sublabel}
              </SvgText>
            ) : null}
            <SvgText
              x={x}
              y={sublabel ? baseY + 2 : baseY}
              fontSize={9}
              fill={Colors.textTertiary}
              textAnchor="middle"
              fontFamily={FontFamily.regular}
            >
              {label}
            </SvgText>
          </G>
        )
      })}
    </Svg>
  )
}

// ─── Pill selector ────────────────────────────────────────────────────────────

interface PillSelectorProps {
  options: { key: string; label: string }[]
  active: string
  onSelect: (key: string) => void
  size?: 'large' | 'small'
}

function PillSelector({ options, active, onSelect, size = 'large' }: PillSelectorProps) {
  const isLarge = size === 'large'
  return (
    <View style={[s.pillRow, isLarge ? s.pillRowLarge : s.pillRowSmall]}>
      {options.map(opt => {
        const isActive = active === opt.key
        return (
          <Pressable
            key={opt.key}
            style={({ pressed }) => [
              s.pill,
              isLarge ? s.pillLarge : s.pillSmall,
              isActive && (isLarge ? s.pillActiveLarge : s.pillActiveSmall),
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
            onPress={() => onSelect(opt.key)}
          >
            <Text style={[
              s.pillText,
              isLarge ? s.pillTextLarge : s.pillTextSmall,
              isActive && (isLarge ? s.pillTextActiveLarge : s.pillTextActiveSmall),
            ]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  points: (TimePoint | DailyAverage)[]
  tab: TabKey
}

function SummaryCard({ points, tab }: SummaryCardProps) {
  if (points.length === 0) return null

  const vals = (field: 'pm1_0' | 'pm2_5' | 'pm10') =>
    points.map(p => ('avg_pm1_0' in p ? (field === 'pm1_0' ? p.avg_pm1_0 : field === 'pm10' ? p.avg_pm10 : p.avg_pm25) : p[field]))

  const avg = (arr: number[]) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10
  const pm1Avg = avg(vals('pm1_0'))
  const pm25Avg = avg(vals('pm2_5'))
  const pm10Avg = avg(vals('pm10'))
  const aqi = getAQI(pm25Avg)

  const pm25Vals = vals('pm2_5')
  const minIdx = pm25Vals.indexOf(Math.min(...pm25Vals))
  const maxIdx = pm25Vals.indexOf(Math.max(...pm25Vals))

  function extremeLabel(idx: number, isMin: boolean): string {
    const p = points[idx]
    if (tab === 'today') {
      const tp = p as TimePoint
      return `${isMin ? 'Best hour' : 'Peak hour'}  ${tp.label} · ${pm25Vals[idx]} μg/m³`
    }
    if (tab === '3day') {
      const tp = p as TimePoint
      return `${isMin ? 'Best' : 'Peak'}  ${tp.sublabel ?? tp.label} · ${pm25Vals[idx]} μg/m³`
    }
    const d = p as DailyAverage
    const date = new Date(d.date + 'T12:00:00')
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    return `${isMin ? 'Best day' : 'Worst day'}  ${dayName} · ${pm25Vals[idx]} μg/m³`
  }

  const isOver25 = pm25Avg > 15

  return (
    <View style={s.summaryCard}>
      {/* Top row */}
      <View style={s.summaryTop}>
        <View style={[s.summaryBadge, { backgroundColor: aqi.softColor }]}>
          <View style={[s.dot, { backgroundColor: aqi.color }]} />
          <Text style={[s.summaryBadgeText, { color: aqi.color }]}>{aqi.label}</Text>
        </View>
        <View style={s.summaryMetrics}>
          {[
            { label: 'PM1.0', value: pm1Avg, over: false },
            { label: 'PM2.5', value: pm25Avg, over: isOver25 },
            { label: 'PM10', value: pm10Avg, over: false },
          ].map(m => (
            <View key={m.label} style={s.summaryMetric}>
              <Text style={s.summaryMetricLabel}>{m.label}</Text>
              <Text style={[s.summaryMetricValue, m.over && { color: Colors.aqiSensitive }]}>
                {m.value}
              </Text>
            </View>
          ))}
        </View>
      </View>
      {/* Bottom row */}
      <View style={s.summaryBottom}>
        <View style={s.extremeItem}>
          <View style={[s.dot, { backgroundColor: Colors.aqiGood }]} />
          <Text style={s.extremeText}>{extremeLabel(minIdx, true)}</Text>
        </View>
        <View style={s.extremeDivider} />
        <View style={s.extremeItem}>
          <View style={[s.dot, { backgroundColor: Colors.aqiSensitive }]} />
          <Text style={s.extremeText}>{extremeLabel(maxIdx, false)}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

function bleBadgeProps(state: BLEConnectionState): { label: string; color: string } {
  switch (state) {
    case 'connected':    return { label: 'Live', color: Colors.primary }
    case 'connecting':   return { label: 'Connecting…', color: '#D4903A' }
    case 'scanning':     return { label: 'Scanning…', color: '#D4903A' }
    case 'disconnected': return { label: 'Sensor offline', color: Colors.textTertiary }
  }
}

const METRICS: { key: MetricKey; label: string }[] = [
  { key: 'pm1_0', label: 'PM1.0' },
  { key: 'pm2_5', label: 'PM2.5' },
  { key: 'pm10', label: 'PM10' },
]

const TABS: { key: TabKey; label: string; subtitle: string; chartLabel: string }[] = [
  { key: 'today', label: 'Today', subtitle: 'Last 24 hours', chartLabel: 'Hourly Trend' },
  { key: '3day', label: '3-Day', subtitle: '3-day trend', chartLabel: '6-Hour Trend' },
  { key: '7day', label: '7-Day', subtitle: '7-day summary', chartLabel: 'Daily Trend' },
]

// ─── AQI Forecast Section ─────────────────────────────────────────────────────

function ForecastSection({ forecast, loading }: { forecast: DayAQI[]; loading: boolean }) {
  return (
    <View style={s.forecastCard}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>3-Day Forecast</Text>
      </View>
      <View style={s.forecastRow}>
        {loading || forecast.length === 0
          ? [0, 1, 2].map(i => (
              <View key={i} style={s.forecastDayCard}>
                <View style={s.skeletonLabel} />
                <View style={s.skeletonValue} />
                <View style={s.skeletonBadge} />
              </View>
            ))
          : forecast.map(day => (
              <View key={day.label} style={[s.forecastDayCard, { backgroundColor: day.softColor }]}>
                <Text style={s.forecastDayLabel}>{day.label}</Text>
                <Text style={[s.forecastAQIValue, { color: day.color }]}>{day.avgPM25}</Text>
                <Text style={s.forecastAQIUnit}>μg/m³</Text>
                <View style={[s.forecastBadge, { backgroundColor: day.color + '22' }]}>
                  <Text style={[s.forecastBadgeText, { color: day.color }]}>{day.statusLabel}</Text>
                </View>
              </View>
            ))
        }
      </View>
    </View>
  )
}

// ─── Aero Insights Banner ─────────────────────────────────────────────────────

interface AeroInsightsBannerProps {
  pctChange: number  // negative = down (good), positive = up (bad)
}

function AeroInsightsBanner({ pctChange }: AeroInsightsBannerProps) {
  const isDown = pctChange < 0
  const abs = Math.abs(pctChange)
  const tint = isDown ? Colors.primaryLight : Colors.aqiModerateSoft
  const accent = isDown ? Colors.primary : Colors.aqiModerate

  return (
    <View style={[s.insightsBanner, { backgroundColor: tint, borderColor: accent }]}>
      <Text style={[s.insightsLabel, { color: accent }]}>Aero Insights</Text>
      <Text style={[s.insightsBody, { color: accent }]}>
        {`Your exposure levels are ${isDown ? 'down' : 'up'} ${abs}% from last week.`}
      </Text>
    </View>
  )
}

// ─── Pollen Section ───────────────────────────────────────────────────────────

function PollenSection({ pollen, loading, hasLocation }: { pollen: PollenType[]; loading: boolean; hasLocation: boolean }) {
  if (!hasLocation) return null

  return (
    <View style={s.pollenCard}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Pollen</Text>
        <Text style={s.sectionSubtitle}>Current levels</Text>
      </View>
      <View style={s.pollenRow}>
        {loading || pollen.length === 0
          ? [0, 1, 2].map(i => <View key={i} style={s.skeletonPollen} />)
          : pollen.map(p => (
              <View key={p.name} style={[s.pollenBadge, { backgroundColor: p.softColor }]}>
                <View style={[s.dot, { backgroundColor: p.color }]} />
                <View>
                  <Text style={[s.pollenName, { color: p.color }]}>{p.name}</Text>
                  <Text style={[s.pollenLevel, { color: p.color }]}>{p.level}</Text>
                </View>
              </View>
            ))
        }
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Exposure() {
  const { connectionState, latestReading: bleReading } = useBLE()
  const { current, todayHourly, threeDaySixHour, sevenDayDaily, loading, error, refetch } = useExposure(bleReading)
  const { coords, label: locationLabel, loading: locationLoading, refresh: refreshLocation } = useLocation()
  const { aqiForecast, currentPollen, loading: forecastLoading, refetch: refetchForecast } = useAirQualityForecast(coords)
  const [heroMetric, setHeroMetric] = useState<MetricKey>('pm2_5')
  const [tab, setTab] = useState<TabKey>('today')
  const [chartMetric, setChartMetric] = useState<MetricKey>('pm2_5')

  const heroValue = current
    ? (heroMetric === 'pm1_0' ? current.pm1_0 : heroMetric === 'pm10' ? current.pm10 : current.pm2_5)
    : null

  const pm25ForAQI = current?.pm2_5 ?? 0
  const aqi = getAQI(pm25ForAQI)
  const bgGradient = aqi.gradient

  const chartPoints: (TimePoint | DailyAverage)[] = tab === 'today'
    ? todayHourly
    : tab === '3day'
    ? threeDaySixHour
    : sevenDayDaily

  const activeTab = TABS.find(t => t.key === tab)!

  const whoLabel = chartMetric === 'pm2_5' ? '15 μg/m³'
    : chartMetric === 'pm10' ? '45 μg/m³'
    : null

  const weekChange = useMemo(() => {
    if (sevenDayDaily.length < 2) return null
    const first = sevenDayDaily[0].avg_pm25
    const last = sevenDayDaily[sevenDayDaily.length - 1].avg_pm25
    if (first === 0) return null
    return Math.round(((last - first) / first) * 100)
  }, [sevenDayDaily])

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={refetch}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={s.root}>
      {/* Ambient background gradient */}
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View>
            <Text style={s.pageTitle}>Air Quality</Text>
            <View style={s.headerMeta}>
              <Text style={s.headerMetaPin}>⊙</Text>
              <Text style={s.headerLocation}>
                {locationLoading ? '…' : (locationLabel ?? 'Unknown')}
              </Text>
              <Text style={s.headerDot}>·</Text>
              <Text style={s.headerTime}>
                {current?.timestamp ? relativeTime(current.timestamp) : '—'}
              </Text>
            </View>
            {(() => {
              const { label, color } = bleBadgeProps(connectionState)
              return (
                <View style={s.bleBadge}>
                  <View style={[s.bleDot, { backgroundColor: color }]} />
                  <Text style={[s.bleLabel, { color }]}>{label}</Text>
                </View>
              )
            })()}
          </View>
          <Pressable
            style={({ pressed }) => [s.locationBtn, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={() => { refreshLocation(); refetch(); refetchForecast() }}
          >
            <Text style={s.locationBtnIcon}>◎</Text>
          </Pressable>
        </View>

        {/* ── Hero card ────────────────────────────────────────────────────── */}
        <View style={s.heroCard}>
          <PillSelector
            options={METRICS}
            active={heroMetric}
            onSelect={k => setHeroMetric(k as MetricKey)}
            size="large"
          />
          <Text style={s.heroValue}>
            {heroValue != null ? heroValue.toFixed(2) : '—'}
          </Text>
          <Text style={s.heroUnit}>μg/m³</Text>
          <View style={[s.heroBadge, { backgroundColor: aqi.softColor }]}>
            <View style={[s.dot, { backgroundColor: aqi.color }]} />
            <Text style={[s.heroBadgeText, { color: aqi.color }]}>{aqi.label}</Text>
          </View>
        </View>

        {/* ── Pollen ───────────────────────────────────────────────────────── */}
        <PollenSection pollen={currentPollen} loading={forecastLoading} hasLocation={!!coords} />

        {/* ── Your Exposure section ────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Your Exposure</Text>
          <Text style={s.sectionSubtitle}>{activeTab.subtitle}</Text>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map(t => {
            const isActive = tab === t.key
            return (
              <Pressable
                key={t.key}
                style={({ pressed }) => [
                  s.tabItem,
                  isActive && s.tabItemActive,
                  pressed && { transform: [{ scale: 0.96 }] },
                ]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[s.tabLabel, isActive && s.tabLabelActive]}>
                  {t.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Summary card */}
        <SummaryCard points={chartPoints} tab={tab} />

        {/* Chart card */}
        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.chartLabel}>{activeTab.chartLabel}</Text>
            <PillSelector
              options={METRICS}
              active={chartMetric}
              onSelect={k => setChartMetric(k as MetricKey)}
              size="small"
            />
          </View>

          <TrendChart points={chartPoints} metric={chartMetric} tab={tab} />

          {whoLabel && (
            <>
              <View style={s.whoSeparator} />
              <View style={s.whoLegend}>
                <View style={s.whoDash}>
                  {[0, 1, 2].map(i => <View key={i} style={s.whoDashSegment} />)}
                </View>
                <Text style={s.whoText}>WHO daily guideline: {whoLabel}</Text>
              </View>
            </>
          )}
        </View>

        {/* ── Aero Insights ────────────────────────────────────────────────── */}
        {weekChange != null && weekChange !== 0 && (
          <AeroInsightsBanner pctChange={weekChange} />
        )}

        {/* ── AQI Forecast ─────────────────────────────────────────────────── */}
        <View style={{ height: 16 }} />
        <ForecastSection forecast={aqiForecast} loading={forecastLoading} />

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: CHART_H_PADDING, paddingTop: 56, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: FontSize.section,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerMetaPin: { fontSize: 12, color: Colors.primary },
  headerLocation: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, color: Colors.textSecondary },
  headerDot: { fontSize: FontSize.caption, color: Colors.textTertiary },
  headerTime: { fontSize: FontSize.caption, fontFamily: FontFamily.regular, color: Colors.textTertiary },
  locationBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.subtle,
  },
  locationBtnIcon: { fontSize: 16, color: Colors.textSecondary },

  // Aero Insights banner
  insightsBanner: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    gap: 2,
  },
  insightsLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  insightsBody: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.serif,
    lineHeight: 22,
  },

  // Hero card
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 22,
    ...Shadow.card,
  },
  heroValue: {
    fontSize: 52,
    fontFamily: FontFamily.serif,
    color: Colors.textPrimary,
    lineHeight: 60,
    marginTop: 12,
  },
  heroUnit: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    marginTop: 2,
    marginBottom: 14,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
  },
  heroBadgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },

  // Pill selector (large — hero)
  pillRow: { flexDirection: 'row' },
  pillRowLarge: {
    backgroundColor: Colors.surfaceInner,
    borderRadius: Radius.md,
    padding: 3,
    gap: 2,
  },
  pillRowSmall: { gap: 5 },
  pill: { alignItems: 'center', justifyContent: 'center' },
  pillLarge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  pillSmall: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActiveLarge: { backgroundColor: Colors.primary, ...Shadow.pill },
  pillActiveSmall: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  pillText: { fontFamily: FontFamily.medium },
  pillTextLarge: { fontSize: FontSize.caption, color: Colors.textTertiary },
  pillTextSmall: { fontSize: FontSize.micro, color: Colors.textTertiary },
  pillTextActiveLarge: { color: '#FFFFFF', fontFamily: FontFamily.bold },
  pillTextActiveSmall: { color: Colors.primary, fontFamily: FontFamily.bold },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceInner,
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabItemActive: { backgroundColor: Colors.surface, ...Shadow.subtle },
  tabLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
  },
  tabLabelActive: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },

  // Summary card
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 12,
    ...Shadow.card,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  summaryBadgeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
  },
  summaryMetrics: {
    flexDirection: 'row',
    gap: 18,
  },
  summaryMetric: { alignItems: 'center' },
  summaryMetricLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  summaryMetricValue: {
    fontSize: 17,
    fontFamily: FontFamily.serif,
    color: Colors.textPrimary,
  },
  summaryBottom: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 10,
    gap: 12,
  },
  extremeItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  extremeDivider: { width: 1, backgroundColor: Colors.border },
  extremeText: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },

  // Chart card
  chartCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 4,
    ...Shadow.card,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  chartLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  chartPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  chartPlaceholderText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  whoSeparator: { height: 1, backgroundColor: Colors.border, marginHorizontal: 12, marginTop: 10 },
  whoLegend: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  whoDash: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  whoDashSegment: { width: 6, height: 1.5, backgroundColor: Colors.whoRed, opacity: 0.7 },
  whoText: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },

  // Forecast card
  forecastCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    ...Shadow.card,
  },
  forecastRow: {
    flexDirection: 'row',
    gap: 10,
  },
  forecastDayCard: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  forecastDayLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  forecastAQIValue: {
    fontSize: 28,
    fontFamily: FontFamily.serifMedium,
    lineHeight: 34,
  },
  forecastAQIUnit: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },
  forecastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    marginTop: 2,
  },
  forecastBadgeText: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },

  // Skeleton placeholders
  skeletonLabel: {
    width: 36,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  skeletonValue: {
    width: 44,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  skeletonBadge: {
    width: 60,
    height: 18,
    borderRadius: Radius.pill,
    backgroundColor: Colors.border,
    marginTop: 4,
  },
  skeletonPollen: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.border,
  },

  // Pollen card
  pollenCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    ...Shadow.card,
  },
  pollenRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pollenBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
  },
  pollenName: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pollenLevel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: 1,
  },

  // Error / retry
  errorText: {
    color: Colors.aqiUnhealthy,
    padding: Spacing.md,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: Spacing.sm,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },

  // BLE status badge
  bleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  bleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bleLabel: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.medium,
  },

  // Obstructed warning banner
  obstructedBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: Radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  obstructedText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    color: '#92400E',
    textAlign: 'center',
  },
})
