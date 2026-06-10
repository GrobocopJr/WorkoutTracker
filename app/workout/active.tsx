import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Vibration,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReorderableList, {
  useReorderableDrag,
  reorderItems,
} from 'react-native-reorderable-list';
import type { ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  logSet,
  endSession,
  getSetting,
  getLastSet,
  getBest1RM,
  deleteSet,
  getExerciseNote,
  setExerciseNote,
  syncRoutineExercises,
  getExerciseById,
  createCustomExercise,
  moveSessionSets,
} from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { useColors } from '../../src/theme';
import type { Colors } from '../../src/theme';
import type { Exercise, ActiveExercise } from '../../src/types';

type Styles = ReturnType<typeof makeStyles>;

export default function ActiveWorkout() {
  const db = useSQLiteContext();
  const router = useRouter();
  const {
    sessionId,
    routineId,
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
    removeLastSet,
    addExercise,
    removeExercise,
    reorderExercises,
    renameExercise,
    replaceExerciseId,
    endSession: clearSession,
  } = useWorkoutStore();

  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [units, setUnits] = useState('lbs');
  const [show1RM, setShow1RM] = useState(true);
  const [best1RMs, setBest1RMs] = useState<Record<string, number | null>>({});
  const [pickerVisible, setPickerVisible] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameText, setRenameText] = useState('');
  // Tracks which set indices are personal records: key = `${exerciseId}:${setIndex}`
  const [prKeys, setPrKeys] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((exerciseId: string) => {
    setCollapsed((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }, []);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTimerRunning = useRef(false);

  useEffect(() => {
    Promise.all([getSetting(db, 'units'), getSetting(db, 'show_1rm')]).then(([u, s]) => {
      if (u) setUnits(u);
      setShow1RM(s !== '0');
    });
  }, [db]);

  // Fetch best 1RM for every exercise currently in the workout.
  const loadBest1RMs = useCallback(async () => {
    const entries = await Promise.all(
      exercises.map(async (ex) => [ex.exercise_id, await getBest1RM(db, ex.exercise_id)] as const)
    );
    setBest1RMs(Object.fromEntries(entries));
  }, [db, exercises]);

  useEffect(() => { void loadBest1RMs(); }, [exercises.length]);

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

  // Mirror the current exercise list + set counts back to the routine (if any).
  const syncRoutine = useCallback(
    async (exs: ActiveExercise[]) => {
      if (routineId == null) return;
      await syncRoutineExercises(
        db,
        routineId,
        exs.map((e) => ({ exercise_id: e.exercise_id, sets: e.sets.length }))
      );
    },
    [db, routineId]
  );

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
    // Capture the previous best 1RM before this set is written to DB.
    const prevBest = await getBest1RM(db, exerciseId);
    const newId = await logSet(db, sessionId, exerciseId, setNumber, w, r);
    markSetSaved(exerciseId, setIndex, newId);

    // Epley 1RM: weight × (1 + reps / 30)
    const new1RM = w * (1 + r / 30);
    if (new1RM > (prevBest ?? 0)) {
      setPrKeys((prev) => new Set(prev).add(`${exerciseId}:${setIndex}`));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Update the displayed 1RM for this exercise.
    getBest1RM(db, exerciseId).then((best) => {
      setBest1RMs((prev) => ({ ...prev, [exerciseId]: best }));
    });
    startTimer(timerDefault);
  };

  const handleAddSet = (ex: ActiveExercise) => {
    addSetToExercise(ex.exercise_id, ex.exercise_name);
    void syncRoutine(useWorkoutStore.getState().exercises);
  };

  const handleRemoveExercise = (exerciseId: string, exerciseName: string) => {
    const ex = exercises.find((e) => e.exercise_id === exerciseId);
    if (!ex) return;
    const loggedIds = ex.sets.filter((s) => s.saved && s.id != null).map((s) => s.id as number);
    const doRemove = async () => {
      for (const id of loggedIds) await deleteSet(db, id);
      removeExercise(exerciseId);
      void syncRoutine(useWorkoutStore.getState().exercises);
    };
    const msg = loggedIds.length
      ? `Remove "${exerciseName}"? Its ${loggedIds.length} logged set${loggedIds.length > 1 ? 's' : ''} will be deleted from history.`
      : `Remove "${exerciseName}" from this workout?`;
    Alert.alert('Remove Exercise', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ]);
  };

  const handleRemoveSet = (exerciseId: string) => {
    const ex = exercises.find((e) => e.exercise_id === exerciseId);
    if (!ex || ex.sets.length <= 1) return;
    const last = ex.sets[ex.sets.length - 1];
    const doRemove = async () => {
      if (last.saved && last.id != null) await deleteSet(db, last.id);
      removeLastSet(exerciseId);
      void syncRoutine(useWorkoutStore.getState().exercises);
    };
    if (last.saved) {
      Alert.alert(
        'Remove Logged Set',
        `Set ${last.set_number} is already logged. Remove it and delete it from history?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    } else {
      void doRemove();
    }
  };

  const handleReorder = ({ from, to }: ReorderableListReorderEvent) => {
    const next = reorderItems(exercises, from, to);
    reorderExercises(next);
    void syncRoutine(next);
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
    const note = await getExerciseNote(db, exercise.id);
    addExercise({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      note,
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
    void syncRoutine(useWorkoutStore.getState().exercises);
    setPickerVisible(false);
  };

  const openRename = (exerciseId: string, currentName: string) => {
    setRenameTarget({ id: exerciseId, name: currentName });
    setRenameText(currentName);
  };

  const handleSaveRename = () => {
    if (!renameTarget) return;
    const oldId = renameTarget.id;
    const newName = renameText.trim();
    setRenameTarget(null);
    if (!newName || newName === renameTarget.name) return;
    renameExercise(oldId, newName);
    // Offer to persist the renamed exercise to the library for future workouts.
    Alert.alert(
      'Save Exercise',
      `Add "${newName}" to your exercise library so you can use it again later?`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Add', onPress: () => savePermanently(oldId, newName) },
      ]
    );
  };

  const savePermanently = async (oldId: string, newName: string) => {
    const orig = await getExerciseById(db, oldId);
    const custom = await createCustomExercise(db, {
      name: newName,
      equipment: orig?.equipment ?? null,
      category: orig?.category ?? null,
      primaryMuscles: parseJsonArray(orig?.primary_muscles),
      secondaryMuscles: parseJsonArray(orig?.secondary_muscles),
    });
    // Move this session's already-logged sets onto the new exercise.
    if (sessionId) await moveSessionSets(db, sessionId, oldId, custom.id);
    const note = await getExerciseNote(db, oldId);
    if (note) await setExerciseNote(db, custom.id, note);
    // Point the active session at the new exercise going forward.
    replaceExerciseId(oldId, custom.id);
    void syncRoutine(useWorkoutStore.getState().exercises);
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

      <GestureHandlerRootView style={styles.scroll}>
        <ReorderableList
          data={exercises}
          onReorder={handleReorder}
          keyExtractor={(item) => item.exercise_id}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>Tap "Add Exercise" below to start logging.</Text>
          }
          renderItem={({ item }) => (
            <ExerciseCard
              ex={item}
              units={units}
              styles={styles}
              c={c}
              collapsed={!!collapsed[item.exercise_id]}
              prKeys={prKeys}
              show1RM={show1RM}
              best1RM={best1RMs[item.exercise_id] ?? null}
              onToggleCollapse={toggleCollapse}
              onRename={openRename}
              onLog={handleLogSet}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onRemoveExercise={handleRemoveExercise}
            />
          )}
        />
      </GestureHandlerRootView>

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

      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rename Exercise</Text>
            <TextInput
              style={styles.modalInput}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Exercise name"
              placeholderTextColor={c.placeholder}
              autoFocus
              onSubmitEditing={handleSaveRename}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameTarget(null)} style={styles.modalBtn}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveRename} style={[styles.modalBtn, styles.modalSaveBtn]}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function parseJsonArray(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

interface ExerciseCardProps {
  ex: ActiveExercise;
  units: string;
  styles: Styles;
  c: Colors;
  collapsed: boolean;
  prKeys: Set<string>;
  show1RM: boolean;
  best1RM: number | null;
  onToggleCollapse: (exerciseId: string) => void;
  onRename: (exerciseId: string, currentName: string) => void;
  onLog: (
    exerciseId: string,
    setIndex: number,
    weight: string,
    reps: string,
    setNumber: number
  ) => void;
  onAddSet: (ex: ActiveExercise) => void;
  onRemoveSet: (exerciseId: string) => void;
  onRemoveExercise: (exerciseId: string, name: string) => void;
}

function ExerciseCard({
  ex,
  units,
  styles,
  c,
  collapsed,
  prKeys,
  show1RM,
  best1RM,
  onToggleCollapse,
  onRename,
  onLog,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
}: ExerciseCardProps) {
  const db = useSQLiteContext();
  const updateSet = useWorkoutStore((s) => s.updateSet);
  const updateNote = useWorkoutStore((s) => s.setExerciseNote);
  const drag = useReorderableDrag();
  const lastTap = useRef(0);

  // Double-tap the title/top bar to collapse or expand this exercise.
  const handleTitlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 345) {
      onToggleCollapse(ex.exercise_id);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const loggedCount = ex.sets.filter((s) => s.saved).length;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <TouchableOpacity
          onPress={() => onToggleCollapse(ex.exercise_id)}
          hitSlop={8}
          style={styles.chevronBtn}
        >
          <Ionicons
            name={collapsed ? 'chevron-forward' : 'chevron-down'}
            size={18}
            color={c.muted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.titleArea}
          activeOpacity={0.7}
          onPress={handleTitlePress}
          onLongPress={() => onRename(ex.exercise_id, ex.exercise_name)}
          delayLongPress={350}
        >
          <Text style={styles.exerciseTitle} numberOfLines={1}>
            {ex.exercise_name}
          </Text>
          {show1RM && best1RM != null && (
            <Text style={styles.exercise1RM} numberOfLines={1}>
              ({Math.round(best1RM)} {units})
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onLongPress={drag}
          delayLongPress={150}
          hitSlop={8}
          style={styles.dragHandle}
        >
          <Ionicons name="reorder-three-outline" size={24} color={c.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onRemoveExercise(ex.exercise_id, ex.exercise_name)}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={20} color={c.danger} />
        </TouchableOpacity>
      </View>

      {collapsed ? (
        <Text style={styles.collapsedSummary}>
          {ex.sets.length} set{ex.sets.length !== 1 ? 's' : ''}
          {loggedCount > 0 ? ` · ${loggedCount} logged` : ''}
          {ex.note ? ` · ${ex.note}` : ''}
        </Text>
      ) : (
        <ExerciseBody
          ex={ex}
          units={units}
          styles={styles}
          c={c}
          db={db}
          prKeys={prKeys}
          updateSet={updateSet}
          updateNote={updateNote}
          onLog={onLog}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
        />
      )}
    </View>
  );
}

interface ExerciseBodyProps {
  ex: ActiveExercise;
  units: string;
  styles: Styles;
  c: Colors;
  db: ReturnType<typeof useSQLiteContext>;
  prKeys: Set<string>;
  updateSet: (exerciseId: string, setIndex: number, field: 'weight' | 'reps', value: string) => void;
  updateNote: (exerciseId: string, note: string) => void;
  onLog: (
    exerciseId: string,
    setIndex: number,
    weight: string,
    reps: string,
    setNumber: number
  ) => void;
  onAddSet: (ex: ActiveExercise) => void;
  onRemoveSet: (exerciseId: string) => void;
}

function ExerciseBody({
  ex,
  units,
  styles,
  c,
  db,
  prKeys,
  updateSet,
  updateNote,
  onLog,
  onAddSet,
  onRemoveSet,
}: ExerciseBodyProps) {
  return (
    <>
      <TextInput
        style={styles.noteInput}
        value={ex.note ?? ''}
        onChangeText={(v) => updateNote(ex.exercise_id, v)}
        onEndEditing={(e) => setExerciseNote(db, ex.exercise_id, e.nativeEvent.text)}
        placeholder="Add a note…"
        placeholderTextColor={c.placeholder}
        multiline
      />

      <View style={styles.setHeader}>
        <Text style={styles.setHeaderCell}>Set</Text>
        <Text style={[styles.setHeaderCell, { flex: 2 }]}>Weight ({units})</Text>
        <Text style={[styles.setHeaderCell, { flex: 1.5 }]}>Reps</Text>
        <Text style={[styles.setHeaderCell, { flex: 1 }]}></Text>
      </View>

      {ex.sets.map((set, idx) => {
        const isPR = prKeys.has(`${ex.exercise_id}:${idx}`);
        return (
          <View key={idx}>
            <View style={[styles.setRow, set.saved && styles.setRowSaved, isPR && styles.setRowPR]}>
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
                style={[styles.logBtn, set.saved && styles.logBtnSaved, isPR && styles.logBtnPR]}
                onPress={() =>
                  !set.saved &&
                  onLog(ex.exercise_id, idx, set.weight, set.reps, set.set_number)
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
            {isPR && (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={12} color="#F59E0B" />
                <Text style={styles.prText}>New PR!</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.setActions}>
        <TouchableOpacity style={styles.addSetBtn} onPress={() => onAddSet(ex)}>
          <Ionicons name="add" size={16} color={c.accent} />
          <Text style={styles.addSetText}>Add Set</Text>
        </TouchableOpacity>
        {ex.sets.length > 1 && (
          <TouchableOpacity style={styles.addSetBtn} onPress={() => onRemoveSet(ex.exercise_id)}>
            <Ionicons name="remove" size={16} color={c.danger} />
            <Text style={styles.removeSetText}>Remove Set</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
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
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    chevronBtn: { paddingRight: 4, paddingVertical: 4 },
    titleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    exerciseTitle: { flexShrink: 1, fontSize: 16, fontWeight: '700', color: c.text },
    exercise1RM: { flexShrink: 0, fontSize: 13, color: c.muted, marginLeft: 6 },
    collapsedSummary: { fontSize: 13, color: c.muted, marginTop: 2, marginLeft: 22 },
    dragHandle: { paddingHorizontal: 8 },
    noteInput: {
      fontSize: 13,
      fontStyle: 'italic',
      color: c.muted,
      paddingVertical: 2,
      marginBottom: 8,
    },
    setHeader: { flexDirection: 'row', marginBottom: 4, paddingHorizontal: 2 },
    setHeaderCell: { flex: 1, fontSize: 12, color: c.muted, fontWeight: '600' },
    setRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, padding: 6, borderRadius: 8 },
    setRowSaved: { backgroundColor: c.successFaded },
    setRowPR: { borderWidth: 1, borderColor: '#F59E0B' },
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
    logBtnPR: { backgroundColor: '#D97706' },
    prBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 34,
      marginBottom: 8,
    },
    prText: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
    setActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
    addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
    addSetText: { color: c.accent, fontWeight: '600' },
    removeSetText: { color: c.danger, fontWeight: '600' },
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
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    modalCard: { backgroundColor: c.card, borderRadius: 12, padding: 18 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 12 },
    modalInput: {
      backgroundColor: c.inputBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
      fontSize: 15,
      color: c.text,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
    modalBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    modalSaveBtn: { backgroundColor: c.accent },
    modalCancel: { color: c.muted, fontWeight: '600' },
    modalSave: { color: '#fff', fontWeight: '700' },
  });
}
