import { useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReorderableList, {
  useReorderableDrag,
  reorderItems,
} from 'react-native-reorderable-list';
import type { ReorderableListReorderEvent } from 'react-native-reorderable-list';
import { useSQLiteContext } from 'expo-sqlite';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  logSet,
  endSession,
  getSetting,
  getLastSet,
  getLastSessionSets,
  getBest1RM,
  deleteSet,
  getExerciseNote,
  setExerciseNote,
  saveSessionNote,
  syncRoutineExercises,
  getExerciseById,
  createCustomExercise,
  moveSessionSets,
} from '../../src/db/queries';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { ExercisePicker } from '../../src/components/ExercisePicker';
import { PlateCalculator } from '../../src/components/PlateCalculator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    unsaveSet,
    addSetToExercise,
    removeLastSet,
    addExercise,
    removeExercise,
    reorderExercises,
    renameExercise,
    replaceExerciseId,
    endSession: clearSession,
    durationPaused,
    durationPausedMs,
    durationPausedAt,
    pauseDuration,
    resumeDuration,
    workoutStarted,
    workoutStartMs,
    beginWorkout,
    setWorkoutStartMs,
  } = useWorkoutStore();

  const navigation = useNavigation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c, insets.bottom), [c, insets.bottom]);

  const [units, setUnits] = useState('lbs');
  const [show1RM, setShow1RM] = useState(true);
  const [best1RMs, setBest1RMs] = useState<Record<string, number | null>>({});
  // Incremented every second when running; used only to trigger re-renders.
  const [, setTick] = useState(0);
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
  const listRef = useRef<any>(null);
  const focusedExerciseIdxRef = useRef(-1);
  const keyboardVisibleRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [sessionNote, setSessionNote] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const saveNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToExercise = useCallback((idx: number) => {
    listRef.current?.scrollToIndex({
      index: idx,
      viewPosition: 0,
      animated: true,
    });
  }, []);

  const handleNoteChange = useCallback((text: string) => {
    setSessionNote(text);
    if (saveNoteTimerRef.current) clearTimeout(saveNoteTimerRef.current);
    if (sessionId) {
      saveNoteTimerRef.current = setTimeout(() => saveSessionNote(db, sessionId, text), 500);
    }
  }, [db, sessionId]);

  const noteIsEmpty = !sessionNote.trim();
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => setNoteModalVisible(true)} hitSlop={8} style={{ marginRight: 4 }}>
          <Ionicons
            name={noteIsEmpty ? 'document-text-outline' : 'document-text'}
            size={22}
            color={noteIsEmpty ? c.text : c.accent}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, noteIsEmpty, c.accent, c.text]);

  const handleInputFocus = useCallback((exerciseIdx: number) => {
    focusedExerciseIdxRef.current = exerciseIdx;
    if (keyboardVisibleRef.current) {
      setTimeout(() => scrollToExercise(exerciseIdx), 100);
    }
  }, [scrollToExercise]);

  // On mount: if session is already in progress (reload/resume), mark as started in store.
  useEffect(() => {
    if (!workoutStarted && (durationPausedMs > 0 || exercises.some((ex) => ex.sets.some((s) => s.saved)))) {
      beginWorkout();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Promise.all([getSetting(db, 'units'), getSetting(db, 'show_1rm')]).then(([u, s]) => {
      if (u) setUnits(u);
      setShow1RM(s !== '0');
    });
  }, [db]);

  // For resumed sessions, load started_at from DB so elapsed time is correct.
  useEffect(() => {
    if (!sessionId || !workoutStarted || workoutStartMs !== null) return;
    db.getFirstAsync<{ started_at: string }>(
      'SELECT started_at FROM sessions WHERE id = ?',
      [sessionId]
    ).then((row) => {
      if (row) {
        setWorkoutStartMs(new Date(row.started_at.replace(' ', 'T') + 'Z').getTime());
      }
    });
  }, [db, sessionId, workoutStarted, workoutStartMs]);

  // Tick once per second to keep the elapsed display current (only when running).
  useEffect(() => {
    if (!workoutStarted || durationPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [workoutStarted, durationPaused]);

  const startWorkout = useCallback(() => {
    if (workoutStarted) return;
    beginWorkout();
    setWorkoutStartMs(Date.now());
  }, [workoutStarted, beginWorkout, setWorkoutStartMs]);

  // Fetch best 1RM for every exercise currently in the workout.
  const loadBest1RMs = useCallback(async () => {
    const entries = await Promise.all(
      exercises.map(async (ex) => [ex.exercise_id, await getBest1RM(db, ex.exercise_id)] as const)
    );
    setBest1RMs(Object.fromEntries(entries));
  }, [db, exercises]);

  useEffect(() => { void loadBest1RMs(); }, [exercises.length]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardVisibleRef.current = true;
      setKeyboardHeight(e.endCoordinates.height);
      const idx = focusedExerciseIdxRef.current;
      if (idx >= 0) {
        setTimeout(() => scrollToExercise(idx), 150);
      } else {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
      }
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardVisibleRef.current = false;
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [scrollToExercise]);

  // Load session note and clean up save timer on unmount.
  useEffect(() => {
    if (!sessionId) return;
    db.getFirstAsync<{ notes: string | null }>(
      'SELECT notes FROM sessions WHERE id = ?',
      [sessionId]
    ).then((row) => setSessionNote(row?.notes ?? ''));
    return () => { if (saveNoteTimerRef.current) clearTimeout(saveNoteTimerRef.current); };
  }, [sessionId]);


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
    startWorkout();
    // Capture the previous best 1RM before this set is written to DB.
    const prevBest = await getBest1RM(db, exerciseId);
    const newId = await logSet(db, sessionId, exerciseId, setNumber, w, r);
    markSetSaved(exerciseId, setIndex, newId);

    const updatedEx = useWorkoutStore.getState().exercises.find((e) => e.exercise_id === exerciseId);
    if (updatedEx && updatedEx.sets.length > 0 && updatedEx.sets.every((s) => s.saved)) {
      setCollapsed((prev) => ({ ...prev, [exerciseId]: true }));
    }

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

  const handleUnsaveSet = useCallback(async (exerciseId: string, setIndex: number, setId?: number) => {
    if (setId) await deleteSet(db, setId);
    unsaveSet(exerciseId, setIndex);
    setPrKeys((prev) => { const n = new Set(prev); n.delete(`${exerciseId}:${setIndex}`); return n; });
    setCollapsed((prev) => ({ ...prev, [exerciseId]: false }));
  }, [db, unsaveSet]);

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

  const handleDiscard = () => {
    Alert.alert(
      'Discard Workout',
      'Delete all logged sets and remove this workout from history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (sessionId) {
              await db.runAsync('DELETE FROM sets WHERE session_id = ?', [sessionId]);
              await db.runAsync('DELETE FROM sessions WHERE id = ?', [sessionId]);
            }
            clearSession();
            router.replace('/(tabs)/');
          },
        },
      ]
    );
  };

  const handleFinish = () => {
    Alert.alert('End Workout', 'Save this workout to history or discard it?', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: handleDiscard },
      {
        text: 'Save & Finish',
        onPress: async () => {
          // Compute final duration before clearing store.
          const now = Date.now();
          const totalPaused = durationPausedMs + (durationPausedAt ? now - durationPausedAt : 0);
          const durationSecs = workoutStartMs
            ? Math.max(0, Math.floor((now - workoutStartMs - totalPaused) / 1000))
            : 0;
          const sid = sessionId;
          if (sid) await endSession(db, sid);
          clearSession();
          router.replace({
            pathname: '/workout/summary',
            params: { sessionId: String(sid), durationSecs: String(durationSecs) },
          });
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

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Compute elapsed: frozen at pause point when paused, live otherwise.
  const elapsedSeconds = workoutStartMs
    ? durationPaused && durationPausedAt != null
      ? Math.max(0, Math.floor((durationPausedAt - workoutStartMs - durationPausedMs) / 1000))
      : Math.max(0, Math.floor((Date.now() - workoutStartMs - durationPausedMs) / 1000))
    : 0;

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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

      <View style={styles.durationBar}>
        <Ionicons name="time-outline" size={15} color={c.muted} />
        <Text style={styles.durationText}>{formatElapsed(elapsedSeconds)}</Text>
        {workoutStarted && (
          <TouchableOpacity
            onPress={durationPaused ? resumeDuration : pauseDuration}
            hitSlop={10}
            style={styles.durationToggle}
          >
            <Ionicons
              name={durationPaused ? 'play-circle-outline' : 'pause-circle-outline'}
              size={20}
              color={durationPaused ? c.accent : c.muted}
            />
          </TouchableOpacity>
        )}
      </View>

      <GestureHandlerRootView style={styles.scroll}>
        <ReorderableList
          ref={listRef}
          data={exercises}
          onReorder={handleReorder}
          keyExtractor={(item) => item.exercise_id}
          contentContainerStyle={[styles.scrollContent, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.empty}>Tap "Add Exercise" below to start logging.</Text>
          }
          renderItem={({ item, index }) => (
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
              onUnsave={handleUnsaveSet}
              onAddSet={handleAddSet}
              onRemoveSet={handleRemoveSet}
              onRemoveExercise={handleRemoveExercise}
              onInputFocus={() => handleInputFocus(index)}
            />
          )}
          ListFooterComponent={useMemo(() => (
            <View style={styles.sessionNoteSection}>
              <Text style={styles.sessionNoteLabel}>Session Note</Text>
              <TextInput
                style={styles.sessionNoteInput}
                value={sessionNote}
                onChangeText={handleNoteChange}
                onFocus={() => {
                  focusedExerciseIdxRef.current = -1;
                  if (keyboardVisibleRef.current) {
                    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
                  }
                }}
                placeholder="Add a note about this workout…"
                placeholderTextColor={c.placeholder}
                multiline
                returnKeyType="default"
              />
            </View>
          ), [sessionNote, handleNoteChange, styles, c.placeholder])}
        />
      </GestureHandlerRootView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.addExBtn} onPress={() => setPickerVisible(true)}>
          <Ionicons name="add-circle-outline" size={20} color={c.accent} />
          <Text style={styles.addExText}>Add Exercise</Text>
        </TouchableOpacity>
        {workoutStarted ? (
          <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
            <Text style={styles.finishText}>Finish</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={startWorkout}>
            <Text style={styles.startText}>Start</Text>
          </TouchableOpacity>
        )}
      </View>

      <ExercisePicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={handleAddExercise}
      />

      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Session Note</Text>
            <TextInput
              style={[styles.modalInput, styles.modalNoteInput]}
              value={sessionNote}
              onChangeText={handleNoteChange}
              placeholder="Add a note about this workout…"
              placeholderTextColor={c.placeholder}
              autoFocus
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setNoteModalVisible(false)}
                style={[styles.modalBtn, styles.modalSaveBtn]}
              >
                <Text style={styles.modalSave}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
    </KeyboardAvoidingView>
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
  onUnsave: (exerciseId: string, setIndex: number, setId?: number) => void;
  onAddSet: (ex: ActiveExercise) => void;
  onRemoveSet: (exerciseId: string) => void;
  onRemoveExercise: (exerciseId: string, name: string) => void;
  onInputFocus: () => void;
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
  onUnsave,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onInputFocus,
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
          onUnsave={onUnsave}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
          onInputFocus={onInputFocus}
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
  onUnsave: (exerciseId: string, setIndex: number, setId?: number) => void;
  onAddSet: (ex: ActiveExercise) => void;
  onRemoveSet: (exerciseId: string) => void;
  onInputFocus: () => void;
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
  onUnsave,
  onRemoveSet,
  onInputFocus,
}: ExerciseBodyProps) {
  const router = useRouter();
  const [calcTarget, setCalcTarget] = useState<{ weight: string; setIndex: number } | null>(null);
  const [lastSets, setLastSets] = useState<{ set_number: number; weight: number; reps: number }[]>([]);
  const sessionId = useWorkoutStore((s) => s.sessionId);
  const suggestSet = useWorkoutStore((s) => s.suggestSet);

  useEffect(() => {
    if (!sessionId) return;
    getLastSessionSets(db, ex.exercise_id, sessionId).then(setLastSets);
  }, [db, ex.exercise_id, sessionId]);

  useEffect(() => {
    if (lastSets.length === 0) return;
    ex.sets.forEach((set, idx) => {
      if (set.saved || set.weight !== '' || set.reps !== '') return;
      const ref = lastSets[idx] ?? lastSets[lastSets.length - 1];
      suggestSet(ex.exercise_id, idx, String(ref.weight), String(ref.reps));
    });
  }, [lastSets]);

  return (
    <>
      <View style={styles.noteRow}>
        <TouchableOpacity
          onPress={() => router.push(`/exercises/${ex.exercise_id}` as any)}
          hitSlop={8}
          style={styles.infoBtn}
        >
          <Ionicons name="information-circle-outline" size={24} color={c.muted} />
        </TouchableOpacity>
        <TextInput
          style={[styles.noteInput, { flex: 1 }]}
          value={ex.note ?? ''}
          onChangeText={(v) => updateNote(ex.exercise_id, v)}
          onEndEditing={(e) => setExerciseNote(db, ex.exercise_id, e.nativeEvent.text)}
          placeholder="Add a note…"
          placeholderTextColor={c.placeholder}
          multiline
        />
      </View>

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
                style={[styles.setInput, { flex: 2, color: set.isSuggested ? c.placeholder : c.text }]}
                value={set.weight}
                onChangeText={(v) => updateSet(ex.exercise_id, idx, 'weight', v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.placeholder}
                selectTextOnFocus
                onFocus={() => {
                  if (set.saved) onUnsave(ex.exercise_id, idx, set.id);
                  onInputFocus();
                }}
              />
              <TextInput
                style={[styles.setInput, { flex: 1.5, color: set.isSuggested ? c.placeholder : c.text }]}
                value={set.reps}
                onChangeText={(v) => updateSet(ex.exercise_id, idx, 'reps', v)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={c.placeholder}
                selectTextOnFocus
                onFocus={() => {
                  if (set.saved) onUnsave(ex.exercise_id, idx, set.id);
                  onInputFocus();
                }}
                onSubmitEditing={() => onLog(ex.exercise_id, idx, set.weight, set.reps, set.set_number)}
              />
              <TouchableOpacity
                style={[styles.logBtn, set.saved && styles.logBtnSaved, isPR && styles.logBtnPR]}
                onPress={() => {
                  if (set.saved) onUnsave(ex.exercise_id, idx, set.id);
                  else onLog(ex.exercise_id, idx, set.weight, set.reps, set.set_number);
                }}
              >
                <Ionicons
                  name={set.saved ? 'checkmark' : 'checkmark-outline'}
                  size={18}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCalcTarget({ weight: set.weight, setIndex: idx })}
                hitSlop={8}
                style={styles.barbellBtn}
              >
                <Ionicons name="barbell-outline" size={18} color={c.muted} />
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

      <PlateCalculator
        key={calcTarget ? `${calcTarget.setIndex}:${calcTarget.weight}` : ''}
        visible={calcTarget !== null}
        initialWeight={calcTarget?.weight ?? ''}
        units={units}
        onApply={(w) => {
          ex.sets.forEach((set, i) => {
            if (!set.saved) updateSet(ex.exercise_id, i, 'weight', w);
          });
        }}
        onClose={() => setCalcTarget(null)}
      />
    </>
  );
}

function makeStyles(c: Colors, bottomInset: number = 0) {
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
    durationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 6,
      backgroundColor: c.card,
      borderBottomWidth: 1,
      borderBottomColor: c.borderLight,
    },
    durationText: { flex: 1, fontSize: 13, fontWeight: '600', color: c.muted },
    durationToggle: { padding: 2 },
    scroll: { flex: 1 },
    scrollContent: { padding: 14, paddingBottom: 14 },
    empty: { color: c.muted, textAlign: 'center', marginTop: 40, fontSize: 15 },
    sessionNoteSection: {
      marginTop: 8,
      backgroundColor: c.card,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    sessionNoteLabel: { fontSize: 13, fontWeight: '600', color: c.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    sessionNoteInput: {
      color: c.text,
      fontSize: 15,
      minHeight: 72,
      textAlignVertical: 'top',
      backgroundColor: c.inputBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 10,
    },
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
    noteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    infoBtn: {
      alignSelf: 'flex-start',
      paddingTop: 2,
    },
    noteInput: {
      fontSize: 13,
      fontStyle: 'italic',
      color: c.muted,
      paddingVertical: 2,
    },
    lastTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    lastTimeLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      flexShrink: 0,
    },
    lastTimeSets: {
      fontSize: 12,
      color: c.muted,
      flexShrink: 1,
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
    barbellBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
    setActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 4 },
    addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
    addSetText: { color: c.accent, fontWeight: '600' },
    removeSetText: { color: c.danger, fontWeight: '600' },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingTop: 14,
      paddingHorizontal: 14,
      paddingBottom: Math.max(bottomInset, 14),
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
    startBtn: {
      flex: 1,
      backgroundColor: '#22C55E',
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    startText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
    modalNoteInput: { minHeight: 100, textAlignVertical: 'top' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
    modalBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    modalSaveBtn: { backgroundColor: c.accent },
    modalCancel: { color: c.muted, fontWeight: '600' },
    modalSave: { color: '#fff', fontWeight: '700' },
  });
}
