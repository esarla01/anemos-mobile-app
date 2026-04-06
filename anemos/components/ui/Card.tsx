import React from 'react'
import { View, ViewStyle, StyleSheet } from 'react-native'
import { Colors, Radius, Shadow } from '../../constants/theme'

interface CardProps {
  children: React.ReactNode
  style?: ViewStyle
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 16,
    ...Shadow.card,
  },
})
