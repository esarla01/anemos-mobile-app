import { Redirect } from 'expo-router'
import type { Href } from 'expo-router'

export default function Index() {
  return <Redirect href={'/(auth)/sign-in' as Href} />
}
