import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native'
import { Link } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { supabase } from '../../utils/supabase'
import { PillButton } from '../../components/ui/PillButton'
import { Colors, FontFamily, FontSize, Radius, Spacing, Gradients } from '../../constants/theme'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSignUp = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      setMessage('Account created! Check your email to confirm, or sign in if confirmations are disabled.')
    }
    setLoading(false)
  }

  return (
    <LinearGradient
      colors={Gradients.heroExposure}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.brandBlock}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>Anemos</Text>
            <Text style={styles.brandTagline}>Join the community.</Text>
          </View>

          <View style={styles.form}>
            {error && <Text style={styles.error}>{error}</Text>}
            {message && <Text style={styles.success}>{message}</Text>}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={Colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <PillButton
              label="Create Account"
              onPress={handleSignUp}
              loading={loading}
              disabled={loading}
              style={styles.button}
            />

            <Link href="/(auth)/sign-in" style={styles.link}>
              Already have an account? <Text style={styles.linkBold}>Sign In</Text>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 12,
  },
  brandName: {
    fontSize: FontSize.hero,
    fontFamily: FontFamily.bold,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    marginBottom: 12,
  },
  success: {
    color: Colors.success,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.inputBackground,
    borderRadius: Radius.md,
    padding: 14,
    marginBottom: 12,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.regular,
    color: Colors.textPrimary,
  },
  button: { marginTop: 4 },
  link: {
    marginTop: Spacing.md,
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.caption,
    fontFamily: FontFamily.regular,
  },
  linkBold: {
    color: Colors.primary,
    fontFamily: FontFamily.bold,
  },
})
