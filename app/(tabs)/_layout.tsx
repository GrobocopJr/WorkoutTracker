import { TouchableOpacity } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors, useIsDark } from '../../src/theme';

function ChartHeaderButton({ color }: { color: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/charts' as any)}
      style={{ marginRight: 16 }}
      hitSlop={8}
    >
      <Ionicons name="stats-chart-outline" size={22} color={color} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const isDark = useIsDark();
  const c = useColors();
  const headerBg = isDark ? c.card : c.accent;
  const headerFg = isDark ? c.text : '#fff';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.borderLight },
        headerStyle: { backgroundColor: headerBg },
        headerTintColor: headerFg,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
          headerRight: () => <ChartHeaderButton color={headerFg} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
