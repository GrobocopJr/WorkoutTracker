import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SCHEMA_SQL } from '../src/db/schema';
import { seedExercisesIfNeeded } from '../src/db/seed';
import { getSetting } from '../src/db/queries';
import { useColors, useIsDark } from '../src/theme';
import { useThemeStore } from '../src/store/themeStore';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ThemeMode } from '../src/store/themeStore';

async function initDb(db: SQLiteDatabase) {
  await db.execAsync(SCHEMA_SQL);
  await seedExercisesIfNeeded(db);
}

function ThemeLoader() {
  const db = useSQLiteContext();
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    getSetting(db, 'theme').then((t) => {
      if (t === 'light' || t === 'dark' || t === 'system') {
        setTheme(t as ThemeMode);
      }
    });
  }, [db]);

  return null;
}

function AppShell() {
  const isDark = useIsDark();
  const c = useColors();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: c.card },
          headerTintColor: c.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="workout/active"
          options={{ headerShown: true, title: 'Workout', presentation: 'card' }}
        />
        <Stack.Screen
          name="exercises/[id]"
          options={{ headerShown: true, title: 'Exercise', presentation: 'card' }}
        />
        <Stack.Screen
          name="routines/[id]"
          options={{ headerShown: true, title: 'Edit Routine', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="workout.db" onInit={initDb}>
      <ThemeLoader />
      <AppShell />
    </SQLiteProvider>
  );
}
