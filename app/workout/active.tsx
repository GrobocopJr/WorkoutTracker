import { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Vibration,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { logSet, endSession, getSetting, getLastSet } from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Exercise } from '../../src/types';

export default function ActiveWorkout() {
  const db = useSQLiteContext();
  const router = useRouter();
  const {
    sessionId,
    exercises,
    timerSeconds,
    timerRunning,
    timerDefault,
    startTimer,
    tickTimer,
    stopTimer,
    updateSet,
    markSetSaved,
    addSetToExercise,
    addExercise,
    endSession: clearSession,
  } = useWorkoutStore();

  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [units, setUnits] = useState('lbs');
  const [pickerVisible, setPickerVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTimerRunning = useRef(false);

  useEffect(() => {
    getSetting(db, 'units').then((u) => { if (u) setUnits(u); });
  }, [db]);

  useEffect(() => {
    exercises.forEach((ex) => {
      ex.sets.forEach(async (set, idx) => {
        if (set.weight === '' && set.reps === '' && !set.saved) {
          const last = await getLastSet(db, ex.exercise_id);
          if (last) {
            updateSet(ex.exercise_id, idx, 'weight', String(last.weight));
            updateSet(ex.exercise_id, idx, 'reps', String(last.reps));
          }
        }
      });
    });
  }, [exercises.length]);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(tickTimer, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (prevTimerRunning.current && timerSeconds === 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Vibration.vibrate([0, 400, 200, 400]);
      }
    }
    prevTimerRunning.current = timerRunning;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleLogSet = async (
    exerciseId: string,
    setIndex: number,
    weight: string,
    reps: string,
    setNumber: number
  ) => {
    if (!sessionId) return;
    const w = parseFloat(weight);
    const r = parseInt(reps, 10);
    if (isNaN(w) || isNaN(r) || r <= 0) {
      Alert.alert('Invalid input', 'Please enter valid weight and reps.');
      return;
    }
    await logSet(db, sessionId, exerciseId, setNumber, w, r);
    markSetSaved(exerciseId, setIndex);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startTimer(timerDefault);
  };

  const handleFinish = () => {
    Alert.alert('Finish Workout', 'End this workout session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: async () => {
          if (sessionId) await endSession(db, sessionId);
          clearSession();
          router.replace('/(tabs)/history');
        },
      },
    ]);
  };

  const handleAddExercise = async (exercise: Exercise) => {
    const last = await getLastSet(db, exercise.id);
    addExercise({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: [
        {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          set_number: 1,
          weight: last ? String(last.weight) : '',
          reps: last ? String(last.reps) : '',
          saved: false,
        },
      ],
    });
    setPickerVisible(false);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!sessionId) {
    return (
      <View style={styles.centered}>
        <Text style={styles.noSession}>No active workout.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {(timerRunning || timerSeconds > 0) && (
        <View style={[styles.timerBanner, timerSeconds === 0 && styles.timerDone]}>
          <Ionicons
            name={timerRunning ? 'timer-outline' : 'checkmark-circle-outline'}
            size={20}
            color="#fff"
          />
          <Text style={styles.timerText}>
            {timerRunning ? `Rest: ${formatTime(timerSeconds)}` : 'Rest done!'}
          </Text>
          <TouchableOpacity onPress={stopTimer}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {exercises.length === 0 && (
          <Text style={styles.empty}>Tap "Add Exercise" below to start logging.</Text>
        )}

        {exercises.map((ex) => (
          <View key={ex.exercise_id} style={styles.exerciseCard}>
            <Text style={styles.exerciseTitle}>{ex.exercise_name}</Text>

            <View style={styles.setHeader}>
              <Text style={styles.setHeaderCell}>Set</Text>
              <Text style={[styles.setHeaderCell, { flex: 2 }]}>Weight ({units})</Text>
              <Text style={[styles.setHeaderCell, { flex: 1.5 }]}>Reps</Text>
              <Text style={[styles.setHeaderCell, { flex: 1 }]}></Text>
            </View>

            {ex.sets.map((set, idx) => (
              <View key={idx} style={[styles.setRow, set.saved && styles.setRowSaved]}>
                <Text style={styles.setNum}>{set.set_number}</Text>
                <TextInput
                  style={[styles.setInput, { flex: 2 }]}
                  value={set.weight}
                  onChangeText={(v) => updateSet(ex.exercise_id, idx, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={c.placeholder}
                  editable={!set.saved}
                />
                <TextInput
                  style={[styles.setInput, { flex: 1.5 }]}
                  value={set.reps}
                  onChangeText={(v) => updateSet(ex.exercise_id, idx, 'reps', v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={c.placeholder}
                  editable={!set.saved}
                />
                <TouchableOpacity
                  style={[styles.logBtn, set.saved && styles.logBtnSaved]}
                  onPress={() =>
                    !set.saved &&
                    handleLogSet(ex.exercise_id, idx, set.weight, set.reps, set.set_number)
                  }
                  disabled={set.saved}
                >
                  <Ionicons
                    name={set.saved ? 'checkmark' : 'checkmark-outline'}
                    size={18}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity
              style={styles.addSetBtn}
              onPress={() => addSetToExercise(ex.exercise_id, ex.exercise_name)}
            >
              <Ionicons name="add" size={16} color={c.accent} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addExBtn} onPress={() => setPickerVisible(true)}>
          <Ionicons name="add-circle-outline" size={20} color={c.accent} />
          <Text style={styles.addExText}>Add Exercise</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
      />
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    noSession: { fontSize: 16, color: c.muted, marginBottom: 16 },
    backBtn: { backgroundColor: c.accent, borderRadius: 8, padding: 12, paddingHorizontal: 24 },
    backBtnText: { color: '#fff', fontWeight: '600' },
    timerBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    timerDone: { backgroundColor: c.success },
    timerText: { flex: 1, color: '#fff', fontWeight: '700', fontSize: 16 },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 100 },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
    exerciseCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    exerciseTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 10 },
    setHeader: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 2 },
    setHeaderCell: { flex: 1, fontSize: 12, color: c.muted, fontWeight: '600' },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, padding: 6, borderRadius: 8 },
    setRowSaved: { backgroundColor: c.successFaded },
    setNum: { width: 28, fontSize: 14, fontWeight: '600', color: c.muted },
    setInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 8,
      fontSize: 15,
      textAlign: 'center',
      backgroundColor: c.inputBg,
      color: c.text,
    },
    logBtn: {
      flex: 1,
      backgroundColor: c.accent,
      borderRadius: 8,
      padding: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logBtnSaved: { backgroundColor: c.success },
    addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 6 },
    addSetText: { color: c.accent, fontWeight: '600' },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
      backgroundColor: c.card,
      borderTopWidth: 1,
      borderTopColor: c.borderLight,
    },
    addExBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.accent,
      borderRadius: 10,
      padding: 12,
    },
    addExText: { color: c.accent, fontWeight: '600', fontSize: 15 },
    finishBtn: {
      flex: 1,
      backgroundColor: c.accent,
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
