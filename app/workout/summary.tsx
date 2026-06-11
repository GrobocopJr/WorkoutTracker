import { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { saveSessionNote } from '../../src/db/queries';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';

interface SetRow {
  id: number;
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight: number;
  reps: number;
}

interface ExerciseSummary {
  exercise_id: string;
  exercise_name: string;
  sets: SetRow[];
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkoutSummary() {
  const { sessionId, durationSecs: durationParam } = useLocalSearchParams<{
    sessionId: string;
    durationSecs: string;
  }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c, topInset, bottomInset), [c, topInset, bottomInset]);

  const [loading, setLoading] = useState(true);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [dateLabel, setDateLabel] = useState('');
  const [units, setUnits] = useState('lbs');
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [prSetIds, setPrSetIds] = useState<Set<number>>(new Set());
  const [totalVolume, setTotalVolume] = useState(0);
  const [durationSecs, setDurationSecs] = useState(parseInt(durationParam ?? '0', 10));
  const [sessionNote, setSessionNote] = useState('');
  const saveNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canGoBack = router.canGoBack();

  useEffect(() => {
    return () => { if (saveNoteTimerRef.current) clearTimeout(saveNoteTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const sid = parseInt(sessionId, 10);

    async function load() {
      const unitRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM settings WHERE key = 'units'"
      );
      const u = unitRow?.value ?? 'lbs';
      setUnits(u);

      const session = await db.getFirstAsync<{
        date: string;
        routine_id: number | null;
        notes: string | null;
        started_at: string;
        ended_at: string | null;
      }>('SELECT date, routine_id, notes, started_at, ended_at FROM sessions WHERE id = ?', [sid]);

      if (!session) { setLoading(false); return; }

      setDateLabel(formatDate(session.date));
      setSessionNote(session.notes ?? '');

      // Compute duration from timestamps when not passed as a param (e.g. navigating from history).
      const paramDuration = parseInt(durationParam ?? '0', 10);
      if (paramDuration === 0 && session.started_at && session.ended_at) {
        const start = new Date(session.started_at.replace(' ', 'T') + 'Z');
        const end = new Date(session.ended_at.replace(' ', 'T') + 'Z');
        setDurationSecs(Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000)));
      }

      if (session.routine_id) {
        const routine = await db.getFirstAsync<{ name: string }>(
          'SELECT name FROM routines WHERE id = ?',
          [session.routine_id]
        );
        setRoutineName(routine?.name ?? null);
      }

      const rows = await db.getAllAsync<{
        id: number;
        exercise_id: string;
        exercise_name: string | null;
        set_number: number;
        weight: number;
        reps: number;
      }>(
        `SELECT s.id, s.exercise_id, e.name AS exercise_name,
                s.set_number, s.weight, s.reps
         FROM sets s
         LEFT JOIN exercises e ON s.exercise_id = e.id
         WHERE s.session_id = ?
         ORDER BY s.id ASC`,
        [sid]
      );

      const exMap = new Map<string, ExerciseSummary>();
      let volume = 0;
      for (const row of rows) {
        if (!exMap.has(row.exercise_id)) {
          exMap.set(row.exercise_id, {
            exercise_id: row.exercise_id,
            exercise_name: row.exercise_name ?? row.exercise_id,
            sets: [],
          });
        }
        exMap.get(row.exercise_id)!.sets.push({
          id: row.id,
          exercise_id: row.exercise_id,
          exercise_name: row.exercise_name ?? row.exercise_id,
          set_number: row.set_number,
          weight: row.weight,
          reps: row.reps,
        });
        volume += row.weight * row.reps;
      }
      setExercises(Array.from(exMap.values()));
      setTotalVolume(Math.round(volume));

      const exerciseIds = Array.from(exMap.keys());
      if (exerciseIds.length > 0) {
        const placeholders = exerciseIds.map(() => '?').join(',');
        const prevBests = await db.getAllAsync<{ exercise_id: string; best_1rm: number }>(
          `SELECT exercise_id, MAX(weight * (1.0 + reps / 30.0)) AS best_1rm
           FROM sets
           WHERE session_id != ? AND exercise_id IN (${placeholders})
           GROUP BY exercise_id`,
          [sid, ...exerciseIds]
        );
        const prevBestMap = new Map(prevBests.map((r) => [r.exercise_id, r.best_1rm]));

        const prIds = new Set<number>();
        for (const ex of exMap.values()) {
          let runningBest = prevBestMap.get(ex.exercise_id) ?? 0;
          for (const s of ex.sets) {
            const rm = s.weight * (1 + s.reps / 30);
            if (rm > runningBest) {
              prIds.add(s.id);
              runningBest = rm;
            }
          }
        }
        setPrSetIds(prIds);
      }

      setLoading(false);
    }

    load();
  }, [sessionId, db]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Remove all logged sets and delete this workout from history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const sid = parseInt(sessionId ?? '0', 10);
            if (sid) {
              await db.runAsync('DELETE FROM sets WHERE session_id = ?', [sid]);
              await db.runAsync('DELETE FROM sessions WHERE id = ?', [sid]);
            }
            router.replace('/(tabs)/history');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const prCount = prSetIds.size;
  const volumeLabel = totalVolume.toLocaleString();
  const sid = parseInt(sessionId ?? '0', 10);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {canGoBack && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
        <Ionicons name="trash-outline" size={22} color={c.danger} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.trophy}>
            <Ionicons name="trophy" size={32} color="#F59E0B" />
          </View>
          <Text style={styles.completedLabel}>Workout Complete!</Text>
          <Text style={styles.routineName}>
            {routineName ?? 'Ad-hoc Workout'}
          </Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={20} color={c.accent} />
            <Text style={styles.statValue}>{formatDuration(durationSecs)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={[styles.statCard, styles.statCardMiddle]}>
            <Ionicons name="barbell-outline" size={20} color={c.accent} />
            <Text style={styles.statValue}>{volumeLabel}</Text>
            <Text style={styles.statLabel}>Volume ({units})</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy-outline" size={20} color={prCount > 0 ? '#F59E0B' : c.muted} />
            <Text style={[styles.statValue, prCount > 0 && styles.prValue]}>{prCount}</Text>
            <Text style={styles.statLabel}>PR Sets</Text>
          </View>
        </View>

        {/* Exercise list */}
        <Text style={styles.sectionTitle}>Exercises</Text>

        {exercises.length === 0 ? (
          <Text style={styles.empty}>No sets were logged.</Text>
        ) : (
          exercises.map((ex) => (
            <View key={ex.exercise_id} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
              {ex.sets.map((s) => {
                const isPR = prSetIds.has(s.id);
                return (
                  <View key={s.id} style={[styles.setRow, isPR && styles.setRowPR]}>
                    <Text style={styles.setNum}>Set {s.set_number}</Text>
                    <Text style={styles.setDetail}>
                      {s.weight} {units} × {s.reps} reps
                    </Text>
                    {isPR && (
                      <View style={styles.prBadge}>
                        <Ionicons name="trophy" size={12} color="#F59E0B" />
                        <Text style={styles.prText}>PR</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))
        )}

        {/* Session Note */}
        <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Session Note</Text>
        <View style={styles.noteCard}>
          <TextInput
            style={styles.noteInput}
            value={sessionNote}
            onChangeText={(text) => {
              setSessionNote(text);
              if (saveNoteTimerRef.current) clearTimeout(saveNoteTimerRef.current);
              if (sid) {
                saveNoteTimerRef.current = setTimeout(
                  () => saveSessionNote(db, sid, text),
                  500
                );
              }
            }}
            placeholder="Add a note about this workout…"
            placeholderTextColor={c.placeholder}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Done / View History button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => canGoBack ? router.back() : router.replace('/(tabs)/history')}
        >
          <Text style={styles.doneBtnText}>{canGoBack ? 'Done' : 'View History'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: Colors, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
    container: { flex: 1, backgroundColor: c.bg },
    backBtn: {
      position: 'absolute',
      top: topInset + 14,
      left: 16,
      zIndex: 10,
      padding: 6,
    },
    deleteBtn: {
      position: 'absolute',
      top: topInset + 14,
      right: 16,
      zIndex: 10,
      padding: 6,
    },
    scroll: {
      paddingTop: topInset + 56,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },

    // Header
    header: { alignItems: 'center', marginBottom: 28 },
    trophy: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#FEF3C7',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },
    completedLabel: {
      fontSize: 14,
      color: c.muted,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    routineName: {
      fontSize: 26,
      fontWeight: '800',
      color: c.text,
      textAlign: 'center',
      marginBottom: 4,
    },
    dateLabel: {
      fontSize: 14,
      color: c.muted,
    },

    // Stats
    statsRow: {
      flexDirection: 'row',
      marginBottom: 28,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.border,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 16,
      backgroundColor: c.card,
      gap: 4,
    },
    statCardMiddle: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: c.border,
    },
    statValue: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
    },
    prValue: {
      color: '#F59E0B',
    },
    statLabel: {
      fontSize: 11,
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Exercises
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: c.subtext,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    empty: { color: c.muted, textAlign: 'center', marginTop: 20 },
    exerciseCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '700',
      color: c.text,
      marginBottom: 10,
    },
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      gap: 8,
    },
    setRowPR: {
      backgroundColor: '#FEF3C720',
    },
    setNum: {
      fontSize: 13,
      color: c.muted,
      width: 44,
    },
    setDetail: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: c.text,
    },
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: '#FEF3C7',
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    prText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#D97706',
    },

    // Note
    noteCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      marginBottom: 8,
    },
    noteInput: {
      fontSize: 15,
      color: c.text,
      minHeight: 80,
    },

    // Footer
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Math.max(bottomInset, 16),
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
      backgroundColor: c.bg,
    },
    doneBtn: {
      backgroundColor: c.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    doneBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
