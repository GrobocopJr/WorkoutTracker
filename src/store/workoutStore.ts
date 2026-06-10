import { create } from 'zustand';
import type { ActiveExercise } from '../types';

interface WorkoutState {
  sessionId: number | null;
  routineId: number | null;
  exercises: ActiveExercise[];
  timerSeconds: number;
  timerRunning: boolean;
  timerDefault: number;

  startSession: (
    sessionId: number,
    exercises: ActiveExercise[],
    routineId: number | null
  ) => void;
  endSession: () => void;
  addExercise: (exercise: ActiveExercise) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (exercises: ActiveExercise[]) => void;
  renameExercise: (exerciseId: string, name: string) => void;
  replaceExerciseId: (oldId: string, newId: string) => void;
  updateSet: (
    exerciseId: string,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string
  ) => void;
  markSetSaved: (exerciseId: string, setIndex: number, id?: number) => void;
  addSetToExercise: (exerciseId: string, exerciseName: string) => void;
  removeLastSet: (exerciseId: string) => void;
  setExerciseNote: (exerciseId: string, note: string) => void;
  startTimer: (seconds: number) => void;
  tickTimer: () => void;
  stopTimer: () => void;
  setTimerDefault: (seconds: number) => void;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  sessionId: null,
  routineId: null,
  exercises: [],
  timerSeconds: 0,
  timerRunning: false,
  timerDefault: 90,

  startSession: (sessionId, exercises, routineId) =>
    set({ sessionId, routineId, exercises, timerSeconds: 0, timerRunning: false }),

  endSession: () =>
    set({ sessionId: null, routineId: null, exercises: [], timerSeconds: 0, timerRunning: false }),

  addExercise: (exercise) =>
    set((state) => ({ exercises: [...state.exercises, exercise] })),

  removeExercise: (exerciseId) =>
    set((state) => ({
      exercises: state.exercises.filter((ex) => ex.exercise_id !== exerciseId),
    })),

  reorderExercises: (exercises) => set({ exercises }),

  renameExercise: (exerciseId, name) =>
    set((state) => ({
      exercises: state.exercises.map((ex) =>
        ex.exercise_id !== exerciseId
          ? ex
          : {
              ...ex,
              exercise_name: name,
              sets: ex.sets.map((s) => ({ ...s, exercise_name: name })),
            }
      ),
    })),

  replaceExerciseId: (oldId, newId) =>
    set((state) => ({
      exercises: state.exercises.map((ex) =>
        ex.exercise_id !== oldId
          ? ex
          : {
              ...ex,
              exercise_id: newId,
              sets: ex.sets.map((s) => ({ ...s, exercise_id: newId })),
            }
      ),
    })),

  updateSet: (exerciseId, setIndex, field, value) =>
    set((state) => ({
      exercises: state.exercises.map((ex) =>
        ex.exercise_id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, i) =>
                i !== setIndex ? s : { ...s, [field]: value }
              ),
            }
      ),
    })),

  markSetSaved: (exerciseId, setIndex, id) =>
    set((state) => ({
      exercises: state.exercises.map((ex) =>
        ex.exercise_id !== exerciseId
          ? ex
          : {
              ...ex,
              sets: ex.sets.map((s, i) =>
                i !== setIndex ? s : { ...s, saved: true, id: id ?? s.id }
              ),
            }
      ),
    })),

  addSetToExercise: (exerciseId, exerciseName) =>
    set((state) => ({
      exercises: state.exercises.map((ex) => {
        if (ex.exercise_id !== exerciseId) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              exercise_id: exerciseId,
              exercise_name: exerciseName,
              set_number: ex.sets.length + 1,
              weight: lastSet?.weight ?? '',
              reps: lastSet?.reps ?? '',
              saved: false,
            },
          ],
        };
      }),
    })),

  removeLastSet: (exerciseId) =>
    set((state) => ({
      exercises: state.exercises.map((ex) => {
        if (ex.exercise_id !== exerciseId || ex.sets.length <= 1) return ex;
        return { ...ex, sets: ex.sets.slice(0, -1) };
      }),
    })),

  setExerciseNote: (exerciseId, note) =>
    set((state) => ({
      exercises: state.exercises.map((ex) =>
        ex.exercise_id !== exerciseId ? ex : { ...ex, note }
      ),
    })),

  startTimer: (seconds) => set({ timerSeconds: seconds, timerRunning: true }),

  tickTimer: () => {
    const { timerSeconds } = get();
    if (timerSeconds <= 1) {
      set({ timerSeconds: 0, timerRunning: false });
    } else {
      set({ timerSeconds: timerSeconds - 1 });
    }
  },

  stopTimer: () => set({ timerSeconds: 0, timerRunning: false }),

  setTimerDefault: (seconds) => set({ timerDefault: seconds }),
}));
