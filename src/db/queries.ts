import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  Session,
  WorkoutSet,
  ExerciseStat,
  ActiveExercise,
} from '../types';

// ── Exercises ──────────────────────────────────────────────────────────────

export async function getExercises(
  db: SQLiteDatabase,
  search = '',
  equipment = '',
  muscles: string[] = []
): Promise<Exercise[]> {
  let query = 'SELECT * FROM exercises WHERE 1=1';
  const params: string[] = [];

  if (search.trim()) {
    query += ' AND name LIKE ?';
    params.push(`%${search.trim()}%`);
  }
  if (equipment) {
    query += ' AND equipment = ?';
    params.push(equipment);
  }
  if (muscles.length > 0) {
    const clauses = muscles
      .map(() => '(primary_muscles LIKE ? OR secondary_muscles LIKE ?)')
      .join(' OR ');
    query += ` AND (${clauses})`;
    for (const m of muscles) {
      params.push(`%${m}%`, `%${m}%`);
    }
  }
  query += ' ORDER BY name ASC LIMIT 200';
  return db.getAllAsync<Exercise>(query, params);
}

export async function getExerciseById(
  db: SQLiteDatabase,
  id: string
): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
}

export async function createCustomExercise(
  db: SQLiteDatabase,
  p: {
    name: string;
    equipment: string | null;
    category: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }
): Promise<Exercise> {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const primary = JSON.stringify(p.primaryMuscles);
  const secondary = JSON.stringify(p.secondaryMuscles);
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, equipment, category, force, level, mechanic, primary_muscles, secondary_muscles, instructions, is_custom)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, '[]', 1)`,
    [id, p.name, p.equipment, p.category, primary, secondary]
  );
  return {
    id,
    name: p.name,
    equipment: p.equipment,
    category: p.category,
    force: null,
    level: null,
    mechanic: null,
    primary_muscles: primary,
    secondary_muscles: secondary,
    instructions: '[]',
    is_custom: 1,
  };
}

// Deletes a user-created exercise only (app-seeded exercises are protected).
// Returns false if the exercise doesn't exist or isn't custom.
export async function deleteExercise(
  db: SQLiteDatabase,
  id: string
): Promise<boolean> {
  const row = await db.getFirstAsync<{ is_custom: number }>(
    'SELECT is_custom FROM exercises WHERE id = ?',
    [id]
  );
  if (!row || row.is_custom !== 1) return false;
  await db.runAsync('DELETE FROM routine_exercises WHERE exercise_id = ?', [id]);
  await db.runAsync('DELETE FROM sets WHERE exercise_id = ?', [id]);
  await db.runAsync('DELETE FROM exercise_notes WHERE exercise_id = ?', [id]);
  await db.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
  return true;
}

// Re-point a single session's logged sets from one exercise to another.
export async function moveSessionSets(
  db: SQLiteDatabase,
  sessionId: number,
  fromExerciseId: string,
  toExerciseId: string
): Promise<void> {
  await db.runAsync(
    'UPDATE sets SET exercise_id = ? WHERE session_id = ? AND exercise_id = ?',
    [toExerciseId, sessionId, fromExerciseId]
  );
}

export async function getEquipmentList(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ equipment: string }>(
    'SELECT DISTINCT equipment FROM exercises WHERE equipment IS NOT NULL ORDER BY equipment'
  );
  return rows.map((r) => r.equipment);
}

export async function getMuscleList(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ primary_muscles: string }>(
    'SELECT DISTINCT primary_muscles FROM exercises WHERE primary_muscles IS NOT NULL'
  );
  const set = new Set<string>();
  for (const row of rows) {
    try {
      const arr: string[] = JSON.parse(row.primary_muscles);
      arr.forEach((m) => set.add(m));
    } catch {}
  }
  return Array.from(set).sort();
}

// ── Routines ───────────────────────────────────────────────────────────────

export async function getRoutines(db: SQLiteDatabase): Promise<Routine[]> {
  return db.getAllAsync<Routine>('SELECT * FROM routines ORDER BY position ASC, updated_at DESC');
}

export async function reorderRoutines(
  db: SQLiteDatabase,
  orderedIds: number[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync('UPDATE routines SET position = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export async function getRoutineById(
  db: SQLiteDatabase,
  id: number
): Promise<Routine | null> {
  return db.getFirstAsync<Routine>('SELECT * FROM routines WHERE id = ?', [id]);
}

export async function createRoutine(
  db: SQLiteDatabase,
  name: string
): Promise<number> {
  const row = await db.getFirstAsync<{ max_pos: number | null }>(
    'SELECT MAX(position) AS max_pos FROM routines'
  );
  const nextPos = (row?.max_pos ?? -1) + 1;
  const result = await db.runAsync(
    'INSERT INTO routines (name, position) VALUES (?, ?)',
    [name, nextPos]
  );
  return result.lastInsertRowId;
}

export async function updateRoutineName(
  db: SQLiteDatabase,
  id: number,
  name: string
): Promise<void> {
  await db.runAsync(
    "UPDATE routines SET name = ?, updated_at = datetime('now') WHERE id = ?",
    [name, id]
  );
}

export async function deleteRoutine(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM routines WHERE id = ?', [id]);
}

// ── Routine Exercises ──────────────────────────────────────────────────────

export async function getRoutineExercises(
  db: SQLiteDatabase,
  routineId: number
): Promise<RoutineExercise[]> {
  return db.getAllAsync<RoutineExercise>(
    `SELECT re.*, e.name AS exercise_name, e.equipment, e.primary_muscles
     FROM routine_exercises re
     JOIN exercises e ON e.id = re.exercise_id
     WHERE re.routine_id = ?
     ORDER BY re.position ASC`,
    [routineId]
  );
}

export async function addExerciseToRoutine(
  db: SQLiteDatabase,
  routineId: number,
  exerciseId: string
): Promise<void> {
  const row = await db.getFirstAsync<{ max_pos: number | null }>(
    'SELECT MAX(position) AS max_pos FROM routine_exercises WHERE routine_id = ?',
    [routineId]
  );
  const nextPos = (row?.max_pos ?? -1) + 1;
  await db.runAsync(
    'INSERT INTO routine_exercises (routine_id, exercise_id, position) VALUES (?, ?, ?)',
    [routineId, exerciseId, nextPos]
  );
  await db.runAsync(
    "UPDATE routines SET updated_at = datetime('now') WHERE id = ?",
    [routineId]
  );
}

export async function removeExerciseFromRoutine(
  db: SQLiteDatabase,
  routineExerciseId: number,
  routineId: number
): Promise<void> {
  await db.runAsync('DELETE FROM routine_exercises WHERE id = ?', [routineExerciseId]);
  // Reorder remaining
  const remaining = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM routine_exercises WHERE routine_id = ? ORDER BY position ASC',
    [routineId]
  );
  for (let i = 0; i < remaining.length; i++) {
    await db.runAsync(
      'UPDATE routine_exercises SET position = ? WHERE id = ?',
      [i, remaining[i].id]
    );
  }
}

// Replace a routine's exercise list with the given ordered items (idempotent).
// Each item carries its target set count so routines remember sets-per-exercise.
export async function syncRoutineExercises(
  db: SQLiteDatabase,
  routineId: number,
  items: { exercise_id: string; sets: number }[]
): Promise<void> {
  await db.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', [routineId]);
  for (let i = 0; i < items.length; i++) {
    await db.runAsync(
      'INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets) VALUES (?, ?, ?, ?)',
      [routineId, items[i].exercise_id, i, Math.max(1, items[i].sets)]
    );
  }
  await db.runAsync(
    "UPDATE routines SET updated_at = datetime('now') WHERE id = ?",
    [routineId]
  );
}

export async function reorderRoutineExercises(
  db: SQLiteDatabase,
  orderedIds: number[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.runAsync(
      'UPDATE routine_exercises SET position = ? WHERE id = ?',
      [i, orderedIds[i]]
    );
  }
}

// ── Sessions ───────────────────────────────────────────────────────────────

export async function createSession(
  db: SQLiteDatabase,
  date: string,
  routineId: number | null
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO sessions (date, routine_id) VALUES (?, ?)',
    [date, routineId]
  );
  return result.lastInsertRowId;
}

export async function endSession(db: SQLiteDatabase, sessionId: number): Promise<void> {
  await db.runAsync(
    "UPDATE sessions SET ended_at = datetime('now') WHERE id = ?",
    [sessionId]
  );
}

export async function renameSession(
  db: SQLiteDatabase,
  id: number,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  await db.runAsync('UPDATE sessions SET name = ? WHERE id = ?', [
    trimmed === '' ? null : trimmed,
    id,
  ]);
}

export async function deleteSession(db: SQLiteDatabase, id: number): Promise<void> {
  // Remove logged sets first (defensive — also covered by ON DELETE CASCADE).
  await db.runAsync('DELETE FROM sets WHERE session_id = ?', [id]);
  await db.runAsync('DELETE FROM sessions WHERE id = ?', [id]);
}

export async function getSessionDates(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM sessions ORDER BY date'
  );
  return rows.map((r) => r.date);
}

export async function getSessionsForDate(
  db: SQLiteDatabase,
  date: string
): Promise<Session[]> {
  return db.getAllAsync<Session>('SELECT * FROM sessions WHERE date = ? ORDER BY started_at', [date]);
}

export async function getSessionDetail(
  db: SQLiteDatabase,
  sessionId: number
): Promise<{ exercise_id: string; exercise_name: string; set_number: number; weight: number; reps: number }[]> {
  return db.getAllAsync(
    `SELECT s.exercise_id, e.name AS exercise_name, s.set_number, s.weight, s.reps
     FROM sets s
     JOIN exercises e ON e.id = s.exercise_id
     WHERE s.session_id = ?
     ORDER BY s.exercise_id, s.set_number`,
    [sessionId]
  );
}

// ── Sets ───────────────────────────────────────────────────────────────────

export async function logSet(
  db: SQLiteDatabase,
  sessionId: number,
  exerciseId: string,
  setNumber: number,
  weight: number,
  reps: number
): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO sets (session_id, exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?, ?)',
    [sessionId, exerciseId, setNumber, weight, reps]
  );
  return result.lastInsertRowId;
}

export async function deleteSet(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sets WHERE id = ?', [id]);
}

export async function getLastSessionSets(
  db: SQLiteDatabase,
  exerciseId: string,
  currentSessionId: number
): Promise<{ set_number: number; weight: number; reps: number }[]> {
  return db.getAllAsync(
    `SELECT s.set_number, s.weight, s.reps
     FROM sets s
     WHERE s.exercise_id = ?
       AND s.session_id != ?
       AND s.session_id = (
         SELECT session_id FROM sets
         WHERE exercise_id = ? AND session_id != ?
         ORDER BY logged_at DESC
         LIMIT 1
       )
     ORDER BY s.set_number`,
    [exerciseId, currentSessionId, exerciseId, currentSessionId]
  );
}

export async function getLastSet(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<{ weight: number; reps: number } | null> {
  return db.getFirstAsync<{ weight: number; reps: number }>(
    'SELECT weight, reps FROM sets WHERE exercise_id = ? ORDER BY logged_at DESC LIMIT 1',
    [exerciseId]
  );
}

// Best Epley 1RM ever logged for an exercise across all sessions.
export async function getBest1RM(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<number | null> {
  const row = await db.getFirstAsync<{ best: number | null }>(
    'SELECT MAX(weight * (1 + reps / 30.0)) AS best FROM sets WHERE exercise_id = ?',
    [exerciseId]
  );
  return row?.best ?? null;
}

export async function getExerciseStat(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<ExerciseStat> {
  const last = await db.getFirstAsync<{ weight: number; reps: number }>(
    'SELECT weight, reps FROM sets WHERE exercise_id = ? ORDER BY logged_at DESC LIMIT 1',
    [exerciseId]
  );
  const best = await db.getFirstAsync<{ best_weight: number; best_1rm: number }>(
    `SELECT MAX(weight) AS best_weight,
            MAX(weight * (1 + reps / 30.0)) AS best_1rm
     FROM sets WHERE exercise_id = ?`,
    [exerciseId]
  );
  return {
    last_weight: last?.weight ?? null,
    last_reps: last?.reps ?? null,
    best_weight: best?.best_weight ?? null,
    best_1rm: best?.best_1rm ?? null,
  };
}

export interface ExerciseHistoryPoint {
  date: string;
  session_id: number;
  max_weight: number;
  volume: number;
  best_1rm: number;
}

export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<ExerciseHistoryPoint[]> {
  return db.getAllAsync<ExerciseHistoryPoint>(
    `SELECT
       s.date,
       s.id AS session_id,
       MAX(st.weight) AS max_weight,
       SUM(st.weight * st.reps) AS volume,
       MAX(st.weight * (1 + st.reps / 30.0)) AS best_1rm
     FROM sets st
     JOIN sessions s ON s.id = st.session_id
     WHERE st.exercise_id = ?
     GROUP BY s.id
     ORDER BY s.date ASC, s.started_at ASC`,
    [exerciseId]
  );
}

export async function getSetsForSession(
  db: SQLiteDatabase,
  sessionId: number
): Promise<WorkoutSet[]> {
  return db.getAllAsync<WorkoutSet>(
    'SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_number',
    [sessionId]
  );
}

// ── Active Session (in-progress workout, survives reloads) ──────────────────

export interface PersistedSession {
  sessionId: number;
  routineId: number | null;
  exercises: ActiveExercise[];
  durationPaused: boolean;
  durationPausedMs: number;
  durationPausedAt: number | null;
}

export async function saveActiveSession(
  db: SQLiteDatabase,
  data: PersistedSession
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO active_session (id, data, updated_at)
     VALUES (1, ?, datetime('now'))`,
    [JSON.stringify(data)]
  );
}

export async function loadActiveSession(
  db: SQLiteDatabase
): Promise<PersistedSession | null> {
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM active_session WHERE id = 1'
  );
  if (!row) return null;
  try {
    return JSON.parse(row.data) as PersistedSession;
  } catch {
    return null;
  }
}

export async function clearActiveSession(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM active_session WHERE id = 1');
}

// ── Exercise Notes ─────────────────────────────────────────────────────────

export async function getExerciseNote(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<string> {
  const row = await db.getFirstAsync<{ note: string }>(
    'SELECT note FROM exercise_notes WHERE exercise_id = ?',
    [exerciseId]
  );
  return row?.note ?? '';
}

export async function setExerciseNote(
  db: SQLiteDatabase,
  exerciseId: string,
  note: string
): Promise<void> {
  if (note.trim() === '') {
    await db.runAsync('DELETE FROM exercise_notes WHERE exercise_id = ?', [exerciseId]);
    return;
  }
  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_notes (exercise_id, note, updated_at)
     VALUES (?, ?, datetime('now'))`,
    [exerciseId, note]
  );
}

// ── Favorites (equipment / muscle chips) ───────────────────────────────────

export type FavoriteKey = 'fav_equipment' | 'fav_muscle' | 'fav_exercises';

export async function getFavorites(
  db: SQLiteDatabase,
  key: FavoriteKey
): Promise<string[]> {
  const raw = await getSetting(db, key);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}

export async function setFavorites(
  db: SQLiteDatabase,
  key: FavoriteKey,
  values: string[]
): Promise<void> {
  await setSetting(db, key, JSON.stringify(values));
}

// Favorited items first (preserving the input order within each group).
export function orderByFavorites(list: string[], favs: string[]): string[] {
  const favSet = new Set(favs);
  const favored = list.filter((x) => favSet.has(x));
  const rest = list.filter((x) => !favSet.has(x));
  return [...favored, ...rest];
}

// Same as orderByFavorites but for Exercise objects keyed by id.
export function orderExercisesByFavorites(exercises: Exercise[], favIds: string[]): Exercise[] {
  const favSet = new Set(favIds);
  return [
    ...exercises.filter((e) => favSet.has(e.id)),
    ...exercises.filter((e) => !favSet.has(e.id)),
  ];
}

// ── Settings ───────────────────────────────────────────────────────────────

export async function getSetting(
  db: SQLiteDatabase,
  key: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
}
