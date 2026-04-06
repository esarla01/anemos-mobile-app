import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, Shadow } from '../../constants/theme'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          height: 84,
          paddingBottom: 28,
          paddingTop: 8,
          ...Shadow.card,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="exposure"
        options={{
          title: 'Exposure',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'partly-sunny' : 'partly-sunny-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-health"
        options={{
          title: 'My Health',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="aero-chat"
        options={{
          title: 'Aero',
          tabBarActiveTintColor: Colors.aiAccent,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
