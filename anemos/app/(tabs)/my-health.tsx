import { useState } from 'react'
import {
  View, Text, ScrollView, TextInput,
  Pressable, ActivityIndicator, StyleSheet, FlatList,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useHealthLogs } from '../../hooks/useHealthLogs'
import type { HealthLog } from '../../hooks/useHealthLogs'
import { useExposure } from '../../hooks/useExposure'
import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '../../constants/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMPTOMS = [
  'Headache', 'Eye irritation', 'Coughing',
  'Shortness of breath', 'Fatigue', 'Runny nose', 'No symptoms',
]

const ACTIVITIES = [
  'Resting', 'Working', 'Walking', 'Running',
  'Cycling', 'Commuting', 'Cooking', 'Sleeping',
]

const WELLBEING: { score: number; emoji: string; label: string }[] = [
  { score: 1, emoji: '😞', label: 'Poor' },
  { score: 2, emoji: '😕', label: 'Low' },
  { score: 3, emoji: '😐', label: 'OK' },
  { score: 4, emoji: '🙂', label: 'Good' },
  { score: 5, emoji: '😄', label: 'Great' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLogDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (isToday) return `Today · ${time}`
  if (isYesterday) return `Yesterday · ${time}`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ` · ${time}`
}

function wellbeingColor(score: number): string {
  if (score <= 1) return Colors.aqiUnhealthy
  if (score <= 2) return Colors.aqiSensitive
  if (score <= 3) return Colors.aqiModerate
  return Colors.aqiGood
}

function wellbeingSoftColor(score: number): string {
  if (score <= 1) return Colors.aqiUnhealthySoft
  if (score <= 2) return Colors.aqiSensitiveSoft
  if (score <= 3) return Colors.aqiModerateSoft
  return Colors.aqiGoodSoft
}

// ─── Wellbeing selector ───────────────────────────────────────────────────────

function WellbeingSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.wellbeingRow}>
      {WELLBEING.map(({ score, emoji, label }) => {
        const active = value === score
        return (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            style={({ pressed }) => [
              s.wellbeingBtn,
              active && { backgroundColor: wellbeingSoftColor(score), borderColor: wellbeingColor(score) },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={s.wellbeingEmoji}>{emoji}</Text>
            <Text style={[s.wellbeingLabel, active && { color: wellbeingColor(score), fontFamily: FontFamily.bold }]}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Symptom chips ────────────────────────────────────────────────────────────

function ChipScroll({
  items,
  selected,
  multi = true,
  onToggle,
}: {
  items: string[]
  selected: string | string[]
  multi?: boolean
  onToggle: (item: string) => void
}) {
  const isActive = (item: string) =>
    multi ? (selected as string[]).includes(item) : selected === item

  return (
    <FlatList
      data={items}
      keyExtractor={item => item}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipScroll}
      renderItem={({ item }) => {
        const active = isActive(item)
        return (
          <Pressable
            onPress={() => onToggle(item)}
            style={({ pressed }) => [
              s.chip,
              active && s.chipActive,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
          >
            {active && <View style={s.chipDot} />}
            <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
          </Pressable>
        )
      }}
    />
  )
}

function SymptomChips({ selected, onToggle }: { selected: string[]; onToggle: (s: string) => void }) {
  return <ChipScroll items={SYMPTOMS} selected={selected} multi onToggle={onToggle} />
}

// ─── Today counter ────────────────────────────────────────────────────────────

function TodayCounter({ logs }: { logs: HealthLog[] }) {
  const todayStr = new Date().toDateString()
  const count = logs.filter(l => new Date(l.logged_at).toDateString() === todayStr).length
  const goal = 5
  const filled = Math.min(count, goal)

  const color = count === 0 ? Colors.textTertiary
    : count < 3 ? Colors.aqiModerate
    : Colors.aqiGood

  return (
    <View style={s.todayCounter}>
      <View style={s.todayDots}>
        {Array.from({ length: goal }).map((_, i) => (
          <View
            key={i}
            style={[s.todayDot, i < filled ? { backgroundColor: color } : { backgroundColor: Colors.border }]}
          />
        ))}
      </View>
      <Text style={[s.todayLabel, { color }]}>
        {count === 0 ? 'Log today' : `${count} today`}
      </Text>
    </View>
  )
}

// ─── Log card ─────────────────────────────────────────────────────────────────

function LogCard({ log }: { log: HealthLog }) {
  const wb = WELLBEING[log.wellbeing - 1]
  const color = wellbeingColor(log.wellbeing)
  const softColor = wellbeingSoftColor(log.wellbeing)

  return (
    <View style={[s.logCard, { borderLeftColor: color }]}>
      {/* ── Single compact row ────────────────────────────────────────────── */}
      <View style={s.logCardHeader}>
        <View style={[s.logWellbeingCircle, { backgroundColor: softColor }]}>
          <Text style={s.logWellbeingEmoji}>{wb?.emoji}</Text>
        </View>
        <View style={s.logCardMid}>
          <View style={s.logCardTopLine}>
            <Text style={[s.logWellbeingTitle, { color }]}>{wb?.label}</Text>
            {log.activity ? (
              <View style={s.logActivityPill}>
                <Text style={s.logActivityPillText}>{log.activity}</Text>
              </View>
            ) : null}
          </View>
          <Text style={s.logCardDate}>{formatLogDate(log.logged_at)}</Text>
          {/* Symptoms chips (compact, wrapping) */}
          {log.symptoms.length > 0 && (
            <View style={s.logChips}>
              {log.symptoms.map(sym => (
                <View key={sym} style={s.logChip}>
                  <Text style={s.logChipText}>{sym}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Freetext notes (symptoms_notes + notes collapsed into one) */}
          {(log.symptoms_notes || log.notes) ? (
            <Text style={s.logNotes} numberOfLines={2}>
              {[log.symptoms_notes, log.notes].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {/* PM2.5 badge */}
        {log.pm2_5_snapshot !== null && (
          <View style={s.logPmBadge}>
            <Text style={s.logPmValue}>{log.pm2_5_snapshot}</Text>
            <Text style={s.logPmUnit}>μg/m³</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MyHealth() {
  const { logs, loading, error, submitting, submit } = useHealthLogs()
  const { current } = useExposure()

  const [wellbeing, setWellbeing] = useState(3)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [symptomsNotes, setSymptomsNotes] = useState('')
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const [page, setPage] = useState(0)

  const PAGE_SIZE = 3
  const totalPages = Math.ceil(logs.length / PAGE_SIZE)
  const pagedLogs = logs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function toggleSymptom(sym: string) {
    if (sym === 'No symptoms') {
      setSymptoms(prev => prev.includes('No symptoms') ? [] : ['No symptoms'])
      return
    }
    setSymptoms(prev => {
      const without = prev.filter(x => x !== 'No symptoms')
      return without.includes(sym) ? without.filter(x => x !== sym) : [...without, sym]
    })
  }

  async function handleSubmit() {
    await submit({ wellbeing, symptoms, symptomsNotes, activity, notes, pm2_5Snapshot: current?.pm2_5 ?? null })
    setWellbeing(3)
    setSymptoms([])
    setSymptomsNotes('')
    setActivity('')
    setNotes('')
    setPage(0)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 2500)
  }

  const canSubmit = !submitting

  return (
    <View style={s.root}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.pageHeader}>
          <Text style={s.pageTitle}>My Health</Text>
          <TodayCounter logs={logs} />
        </View>

        {/* ── Log entry card ───────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>How are you feeling?</Text>
        <View style={s.card}>
          <Text style={s.fieldLabel}>Wellbeing</Text>
          <WellbeingSelector value={wellbeing} onChange={setWellbeing} />

          <View style={s.divider} />

          <Text style={s.fieldLabel}>Symptoms</Text>
          <SymptomChips selected={symptoms} onToggle={toggleSymptom} />
          <TextInput
            style={[s.notesInput, { marginTop: 8, minHeight: 44 }]}
            placeholder="Describe your symptoms..."
            placeholderTextColor={Colors.textTertiary}
            value={symptomsNotes}
            onChangeText={setSymptomsNotes}
            multiline
          />

          <View style={s.divider} />

          <Text style={s.fieldLabel}>Current Activity</Text>
          <ChipScroll
            items={ACTIVITIES}
            selected={activity}
            multi={false}
            onToggle={act => setActivity(prev => prev === act ? '' : act)}
          />
          <TextInput
            style={[s.notesInput, { marginTop: 8, minHeight: 36 }]}
            placeholder="Or describe your activity..."
            placeholderTextColor={Colors.textTertiary}
            value={ACTIVITIES.includes(activity) ? '' : activity}
            onChangeText={v => setActivity(v)}
            onFocus={() => { if (ACTIVITIES.includes(activity)) setActivity('') }}
          />

          <View style={s.divider} />

          <Text style={s.fieldLabel}>Notes</Text>
          <TextInput
            style={[s.notesInput, { minHeight: 44 }]}
            placeholder="Anything else worth noting..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {error ? (
            <View style={s.errorBadge}>
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          {success ? (
            <View style={s.successBadge}>
              <Text style={s.successText}>Entry logged</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={['#3A7C7C', '#2E6363']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.submitBtnInner}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.submitBtnText}>Log Entry</Text>
              }
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Recent logs ──────────────────────────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent Logs</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={Colors.primary} />
        ) : logs.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyTitle}>No entries yet</Text>
            <Text style={s.emptySubtitle}>Log your first entry above to start tracking how air quality affects you.</Text>
          </View>
        ) : (
          <>
            {pagedLogs.map(log => <LogCard key={log.id} log={log} />)}
            {totalPages > 1 && (
              <View style={s.pagination}>
                <Pressable
                  onPress={() => setPage(p => p - 1)}
                  disabled={page === 0}
                  style={({ pressed }) => [s.pageBtn, page === 0 && s.pageBtnDisabled, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.pageBtnText, page === 0 && s.pageBtnTextDisabled]}>← Newer</Text>
                </Pressable>
                <Text style={s.pageIndicator}>{page + 1} / {totalPages}</Text>
                <Pressable
                  onPress={() => setPage(p => p + 1)}
                  disabled={page >= totalPages - 1}
                  style={({ pressed }) => [s.pageBtn, page >= totalPages - 1 && s.pageBtnDisabled, pressed && { opacity: 0.7 }]}
                >
                  <Text style={[s.pageBtnText, page >= totalPages - 1 && s.pageBtnTextDisabled]}>Older →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100 },

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  todayCounter: {
    alignItems: 'flex-end',
    gap: 4,
  },
  todayDots: {
    flexDirection: 'row',
    gap: 4,
  },
  todayDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  todayLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  pageTitle: {
    fontSize: FontSize.section,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
  },

  sectionHeader: { marginBottom: 12 },
  sectionTitle: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
    marginBottom: 10,
  },

  fieldLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 20,
    ...Shadow.card,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },

  // Wellbeing selector
  wellbeingRow: { flexDirection: 'row', gap: 6 },
  wellbeingBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
    gap: 2,
  },
  wellbeingEmoji: { fontSize: 18 },
  wellbeingLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
  },

  // Chip scroll list
  chipScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingHorizontal: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  chipText: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  // Notes input
  notesInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
    minHeight: 44,
    textAlignVertical: 'top',
  },

  // Feedback badges
  errorBadge: {
    marginTop: 12,
    backgroundColor: Colors.aqiUnhealthySoft,
    borderRadius: Radius.md,
    padding: 10,
  },
  errorText: {
    color: Colors.aqiUnhealthy,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
  },
  successBadge: {
    marginTop: 12,
    backgroundColor: Colors.aqiGoodSoft,
    borderRadius: Radius.md,
    padding: 10,
  },
  successText: {
    color: Colors.aqiGood,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },

  // Submit button
  submitBtn: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
    marginTop: 10,
    alignSelf: 'flex-end',
  },
  submitBtnInner: {
    height: 36,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },

  // Log cards
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    ...Shadow.card,
  },
  logCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  logWellbeingCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logWellbeingEmoji: { fontSize: 16 },
  logCardMid: { flex: 1, gap: 3 },
  logCardTopLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logWellbeingTitle: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  logActivityPill: {
    backgroundColor: Colors.surfaceInner,
    borderRadius: Radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logActivityPillText: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
  },
  logCardDate: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },
  logChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  logChip: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  logChipText: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  logNotes: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
  logPmBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logPmValue: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
  },
  logPmUnit: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 4,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.subtle,
  },
  pageBtnDisabled: {
    opacity: 0.3,
  },
  pageBtnText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
  pageBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  pageIndicator: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
})
