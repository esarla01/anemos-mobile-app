import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useSession } from '../context/AuthContext'

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { session, loading } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    SplashScreen.hideAsync()
    if (session) {
      router.replace('/(tabs)/exposure')
    } else {
      router.replace('/(auth)/sign-in')
    }
  }, [session, loading])

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}
