import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useHealthLogs, HealthLog } from '../../hooks/useHealthLogs'
import { useExposure } from '../../hooks/useExposure'

const SYMPTOMS = [
  'Headache',
  'Eye irritation',
  'Coughing',
  'Shortness of breath',
  'Fatigue',
  'Runny nose',
  'No symptoms',
]

const WELLBEING_EMOJIS = ['😞', '😕', '😐', '🙂', '😄']

function WellbeingSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <View style={styles.wellbeingRow}>
      {WELLBEING_EMOJIS.map((emoji, i) => {
        const score = i + 1
        const selected = value === score
        return (
          <TouchableOpacity
            key={score}
            style={[styles.wellbeingBtn, selected && styles.wellbeingBtnSelected]}
            onPress={() => onChange(score)}
          >
            <Text style={styles.wellbeingEmoji}>{emoji}</Text>
            <Text style={[styles.wellbeingScore, selected && styles.wellbeingScoreSelected]}>
              {score}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function SymptomChips({
  selected,
  onToggle,
}: {
  selected: string[]
  onToggle: (symptom: string) => void
}) {
  return (
    <View style={styles.chipsWrap}>
      {SYMPTOMS.map((s) => {
        const active = selected.includes(s)
        return (
          <TouchableOpacity
            key={s}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(s)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function LogCard({ log }: { log: HealthLog }) {
  const emoji = WELLBEING_EMOJIS[log.wellbeing - 1]
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(log.logged_at)}</Text>
        <Text style={styles.cardEmoji}>{emoji}</Text>
      </View>
      {log.pm2_5_snapshot !== null && (
        <Text style={styles.cardPm}>PM2.5: {log.pm2_5_snapshot} µg/m³</Text>
      )}
      {log.symptoms.length > 0 && (
        <View style={styles.cardChips}>
          {log.symptoms.map((s) => (
            <View key={s} style={styles.cardChip}>
              <Text style={styles.cardChipText}>{s}</Text>
            </View>
          ))}
        </View>
      )}
      {log.notes ? <Text style={styles.cardNotes}>{log.notes}</Text> : null}
    </View>
  )
}

export default function MyHealth() {
  const { logs, loading, error, submitting, submit } = useHealthLogs()
  const { current } = useExposure()

  const [wellbeing, setWellbeing] = useState(3)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)

  function toggleSymptom(s: string) {
    if (s === 'No symptoms') {
      setSymptoms((prev) => (prev.includes('No symptoms') ? [] : ['No symptoms']))
      return
    }
    setSymptoms((prev) => {
      const without = prev.filter((x) => x !== 'No symptoms')
      return without.includes(s) ? without.filter((x) => x !== s) : [...without, s]
    })
  }

  async function handleSubmit() {
    await submit({
      wellbeing,
      symptoms,
      notes,
      pm2_5Snapshot: current?.pm2_5 ?? null,
    })
    setWellbeing(3)
    setSymptoms([])
    setNotes('')
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>My Health</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>How are you feeling?</Text>
        <WellbeingSelector value={wellbeing} onChange={setWellbeing} />

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Symptoms</Text>
        <SymptomChips selected={symptoms} onToggle={toggleSymptom} />

        <TextInput
          style={styles.notesInput}
          placeholder="Notes (optional)"
          placeholderTextColor="#999"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>Logged!</Text> : null}

        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Log Entry</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.historyTitle}>Recent Logs</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#007AFF" />
      ) : logs.length === 0 ? (
        <Text style={styles.emptyText}>No logs yet. Add your first entry above.</Text>
      ) : (
        logs.map((log) => <LogCard key={log.id} log={log} />)
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#1c1c1e', marginBottom: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },

  sectionLabel: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', marginBottom: 12 },

  wellbeingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wellbeingBtn: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 3,
    backgroundColor: '#f2f2f7',
  },
  wellbeingBtnSelected: { backgroundColor: '#007AFF' },
  wellbeingEmoji: { fontSize: 22 },
  wellbeingScore: { fontSize: 13, color: '#555', marginTop: 4 },
  wellbeingScoreSelected: { color: '#fff', fontWeight: '600' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f2f2f7',
  },
  chipActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  chipText: { fontSize: 14, color: '#555' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  notesInput: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1c1c1e',
    minHeight: 72,
    textAlignVertical: 'top',
  },

  errorText: { color: '#FF3B30', fontSize: 14, marginTop: 10 },
  successText: { color: '#34C759', fontSize: 14, fontWeight: '600', marginTop: 10 },

  submitBtn: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  historyTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', marginBottom: 12 },
  emptyText: { color: '#888', fontSize: 15, textAlign: 'center', marginTop: 8 },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardDate: { fontSize: 14, color: '#555', fontWeight: '500' },
  cardEmoji: { fontSize: 22 },
  cardPm: { fontSize: 13, color: '#888', marginBottom: 8 },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  cardChip: {
    backgroundColor: '#e5f0ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardChipText: { fontSize: 13, color: '#007AFF' },
  cardNotes: { fontSize: 14, color: '#444', marginTop: 4 },
})
