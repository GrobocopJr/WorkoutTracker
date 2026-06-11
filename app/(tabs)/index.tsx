import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReorderableList, {
  useReorderableDrag,
  reorderItems,
} from 'react-native-reorderable-list';
import type { ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoutines,
  createRoutine,
  deleteRoutine,
  reorderRoutines,
  createSession,
  getRoutineExercises,
  getExerciseNote,
  endSession,
} from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Routine } from '../../src/types';

type Styles = ReturnType<typeof makeStyles>;

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { startSession, endSession: clearSession } = useWorkoutStore();
  const activeSessionId = useWorkoutStore((s) => s.sessionId);
  const workoutStarted = useWorkoutStore((s) => s.workoutStarted);
  const activeRoutineId = useWorkoutStore((s) => s.routineId);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getRoutines(db);
    setRoutines(data);
    setLoading(false);
  }, [db]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    await createRoutine(db, name);
    setNewName('');
    setModalVisible(false);
    load();
  };

  const handleDelete = (routine: Routine) => {
    Alert.alert('Delete Routine', `Delete "${routine.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRoutine(db, routine.id);
          load();
        },
      },
    ]);
  };

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = reorderItems(routines, from, to);
    setRoutines(next);
    void reorderRoutines(db, next.map((r) => r.id));
  };

  const handleStartWorkout = async (routine: Routine) => {
    if (workoutStarted) return;
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = await createSession(db, today, routine.id);
    const rexes = await getRoutineExercises(db, routine.id);
    const exercises = await Promise.all(
      rexes.map(async (re) => {
        const count = Math.max(1, re.target_sets ?? 1);
        return {
          exercise_id: re.exercise_id,
          exercise_name: re.exercise_name ?? re.exercise_id,
          note: await getExerciseNote(db, re.exercise_id),
          sets: Array.from({ length: count }, (_, i) => ({
            exercise_id: re.exercise_id,
            exercise_name: re.exercise_name ?? re.exercise_id,
            set_number: i + 1,
            weight: '',
            reps: '',
            saved: false,
          })),
        };
      })
    );
    startSession(sessionId, exercises, routine.id);
    router.push('/workout/active');
  };

  const handleFinishWorkout = () => {
    Alert.alert('End Workout', 'Save this workout to history or discard it?', [
      { text: 'Keep Going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Discard Workout',
            'Delete all logged sets and remove this workout from history? This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: async () => {
                  if (activeSessionId) {
                    await db.runAsync('DELETE FROM sets WHERE session_id = ?', [activeSessionId]);
                    await db.runAsync('DELETE FROM sessions WHERE id = ?', [activeSessionId]);
                  }
                  clearSession();
                },
              },
            ]
          );
        },
      },
      {
        text: 'Save & Finish',
        onPress: async () => {
          if (activeSessionId) await endSession(db, activeSessionId);
          clearSession();
          router.push('/(tabs)/history');
        },
      },
    ]);
  };

  const handleStartEmpty = async () => {
    if (workoutStarted) return;
    const today = new Date().toISOString().slice(0, 10);
    const sessionId = await createSession(db, today, null);
    startSession(sessionId, [], null);
    router.push('/workout/active');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activeSessionId != null && (
        <TouchableOpacity
          style={styles.resumeBtn}
          onPress={() => router.push('/workout/active')}
        >
          <Ionicons name="play" size={20} color="#fff" />
          <Text style={styles.resumeBtnText}>Resume Current Workout</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.emptyBtn, workoutStarted && styles.disabledBtn]}
        onPress={handleStartEmpty}
        disabled={workoutStarted}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Start Empty Workout</Text>
      </TouchableOpacity>

      {activeSessionId != null && (
        <TouchableOpacity style={styles.finishWorkoutBtn} onPress={handleFinishWorkout}>
          <Ionicons name="checkmark-done-outline" size={20} color={c.text} />
          <Text style={styles.finishWorkoutText}>Finish Workout</Text>
        </TouchableOpacity>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Routines</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={26} color={c.accent} />
        </TouchableOpacity>
      </View>

      {routines.length === 0 ? (
        <Text style={styles.empty}>No routines yet. Tap + to create one.</Text>
      ) : (
        <GestureHandlerRootView style={styles.listWrap}>
          <ReorderableList
            data={routines}
            onReorder={handleReorder}
            keyExtractor={(r) => String(r.id)}
            contentContainerStyle={{ paddingBottom: 20 }}
            renderItem={({ item }) => {
              const isActive = workoutStarted && item.id === activeRoutineId;
              const isDisabled = workoutStarted && item.id !== activeRoutineId;
              return (
                <RoutineCard
                  routine={item}
                  styles={styles}
                  c={c}
                  isActive={isActive}
                  isDisabled={isDisabled}
                  onStart={() => handleStartWorkout(item)}
                  onEdit={() => router.push(`/routines/${item.id}`)}
                  onDelete={() => handleDelete(item)}
                />
              );
            }}
          />
        </GestureHandlerRootView>
      )}

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Routine</Text>
            <TextInput
              style={styles.input}
              placeholder="Routine name"
              placeholderTextColor={c.placeholder}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setNewName('');
                }}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleCreate}>
                <Text style={styles.confirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface RoutineCardProps {
  routine: Routine;
  styles: Styles;
  c: Colors;
  isActive?: boolean;
  isDisabled?: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RoutineCard({ routine, styles, c, isActive, isDisabled, onStart, onEdit, onDelete }: RoutineCardProps) {
  const drag = useReorderableDrag();
  return (
    <View style={[styles.card, isDisabled && styles.cardDisabled]}>
      <TouchableOpacity style={styles.cardMain} onPress={onStart} disabled={isDisabled}>
        <Text style={[styles.cardTitle, isDisabled && styles.cardTitleDisabled]}>{routine.name}</Text>
        <Text style={[styles.cardSub, isDisabled && styles.cardSubDisabled]}>
          {isActive ? 'In progress' : 'Tap to start workout'}
        </Text>
      </TouchableOpacity>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onEdit} style={styles.iconBtn}>
          <Ionicons name="create-outline" size={22} color={isDisabled ? c.border : c.muted} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.iconBtn} disabled={isDisabled}>
          <Ionicons name="trash-outline" size={22} color={isDisabled ? c.border : c.danger} />
        </TouchableOpacity>
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={150}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Ionicons name="reorder-three-outline" size={24} color={isDisabled ? c.border : c.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
    listWrap: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 10,
      padding: 14,
      justifyContent: 'center',
      marginBottom: 20,
    },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    resumeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.success,
      borderRadius: 10,
      padding: 14,
      justifyContent: 'center',
      marginBottom: 12,
    },
    resumeBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40 },
    card: {
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      elevation: 1,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    finishWorkoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 14,
      justifyContent: 'center',
      marginBottom: 20,
    },
    finishWorkoutText: { color: c.text, fontWeight: '600', fontSize: 15 },
    cardMain: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
    cardDisabled: { opacity: 0.4 },
    cardTitleDisabled: { color: c.muted },
    cardSubDisabled: { color: c.border },
    cardActions: { flexDirection: 'row', gap: 4 },
    iconBtn: { padding: 4 },
    disabledBtn: { opacity: 0.4 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modal: {
      backgroundColor: c.card,
      borderRadius: 14,
      padding: 20,
      width: '80%',
    },
    modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14, color: c.text },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      padding: 10,
      fontSize: 16,
      marginBottom: 14,
      backgroundColor: c.inputBg,
      color: c.text,
    },
    modalRow: { flexDirection: 'row', gap: 10 },
    cancelBtn: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    cancelText: { color: c.subtext },
    confirmBtn: {
      flex: 1,
      padding: 10,
      borderRadius: 8,
      backgroundColor: c.accent,
      alignItems: 'center',
    },
    confirmText: { color: '#fff', fontWeight: '600' },
  });
}
