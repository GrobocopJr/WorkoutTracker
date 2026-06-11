import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWorkoutStore } from '../store/workoutStore';
import { useColors } from '../theme';
import type { Colors } from '../theme';

const TAB_BAR_HEIGHT = 56;
const TAB_PATHS = new Set(['/', '/exercises', '/history', '/settings']);

function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function WorkoutTimerChip() {
  const router = useRouter();
  const pathname = usePathname();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const workoutStarted = useWorkoutStore((s) => s.workoutStarted);
  const sessionId = useWorkoutStore((s) => s.sessionId);
  const workoutStartMs = useWorkoutStore((s) => s.workoutStartMs);
  const durationPaused = useWorkoutStore((s) => s.durationPaused);
  const durationPausedMs = useWorkoutStore((s) => s.durationPausedMs);
  const durationPausedAt = useWorkoutStore((s) => s.durationPausedAt);

  const [, setTick] = useState(0);

  useEffect(() => {
    if (!workoutStarted || durationPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [workoutStarted, durationPaused]);

  const isOnActiveWorkout = pathname === '/workout/active';
  if (!workoutStarted || !sessionId || isOnActiveWorkout) return null;

  const isTabScreen = TAB_PATHS.has(pathname);
  const bottomOffset = isTabScreen
    ? TAB_BAR_HEIGHT + bottomInset + 8
    : Math.max(bottomInset + 8, 20);

  const elapsedSeconds = workoutStartMs
    ? durationPaused && durationPausedAt != null
      ? Math.max(0, Math.floor((durationPausedAt - workoutStartMs - durationPausedMs) / 1000))
      : Math.max(0, Math.floor((Date.now() - workoutStartMs - durationPausedMs) / 1000))
    : 0;

  return (
    <TouchableOpacity
      style={[styles.chip, { bottom: bottomOffset }]}
      onPress={() => router.push('/workout/active')}
      activeOpacity={0.85}
    >
      <View style={[styles.dot, durationPaused && styles.dotPaused]} />
      <Ionicons
        name={durationPaused ? 'pause-circle-outline' : 'time-outline'}
        size={16}
        color="#fff"
      />
      <Text style={styles.time}>{formatElapsed(elapsedSeconds)}</Text>
      <Text style={styles.label}>{durationPaused ? 'Paused' : 'In Progress'}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
    </TouchableOpacity>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    chip: {
      position: 'absolute',
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: '#1a1a2e',
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      elevation: 8,
      shadowColor: '#000',
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 3 },
      shadowRadius: 8,
      zIndex: 999,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#22C55E',
    },
    dotPaused: {
      backgroundColor: '#EAB308',
    },
    time: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.5,
      minWidth: 44,
    },
    label: {
      flex: 1,
      color: 'rgba(255,255,255,0.65)',
      fontSize: 13,
    },
  });
}
