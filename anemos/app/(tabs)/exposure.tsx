import { useState } from 'react'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { useExposure } from '../../hooks/useExposure'

const screenWidth = Dimensions.get('window').width

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} days ago`
}

function getAQIStatus(pm25: number): { label: string; color: string; advice: string } {
  if (pm25 <= 12) return {
    label: 'Good',
    color: '#34C759',
    advice: 'Air quality is great — enjoy outdoor activities.',
  }
  if (pm25 <= 35.4) return {
    label: 'Moderate',
    color: '#FFCC00',
    advice: 'Unusually sensitive people should consider limiting prolonged outdoor exertion.',
  }
  if (pm25 <= 55.4) return {
    label: 'Unhealthy for Sensitive Groups',
    color: '#FF9500',
    advice: 'People with respiratory or heart conditions should reduce outdoor activity.',
  }
  if (pm25 <= 150.4) return {
    label: 'Unhealthy',
    color: '#FF3B30',
    advice: 'Everyone may experience health effects. Limit prolonged outdoor exertion.',
  }
  return {
    label: 'Very Unhealthy',
    color: '#8B008B',
    advice: 'Health alert: everyone should avoid outdoor activity.',
  }
}

const METRICS = [
  { key: 'pm1_0' as const, label: 'PM1.0' },
  { key: 'pm2_5' as const, label: 'PM2.5' },
  { key: 'pm10' as const, label: 'PM10' },
]

export default function Exposure() {
  const { current, history, loading, error, refetch } = useExposure()
  const [selectedMetric, setSelectedMetric] = useState<'pm1_0' | 'pm2_5' | 'pm10'>('pm2_5')

  const aqi = current?.pm2_5 != null ? getAQIStatus(current.pm2_5) : null
  const chartData = history.map(d =>
    selectedMetric === 'pm1_0' ? d.avg_pm1_0 :
    selectedMetric === 'pm10' ? d.avg_pm10 :
    d.avg_pm25
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Air Quality</Text>

      {current && aqi && (
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: aqi.color }]}>
            <Text style={styles.badgeText}>{aqi.label}</Text>
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>PM1.0</Text>
              <Text style={styles.metricValue}>
                {current.pm1_0 != null ? current.pm1_0 : '—'}
              </Text>
              <Text style={styles.metricUnit}>µg/m³</Text>
            </View>
            <View style={[styles.metricCol, styles.metricColPrimary]}>
              <Text style={[styles.metricLabel, styles.metricLabelPrimary]}>PM2.5</Text>
              <Text style={[styles.metricValue, styles.metricValuePrimary]}>
                {current.pm2_5 != null ? current.pm2_5 : '—'}
              </Text>
              <Text style={styles.metricUnit}>µg/m³</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricLabel}>PM10</Text>
              <Text style={styles.metricValue}>
                {current.pm10 != null ? current.pm10 : '—'}
              </Text>
              <Text style={styles.metricUnit}>µg/m³</Text>
            </View>
          </View>

          <Text style={styles.advice}>{aqi.advice}</Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardTimestamp}>{relativeTime(current.timestamp)}</Text>
            <Text style={styles.sourceLabel}>Source: Synthetic</Text>
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>7-Day Average</Text>
      <Text style={styles.sectionSubtitle}>Daily averages · WHO guideline: 15 µg/m³</Text>

      <View style={styles.metricToggle}>
        {METRICS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.toggleBtn, selectedMetric === m.key && styles.toggleBtnActive]}
            onPress={() => setSelectedMetric(m.key)}
          >
            <Text style={[styles.toggleBtnText, selectedMetric === m.key && styles.toggleBtnTextActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {history.length > 0 ? (
        <LineChart
          data={{
            labels: history.map(d => d.date.slice(5)),
            datasets: [{ data: chartData }],
          }}
          width={screenWidth - 32}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(80, 80, 80, ${opacity})`,
            propsForBackgroundLines: {
              stroke: '#e0e0e0',
              strokeDasharray: '',
            },
          }}
          bezier
          style={styles.chart}
        />
      ) : (
        <Text style={styles.empty}>No history available</Text>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1c1c1e', marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  metricsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricCol: { flex: 1, alignItems: 'center' },
  metricColPrimary: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#f0f0f0',
  },
  metricLabel: { fontSize: 13, color: '#888', marginBottom: 4 },
  metricLabelPrimary: { fontWeight: '600', color: '#555' },
  metricValue: { fontSize: 26, fontWeight: '700', color: '#1c1c1e' },
  metricValuePrimary: { fontSize: 36 },
  metricUnit: { fontSize: 12, color: '#aaa', marginTop: 2 },

  advice: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 14 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTimestamp: { fontSize: 13, color: '#999' },
  sourceLabel: { fontSize: 13, color: '#bbb' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: '#888', marginBottom: 12 },

  metricToggle: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  toggleBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#e5e5ea', alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#007AFF' },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  toggleBtnTextActive: { color: '#fff' },
  chart: { borderRadius: 12 },
  empty: { color: '#999', fontStyle: 'italic' },

  error: { color: '#FF3B30', padding: 16, fontSize: 15 },
  retryBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
