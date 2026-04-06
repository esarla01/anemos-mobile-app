import { useEffect, useState } from 'react'
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  ActivityIndicator, Pressable, Image, FlatList,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../utils/supabase'
import { useSession } from '../../context/AuthContext'
import type { UserProfile, Gender } from '../../types/database'
import { Colors, FontFamily, FontSize, Radius, Shadow } from '../../constants/theme'

// ─── Preset options ───────────────────────────────────────────────────────────

const ALLERGY_PRESETS = [
  'Pollen', 'Dust mites', 'Pet dander', 'Mould',
  'Grass', 'Tree pollen', 'Ragweed', 'Latex',
]

const CONDITION_PRESETS = [
  'Asthma', 'Hay fever', 'COPD', 'Rhinitis',
  'Eczema', 'Heart disease', 'Diabetes', 'Sleep apnea',
]

const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitCustom(allItems: string[], presets: string[]): { selected: string[]; custom: string } {
  const presetLower = presets.map(p => p.toLowerCase())
  const selected: string[] = []
  const custom: string[] = []
  for (const item of allItems) {
    if (presetLower.includes(item.toLowerCase())) {
      selected.push(presets[presetLower.indexOf(item.toLowerCase())])
    } else {
      custom.push(item)
    }
  }
  return { selected, custom: custom.join(', ') }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={s.fieldLabel}>{children}</Text>
}

function ChipScroll({ presets, selected, onToggle }: { presets: string[]; selected: string[]; onToggle: (item: string) => void }) {
  return (
    <FlatList
      data={presets}
      keyExtractor={item => item}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipScroll}
      renderItem={({ item }) => {
        const active = selected.includes(item)
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

function GenderPicker({ value, onChange }: { value: string; onChange: (v: Gender) => void }) {
  return (
    <FlatList
      data={GENDER_OPTIONS}
      keyExtractor={opt => opt.key}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.chipScroll}
      renderItem={({ item: opt }) => {
        const active = value === opt.key
        return (
          <Pressable
            onPress={() => onChange(opt.key)}
            style={({ pressed }) => [
              s.chip,
              active && s.chipActive,
              pressed && { transform: [{ scale: 0.96 }] },
            ]}
          >
            {active && <View style={s.chipDot} />}
            <Text style={[s.chipText, active && s.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        )
      }}
    />
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Profile() {
  const { session, signOut } = useSession()

  const [age, setAge] = useState('')
  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState('')
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([])
  const [otherAllergies, setOtherAllergies] = useState('')
  const [selectedConditions, setSelectedConditions] = useState<string[]>([])
  const [otherConditions, setOtherConditions] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!session) return
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error && error.code !== 'PGRST116') {
          setError(error.message)
        } else if (data) {
          const profile = data as UserProfile
          setAge(profile.age?.toString() ?? '')
          setWeight(profile.weight?.toString() ?? '')
          setGender(profile.gender ?? '')
          if (profile.allergies) {
            const parts = profile.allergies.split(',').map(s => s.trim()).filter(Boolean)
            const { selected, custom } = splitCustom(parts, ALLERGY_PRESETS)
            setSelectedAllergies(selected)
            setOtherAllergies(custom)
          }
          if (Array.isArray(profile.health_conditions) && profile.health_conditions.length > 0) {
            const { selected, custom } = splitCustom(profile.health_conditions, CONDITION_PRESETS)
            setSelectedConditions(selected)
            setOtherConditions(custom)
          }
        }
        setLoading(false)
      })
  }, [session])

  const handleSave = async () => {
    if (!session) return
    const ageNum = age ? parseInt(age, 10) : null
    if (ageNum !== null && ageNum <= 0) { setError('Age must be greater than 0'); return }
    setSaving(true); setError(null); setSaved(false)

    const allergyParts = [...selectedAllergies, ...otherAllergies.split(',').map(s => s.trim()).filter(Boolean)]
    const conditionParts = [...selectedConditions, ...otherConditions.split(',').map(s => s.trim()).filter(Boolean)]

    const { error } = await supabase.from('user_profiles').upsert({
      user_id: session.user.id,
      age: ageNum,
      weight: weight ? parseFloat(weight) : null,
      gender: gender || null,
      allergies: allergyParts.length > 0 ? allergyParts.join(', ') : null,
      health_conditions: conditionParts,
    })

    if (error) setError(error.message)
    else setSaved(true)
    setSaving(false)
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.root}>
      <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Text style={s.pageTitle}>Profile</Text>

        {/* Account card */}
        <View style={s.accountCard}>
          <Image source={require('../../assets/images/logo.png')} style={s.accountLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={s.accountLabel}>Signed in as</Text>
            <Text style={s.accountEmail} numberOfLines={1}>{session?.user.email}</Text>
          </View>
          {saved && (
            <View style={s.savedBadge}>
              <Text style={s.savedText}>Saved</Text>
            </View>
          )}
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        {/* ── About You ────────────────────────────────────────────────────── */}
        <SectionLabel>About You</SectionLabel>
        <View style={s.card}>
          <View style={s.inlineRow}>
            <View style={s.inlineField}>
              <FieldLabel>Age</FieldLabel>
              <TextInput
                style={s.input}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="—"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
            <View style={s.inlineDivider} />
            <View style={s.inlineField}>
              <FieldLabel>Weight (kg)</FieldLabel>
              <TextInput
                style={s.input}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={Colors.textTertiary}
              />
            </View>
          </View>

          <View style={s.divider} />

          <FieldLabel>Gender</FieldLabel>
          <GenderPicker value={gender} onChange={v => setGender(v)} />
        </View>

        {/* ── Allergies ────────────────────────────────────────────────────── */}
        <SectionLabel>Allergies</SectionLabel>
        <View style={s.card}>
          <FieldLabel>Common triggers</FieldLabel>
          <ChipScroll
            presets={ALLERGY_PRESETS}
            selected={selectedAllergies}
            onToggle={item => setSelectedAllergies(prev => prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item])}
          />
          <FieldLabel>Other</FieldLabel>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={otherAllergies}
            onChangeText={setOtherAllergies}
            placeholder="Any other allergies, comma-separated"
            placeholderTextColor={Colors.textTertiary}
            multiline
          />
        </View>

        {/* ── Health Conditions ─────────────────────────────────────────────── */}
        <SectionLabel>Health Conditions</SectionLabel>
        <View style={s.card}>
          <FieldLabel>Common conditions</FieldLabel>
          <ChipScroll
            presets={CONDITION_PRESETS}
            selected={selectedConditions}
            onToggle={item => setSelectedConditions(prev => prev.includes(item) ? prev.filter(c => c !== item) : [...prev, item])}
          />
          <FieldLabel>Other</FieldLabel>
          <TextInput
            style={[s.input, s.inputMultiline]}
            value={otherConditions}
            onChangeText={setOtherConditions}
            placeholder="Any other conditions, comma-separated"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="none"
            multiline
          />
        </View>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <View style={s.actions}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [s.saveBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient
              colors={['#3A7C7C', '#2E6363']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.saveBtnInner}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.saveBtnText}>Save Profile</Text>
              }
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={signOut}
            style={({ pressed }) => [s.signOutBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.signOutText}>Sign Out</Text>
          </Pressable>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  container: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 100 },

  pageTitle: {
    fontSize: FontSize.section,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
    marginBottom: 14,
  },

  // Account card
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
    ...Shadow.card,
  },
  accountLogo: { width: 30, height: 30 },
  accountLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  accountEmail: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: Colors.textPrimary,
  },
  savedBadge: {
    backgroundColor: Colors.aqiGoodSoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  savedText: {
    color: Colors.aqiGood,
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.bold,
  },

  errorText: {
    color: Colors.aqiUnhealthy,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    marginBottom: 10,
  },

  sectionLabel: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 2,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 12,
    marginBottom: 16,
    ...Shadow.card,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },

  // Age + weight side by side
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  inlineField: { flex: 1 },
  inlineDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
    marginTop: 28,
    height: 36,
  },

  fieldLabel: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 2,
  },

  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
  },
  inputMultiline: {
    minHeight: 52,
    textAlignVertical: 'top',
  },

  // Chip scroll
  chipScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
  },
  chipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  chipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  chipText: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, color: Colors.textSecondary },
  chipTextActive: { color: Colors.primary, fontFamily: FontFamily.bold },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtn: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
    flex: 1,
  },
  saveBtnInner: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  signOutBtn: {
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    color: Colors.textTertiary,
  },
})
