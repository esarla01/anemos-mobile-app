import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { supabase } from '../../utils/supabase'
import { useSession } from '../../context/AuthContext'
import type { UserProfile } from '../../types/database'

type FormState = {
  age: string
  weight: string
  gender: string
  allergies: string
  health_conditions: string
}

export default function Profile() {
  const { session, signOut } = useSession()
  const [form, setForm] = useState<FormState>({
    age: '',
    weight: '',
    gender: '',
    allergies: '',
    health_conditions: '',
  })
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
          setForm({
            age: profile.age?.toString() ?? '',
            weight: profile.weight?.toString() ?? '',
            gender: profile.gender ?? '',
            allergies: profile.allergies ?? '',
            health_conditions: Array.isArray(profile.health_conditions)
              ? profile.health_conditions.join(', ')
              : '',
          })
        }
        setLoading(false)
      })
  }, [session])

  const handleSave = async () => {
    if (!session) return
    const ageNum = form.age ? parseInt(form.age, 10) : null
    if (ageNum !== null && ageNum <= 0) {
      setError('Age must be greater than 0')
      return
    }
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error } = await supabase.from('user_profiles').upsert({
      user_id: session.user.id,
      age: form.age ? parseInt(form.age, 10) : null,
      weight: form.weight ? parseFloat(form.weight) : null,
      gender: form.gender || null,
      allergies: form.allergies || null,
      health_conditions: form.health_conditions
        ? form.health_conditions.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    })

    if (error) {
      setError(error.message)
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {saved && <Text style={styles.success}>Saved!</Text>}

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        value={form.age}
        onChangeText={(v) => setForm((f) => ({ ...f, age: v }))}
        keyboardType="numeric"
        placeholder="Age"
      />

      <Text style={styles.label}>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        value={form.weight}
        onChangeText={(v) => setForm((f) => ({ ...f, weight: v }))}
        keyboardType="decimal-pad"
        placeholder="Weight"
      />

      <Text style={styles.label}>Gender</Text>
      <TextInput
        style={styles.input}
        value={form.gender}
        onChangeText={(v) => setForm((f) => ({ ...f, gender: v }))}
        placeholder="e.g. male, female, non_binary"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Allergies</Text>
      <TextInput
        style={styles.input}
        value={form.allergies}
        onChangeText={(v) => setForm((f) => ({ ...f, allergies: v }))}
        placeholder="Describe any allergies"
        multiline
      />

      <Text style={styles.label}>Health Conditions (comma-separated)</Text>
      <TextInput
        style={styles.input}
        value={form.health_conditions}
        onChangeText={(v) => setForm((f) => ({ ...f, health_conditions: v }))}
        placeholder="e.g. asthma, hay_fever"
        autoCapitalize="none"
        multiline
      />

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  label: { fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, marginBottom: 16 },
  error: { color: 'red', marginBottom: 12 },
  success: { color: 'green', marginBottom: 12 },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: { backgroundColor: '#b0c8f7' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  signOutButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FF3B30',
    marginBottom: 12,
  },
  signOutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
