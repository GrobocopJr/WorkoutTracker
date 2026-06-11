import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { SCHEMA_SQL } from '../src/db/schema';
import { seedExercisesIfNeeded } from '../src/db/seed';
import {
  getSetting,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
} from '../src/db/queries';
import { useColors, useIsDark } from '../src/theme';
import { useThemeStore } from '../src/store/themeStore';
import { useWorkoutStore } from '../src/store/workoutStore';
import { WorkoutTimerChip } from '../src/components/WorkoutTimerChip';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { ThemeMode } from '../src/store/themeStore';

async function initDb(db: SQLiteDatabase) {
  await db.execAsync(SCHEMA_SQL);
  await migrateDb(db);
  await seedExercisesIfNeeded(db);
}

// Add columns to pre-existing tables (CREATE TABLE IF NOT EXISTS won't alter them).
async function migrateDb(db: SQLiteDatabase) {
  const cols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(routine_exercises)'
  );
  if (!cols.some((col) => col.name === 'target_sets')) {
    await db.execAsync(
      'ALTER TABLE routine_exercises ADD COLUMN target_sets INTEGER NOT NULL DEFAULT 1'
    );
  }

  const sessionCols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(sessions)'
  );
  if (!sessionCols.some((col) => col.name === 'name')) {
    await db.execAsync('ALTER TABLE sessions ADD COLUMN name TEXT');
  }

  const exerciseCols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(exercises)'
  );
  if (!exerciseCols.some((col) => col.name === 'is_custom')) {
    await db.execAsync('ALTER TABLE exercises ADD COLUMN is_custom INTEGER NOT NULL DEFAULT 0');
  }

  const routineCols = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(routines)'
  );
  if (!routineCols.some((col) => col.name === 'position')) {
    await db.execAsync('ALTER TABLE routines ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
    // Seed positions from the existing most-recent-first order.
    const rows = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM routines ORDER BY updated_at DESC'
    );
    for (let i = 0; i < rows.length; i++) {
      await db.runAsync('UPDATE routines SET position = ? WHERE id = ?', [i, rows[i].id]);
    }
  }
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

// Persists the in-progress workout to SQLite so it survives reloads / restarts.
function SessionPersister() {
  const db = useSQLiteContext();
  const sessionId = useWorkoutStore((s) => s.sessionId);
  const routineId = useWorkoutStore((s) => s.routineId);
  const exercises = useWorkoutStore((s) => s.exercises);
  const durationPaused = useWorkoutStore((s) => s.durationPaused);
  const durationPausedMs = useWorkoutStore((s) => s.durationPausedMs);
  const durationPausedAt = useWorkoutStore((s) => s.durationPausedAt);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore any saved in-progress session once on launch.
  useEffect(() => {
    loadActiveSession(db).then(async (saved) => {
      if (saved && useWorkoutStore.getState().sessionId == null) {
        const store = useWorkoutStore.getState();
        store.startSession(saved.sessionId, saved.exercises, saved.routineId ?? null);
        store.setDurationState(
          saved.durationPaused ?? false,
          saved.durationPausedMs ?? 0,
          saved.durationPausedAt ?? null,
        );
        const hasSavedSets = saved.exercises.some((ex) => ex.sets.some((s) => s.saved));
        if (hasSavedSets || (saved.durationPausedMs ?? 0) > 0) {
          store.beginWorkout();
          const row = await db.getFirstAsync<{ started_at: string }>(
            'SELECT started_at FROM sessions WHERE id = ?', [saved.sessionId]
          );
          if (row) {
            store.setWorkoutStartMs(
              new Date(row.started_at.replace(' ', 'T') + 'Z').getTime()
            );
          }
        }
      }
      hydrated.current = true;
    });
  }, [db]);

  // Persist changes (debounced); clear immediately once the session ends.
  useEffect(() => {
    if (!hydrated.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (sessionId == null) {
      void clearActiveSession(db);
      return;
    }
    saveTimer.current = setTimeout(() => {
      void saveActiveSession(db, {
        sessionId, routineId, exercises,
        durationPaused, durationPausedMs, durationPausedAt,
      });
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [sessionId, routineId, exercises, durationPaused, durationPausedMs, durationPausedAt, db]);

  return null;
}

function AppShell() {
  const isDark = useIsDark();
  const c = useColors();

  return (
    <View style={{ flex: 1 }}>
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
        <Stack.Screen
          name="workout/summary"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
      <WorkoutTimerChip />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="workout.db" onInit={initDb}>
      <ThemeLoader />
      <SessionPersister />
      <AppShell />
    </SQLiteProvider>
  );
}
