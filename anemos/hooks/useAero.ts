import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useSession } from '../context/AuthContext'
import type { AeroConversation, AeroRole, UserProfile } from '../types/database'

const HISTORY_FETCH_LIMIT = 20
const CONTEXT_HISTORY_LIMIT = 10

export interface UseAeroResult {
  messages: AeroConversation[]
  loading: boolean
  sending: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  clearError: () => void
}

async function fetchCurrentPm25(userId: string): Promise<number | null> {
  const { data } = await supabase
    .from('exposure_readings')
    .select('pm2_5')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  return data?.pm2_5 ?? null
}

async function fetchUserProfile(userId: string): Promise<Partial<UserProfile> | null> {
  const { data } = await supabase
    .from('user_profiles')
    .select('age, gender, health_conditions, allergies')
    .eq('user_id', userId)
    .single()
  return data as Partial<UserProfile> | null
}

export function useAero(): UseAeroResult {
  const { session } = useSession()
  const [messages, setMessages] = useState<AeroConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!session) return
    const { data, error: fetchError } = await supabase
      .from('aero_conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true })
      .limit(HISTORY_FETCH_LIMIT)
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setMessages((data ?? []) as AeroConversation[])
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    setError(null)
    fetchHistory().finally(() => setLoading(false))
  }, [session, fetchHistory])

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

      // Fetch context in parallel
      const [pm25, profile] = await Promise.all([
        fetchCurrentPm25(session.user.id),
        fetchUserProfile(session.user.id),
      ])

      // Build context prefix
      const contextParts: string[] = []
      if (pm25 !== null) contextParts.push(`PM2.5=${pm25} µg/m³`)
      if (profile) {
        const profileParts: string[] = []
        if (profile.age) profileParts.push(`Age=${profile.age}`)
        if (profile.gender) profileParts.push(`Gender=${profile.gender}`)
        if (profile.health_conditions?.length)
          profileParts.push(`Conditions=${profile.health_conditions.join(', ')}`)
        if (profile.allergies) profileParts.push(`Allergies=${profile.allergies}`)
        if (profileParts.length) contextParts.push(profileParts.join(', '))
      }
      const contextPrefix = contextParts.length
        ? `[User context: ${contextParts.join(' | ')}]\n\n`
        : ''

      // Build Claude messages array from recent history + new message
      const historySlice = messages.slice(-CONTEXT_HISTORY_LIMIT)
      const claudeMessages = [
        ...historySlice.map(m => ({ role: m.role as AeroRole, content: m.content })),
        { role: 'user' as AeroRole, content: `${contextPrefix}${text.trim()}` },
      ]

      // Call Claude via Supabase Edge Function
      const { data: claudeData, error: fnError } = await supabase.functions.invoke('aero-query', {
        body: { messages: claudeMessages },
      })

      if (fnError) throw new Error(fnError.message)
      const assistantText: string = claudeData?.content?.[0]?.text ?? ''

      // Persist assistant response
      const { data: savedAssistantMsg, error: assistantInsertError } = await supabase
        .from('aero_conversations')
        .insert({ user_id: session.user.id, role: 'assistant', content: assistantText })
        .select()
        .single()
      if (assistantInsertError) throw new Error(assistantInsertError.message)

      setMessages(prev => [...prev, savedAssistantMsg as AeroConversation])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
    } finally {
      setSending(false)
    }
  }, [session, messages, sending])

  const clearError = useCallback(() => setError(null), [])

  return { messages, loading, sending, error, sendMessage, clearError }
}
