import React from 'react'
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors, Radius, FontFamily, FontSize, Gradients } from '../../constants/theme'

interface PillButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'ai' | 'outline' | 'danger'
  loading?: boolean
  disabled?: boolean
  style?: ViewStyle
}

export function PillButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}: PillButtonProps) {
  const isGradient = variant === 'primary' || variant === 'ai'
  const gradientColors = variant === 'ai' ? Gradients.aiButton : Gradients.primaryButton
  const opacity = disabled || loading ? 0.5 : 1

  if (isGradient) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[styles.wrapper, { opacity }, style]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.labelLight}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  const solidStyle =
    variant === 'danger'
      ? { backgroundColor: Colors.error }
      : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary }

  const textStyle = variant === 'danger' ? styles.labelLight : styles.labelOutline

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[styles.wrapper, solidStyle, { opacity }, style]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'danger' ? '#fff' : Colors.primary}
          size="small"
        />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: Radius.pill,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.pill,
  },
  labelLight: {
    color: '#fff',
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  labelOutline: {
    color: Colors.primary,
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
})
