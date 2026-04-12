import { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, Pressable, FlatList,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useAero } from '../../hooks/useAero'
import type { AeroConversation } from '../../types/database'
import { Colors, FontFamily, FontSize, Radius, Shadow } from '../../constants/theme'

// ─── Timestamp formatting ─────────────────────────────────────────────────────

function formatMessageTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = date.toDateString() === yesterday.toDateString()

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (isToday) return time
  if (isYesterday) return `Yesterday · ${time}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + time
}

// Returns a date-separator label when a message is the first of a new day
function dateSeparator(isoString: string, prevIsoString: string | null): string | null {
  const date = new Date(isoString)
  if (!prevIsoString) return null  // shown as part of first message group instead
  const prev = new Date(prevIsoString)
  if (date.toDateString() === prev.toDateString()) return null
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

// ─── Inline markdown renderer ────────────────────────────────────────────────

function renderInline(line: string, baseKey: string) {
  const tokens = line.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**'))
      return <Text key={`${baseKey}-${i}`} style={s.bold}>{token.slice(2, -2)}</Text>
    if (token.startsWith('*') && token.endsWith('*'))
      return <Text key={`${baseKey}-${i}`} style={s.italic}>{token.slice(1, -1)}</Text>
    return token
  })
}

function MarkdownText({ text, style }: { text: string; style: object }) {
  const lines = text.split('\n')
  return (
    <Text style={style}>
      {lines.map((line, i) => {
        const prefix = i > 0 ? '\n' : ''
        const h2 = line.match(/^##+ (.+)/)
        if (h2) return <Text key={i}>{prefix}<Text style={s.bold}>{h2[1]}</Text></Text>
        const h1 = line.match(/^# (.+)/)
        if (h1) return <Text key={i}>{prefix}<Text style={s.bold}>{h1[1]}</Text></Text>
        return <Text key={i}>{prefix}{renderInline(line, String(i))}</Text>
      })}
    </Text>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, prevMessage }: { message: AeroConversation; prevMessage: AeroConversation | null }) {
  const isUser = message.role === 'user'
  const separator = dateSeparator(message.created_at, prevMessage?.created_at ?? null)

  return (
    <>
      {separator && (
        <View style={s.dateSeparator}>
          <View style={s.dateLine} />
          <Text style={s.dateSeparatorText}>{separator}</Text>
          <View style={s.dateLine} />
        </View>
      )}
      <View style={[s.bubbleRow, isUser ? s.userRow : s.assistantRow]}>
        {!isUser && (
          <View style={s.avatarDot}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={s.avatarLogo}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={s.bubbleStack}>
          {isUser ? (
            <LinearGradient
              colors={['#3A7C7C', '#2E6363']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.bubble, s.userBubble]}
            >
              <Text style={[s.bubbleText, s.userText]}>{message.content}</Text>
            </LinearGradient>
          ) : (
            <View style={[s.bubble, s.assistantBubble]}>
              <MarkdownText text={message.content} style={[s.bubbleText, s.assistantText]} />
            </View>
          )}
          <Text style={[s.timestamp, isUser ? s.timestampUser : s.timestampAssistant]}>
            {formatMessageTime(message.created_at)}
          </Text>
        </View>
      </View>
    </>
  )
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS = [
  "How's my air quality today?",
  'Is it safe to exercise outside?',
  'How has my week been?',
  'When is the best time to go outside?',
]

function SuggestedQuestions({ items, onSelect, visible }: { items: string[]; onSelect: (q: string) => void; visible: boolean }) {
  if (!visible) return null
  return (
    <View style={s.suggestionsContainer}>
      <FlatList
        data={items}
        keyExtractor={item => item}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.suggestionsRow}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [s.suggestionChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={s.suggestionText}>{item}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[s.bubbleRow, s.assistantRow]}>
      <View style={s.avatarDot}>
        <Text style={s.avatarChar}>A</Text>
      </View>
      <View style={[s.bubble, s.assistantBubble, s.typingBubble]}>
        <View style={s.typingDots}>
          <View style={[s.typingDot, s.typingDot1]} />
          <View style={[s.typingDot, s.typingDot2]} />
          <View style={[s.typingDot, s.typingDot3]} />
        </View>
      </View>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AeroChat() {
  const { messages, loading, loadingMore, hasMore, sending, error, suggestions, sendMessage, loadMore, clearError } = useAero()
  const [inputText, setInputText] = useState('')
  const flatListRef = useRef<FlatList<AeroConversation>>(null)

  useFocusEffect(useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50)
  }, []))

  const prevLengthRef = useRef(0)
  useEffect(() => {
    const prev = prevLengthRef.current
    const curr = messages.length
    // Only auto-scroll when new messages are appended (not when older ones are prepended)
    if (curr > prev && messages[curr - 1]?.role !== undefined) {
      const appended = curr - prev
      const wasPrepend = appended > 1 && prev > 0
      if (!wasPrepend) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80)
      }
    }
    prevLengthRef.current = curr
  }, [messages.length])

  const handleSend = async () => {
    const text = inputText.trim()
    if (!text || sending) return
    setInputText('')
    await sendMessage(text)
  }

  const handleSuggestion = async (q: string) => {
    if (sending) return
    await sendMessage(q)
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const canSend = !!inputText.trim() && !sending

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerBrand}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={s.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={s.headerTitle}>Aero</Text>
              <Text style={s.headerSub}>Your air quality assistant</Text>
            </View>
          </View>
          <View style={s.onlineDot} />
        </View>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {error && (
          <View style={s.errorBanner}>
            <Text style={s.errorText} numberOfLines={2}>{error}</Text>
            <Pressable onPress={clearError} style={s.dismissBtn}>
              <Text style={s.dismissText}>Dismiss</Text>
            </Pressable>
          </View>
        )}

        {/* ── Message list ────────────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={item => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble
              message={item}
              prevMessage={index > 0 ? messages[index - 1] : null}
            />
          )}
          contentContainerStyle={s.messageList}
          style={s.flex}
          onScroll={({ nativeEvent }) => {
            if (nativeEvent.contentOffset.y < 60 && hasMore && !loadingMore) {
              loadMore()
            }
          }}
          scrollEventThrottle={200}
          ListHeaderComponent={loadingMore ? (
            <View style={s.loadingMoreRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <View style={s.emptyIconCircle}>
                <Text style={s.emptyIcon}>◎</Text>
              </View>
              <Text style={s.emptyTitle}>Ask Aero anything</Text>
              <Text style={s.emptySubtitle}>
                Your personal air quality assistant. Ask about your exposure, health impact, or what to do when air quality is poor.
              </Text>
            </View>
          }
          ListFooterComponent={sending ? <TypingIndicator /> : null}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        />

        {/* ── Suggested questions ─────────────────────────────────────────── */}
        <SuggestedQuestions
          items={suggestions.length > 0 ? suggestions : DEFAULT_SUGGESTIONS}
          onSelect={handleSuggestion}
          visible={!sending}
        />

        {/* ── Input bar ───────────────────────────────────────────────────── */}
        <View style={s.inputBar}>
          <TextInput
            style={s.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message Aero..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleSend}
          />
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              s.sendBtn,
              !canSend && s.sendBtnDisabled,
              pressed && canSend && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <LinearGradient
              colors={canSend ? ['#3A7C7C', '#2E6363'] : [Colors.surfaceInner, Colors.surfaceInner]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.sendBtnInner}
            >
              <Text style={[s.sendBtnText, !canSend && s.sendBtnTextDisabled]}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerTitle: {
    fontSize: FontSize.section,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.aqiGood,
    borderWidth: 2,
    borderColor: Colors.background,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.aqiUnhealthySoft,
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: Colors.aqiUnhealthy,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
  },
  dismissBtn: { paddingHorizontal: 4 },
  dismissText: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
  },

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dateSeparatorText: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.medium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Bubble rows
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 14,
    gap: 8,
  },
  userRow: { justifyContent: 'flex-end' },
  assistantRow: { justifyContent: 'flex-start' },

  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarLogo: {
    width: 18,
    height: 18,
  },

  bubbleStack: { gap: 4, maxWidth: '78%' },

  bubble: {
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.subtle,
  },

  bubbleText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    lineHeight: 22,
  },
  userText: { color: '#FFFFFF' },
  assistantText: { color: Colors.textPrimary },

  timestamp: {
    fontSize: FontSize.tiny,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
  },
  timestampUser: { textAlign: 'right' },
  timestampAssistant: { textAlign: 'left', paddingLeft: 2 },

  loadingMoreRow: {
    alignItems: 'center',
    paddingVertical: 12,
  },

  // Typing indicator
  typingBubble: { paddingVertical: 12 },
  typingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  typingDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: Colors.primary,
    opacity: 0.4,
  },
  typingDot1: { opacity: 0.8 },
  typingDot2: { opacity: 0.5 },
  typingDot3: { opacity: 0.3 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 64,
    gap: 12,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIcon: { fontSize: 24, color: Colors.primary },
  emptyTitle: {
    fontSize: FontSize.title,
    fontFamily: FontFamily.serifMedium,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceInner,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendBtnDisabled: { opacity: 0.45 },
  sendBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    lineHeight: 24,
  },
  sendBtnTextDisabled: { color: Colors.textTertiary },

  bold: { fontFamily: FontFamily.bold },
  italic: { fontStyle: 'italic' },

  // Suggested questions
  suggestionsContainer: {
    height: 52,
  },
  suggestionsRow: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  suggestionText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
})
