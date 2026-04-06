import React from 'react'
import { Text, TextStyle, StyleSheet } from 'react-native'
import { Colors, FontFamily, FontSize } from '../../constants/theme'

type Variant = 'hero' | 'section' | 'title' | 'body' | 'bodySmall' | 'caption' | 'micro'
type Weight = 'regular' | 'medium' | 'bold'
type Color = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success' | 'white'

interface ThemedTextProps {
  children: React.ReactNode
  variant?: Variant
  weight?: Weight
  color?: Color
  style?: TextStyle
  numberOfLines?: number
}

export function ThemedText({
  children,
  variant = 'body',
  weight = 'regular',
  color = 'primary',
  style,
  numberOfLines,
}: ThemedTextProps) {
  return (
    <Text
      style={[styles.base, variantStyles[variant], weightStyles[weight], colorStyles[color], style]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  base: {
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
  },
})

const variantStyles = StyleSheet.create({
  hero: { fontSize: FontSize.hero },
  section: { fontSize: FontSize.section },
  title: { fontSize: FontSize.title },
  body: { fontSize: FontSize.body },
  bodySmall: { fontSize: FontSize.bodySmall },
  caption: { fontSize: FontSize.caption },
  micro: { fontSize: FontSize.micro },
})

const weightStyles = StyleSheet.create({
  regular: { fontFamily: FontFamily.regular },
  medium: { fontFamily: FontFamily.medium },
  bold: { fontFamily: FontFamily.bold },
})

const colorStyles = StyleSheet.create({
  primary: { color: Colors.textPrimary },
  secondary: { color: Colors.textSecondary },
  tertiary: { color: Colors.textTertiary },
  accent: { color: Colors.primary },
  error: { color: Colors.error },
  success: { color: Colors.success },
  white: { color: '#fff' },
})
