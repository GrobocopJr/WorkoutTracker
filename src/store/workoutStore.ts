import { create } from 'zustand';
import type { ActiveExercise } from '../types';

interface WorkoutState {
  sessionId: number | null;
  exercises: ActiveExercise[];
  timerSeconds: number;
  timerRunning: boolean;
  timerDefault: number;

  startSession: (sessionId: number, exercises: ActiveExercise[]) => void;
  endSession: () => void;
  addExercise: (exercise: ActiveExercise) => void;
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
  exercises: [],
  timerSeconds: 0,
  timerRunning: false,
  timerDefault: 90,

  startSession: (sessionId, exercises) =>
    set({ sessionId, exercises, timerSeconds: 0, timerRunning: false }),

  endSession: () =>
    set({ sessionId: null, exercises: [], timerSeconds: 0, timerRunning: false }),

  addExercise: (exercise) =>
    set((state) => ({ exercises: [...state.exercises, exercise] })),

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
