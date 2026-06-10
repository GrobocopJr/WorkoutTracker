import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getRoutines,
  createRoutine,
  deleteRoutine,
  createSession,
  getRoutineExercises,
  getExerciseNote,
} from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Routine } from '../../src/types';

export default function WorkoutTab() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { startSession } = useWorkoutStore();
  const activeSessionId = useWorkoutStore((s) => s.sessionId);
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

  const handleStartWorkout = async (routine: Routine) => {
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

  const handleStartEmpty = async () => {
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

      <TouchableOpacity style={styles.emptyBtn} onPress={handleStartEmpty}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Start Empty Workout</Text>
      </TouchableOpacity>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Routines</Text>
        <TouchableOpacity onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={26} color={c.accent} />
        </TouchableOpacity>
      </View>

      {routines.length === 0 ? (
        <Text style={styles.empty}>No routines yet. Tap + to create one.</Text>
      ) : (
        <FlatList
          data={routines}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.cardMain}
                onPress={() => handleStartWorkout(item)}
              >
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.cardSub}>Tap to start workout</Text>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => router.push(`/routines/${item.id}`)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="create-outline" size={22} color={c.muted} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  style={styles.iconBtn}
                >
                  <Ionicons name="trash-outline" size={22} color={c.danger} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
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

function makeStyles(c: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg, padding: 16 },
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
    cardMain: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    cardSub: { fontSize: 12, color: c.muted, marginTop: 2 },
    cardActions: { flexDirection: 'row', gap: 4 },
    iconBtn: { padding: 4 },
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
