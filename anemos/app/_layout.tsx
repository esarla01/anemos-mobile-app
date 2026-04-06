import { useEffect } from 'react'
import { Stack, useRouter } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useFonts } from 'expo-font'
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans'
import {
  Fraunces_300Light,
  Fraunces_400Regular,
  Fraunces_500Medium,
} from '@expo-google-fonts/fraunces'
import { AuthProvider, useSession } from '../context/AuthContext'

SplashScreen.preventAutoHideAsync()

function RootNavigator() {
  const { session, loading } = useSession()
  const router = useRouter()
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Fraunces_300Light,
    Fraunces_400Regular,
    Fraunces_500Medium,
  })

  useEffect(() => {
    if (loading || !fontsLoaded) return
    SplashScreen.hideAsync()
    if (session) {
      router.replace('/(tabs)/exposure')
    } else {
      router.replace('/(auth)/sign-in')
    }
  }, [session, loading, fontsLoaded])

  return <Stack screenOptions={{ headerShown: false }} />
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}
