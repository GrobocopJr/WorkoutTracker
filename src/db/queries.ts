import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Exercise,
  Routine,
  RoutineExercise,
  Session,
  WorkoutSet,
  ExerciseStat,
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
  return db.getAllAsync<Routine>('SELECT * FROM routines ORDER BY updated_at DESC');
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
  const result = await db.runAsync(
    'INSERT INTO routines (name) VALUES (?)',
    [name]
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
): Promise<{ exercise_name: string; set_number: number; weight: number; reps: number }[]> {
  return db.getAllAsync(
    `SELECT e.name AS exercise_name, s.set_number, s.weight, s.reps
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

export async function getLastSet(
  db: SQLiteDatabase,
  exerciseId: string
): Promise<{ weight: number; reps: number } | null> {
  return db.getFirstAsync<{ weight: number; reps: number }>(
    'SELECT weight, reps FROM sets WHERE exercise_id = ? ORDER BY logged_at DESC LIMIT 1',
    [exerciseId]
  );
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

export async function getSetsForSession(
  db: SQLiteDatabase,
  sessionId: number
): Promise<WorkoutSet[]> {
  return db.getAllAsync<WorkoutSet>(
    'SELECT * FROM sets WHERE session_id = ? ORDER BY exercise_id, set_number',
    [sessionId]
  );
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
