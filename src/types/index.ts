export interface Exercise {
  id: string;
  name: string;
  equipment: string | null;
  category: string | null;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  primary_muscles: string; // JSON array as text
  secondary_muscles: string; // JSON array as text
  instructions: string; // JSON array as text
  is_custom: number; // 1 for user-created exercises, 0 for app-seeded
}

export interface Routine {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface RoutineExercise {
  id: number;
  routine_id: number;
  exercise_id: string;
  position: number;
  target_sets: number;
  // joined fields
  exercise_name?: string;
  equipment?: string | null;
  primary_muscles?: string;
}

export interface Session {
  id: number;
  routine_id: number | null;
  date: string;
  name: string | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  logged_at: string;
}

export interface ExerciseStat {
  last_weight: number | null;
  last_reps: number | null;
  best_weight: number | null;
  best_1rm: number | null;
}

export interface ActiveSet {
  id?: number; // DB row id once logged, used to delete a saved set
  exercise_id: string;
  exercise_name: string;
  set_number: number;
  weight: string;
  reps: string;
  saved: boolean;
}

export interface ActiveExercise {
  exercise_id: string;
  exercise_name: string;
  note?: string;
  sets: ActiveSet[];
}

export type Units = 'kg' | 'lbs';
