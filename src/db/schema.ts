export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS exercises (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  equipment         TEXT,
  category          TEXT,
  force             TEXT,
  level             TEXT,
  mechanic          TEXT,
  primary_muscles   TEXT,
  secondary_muscles TEXT,
  instructions      TEXT
);

CREATE INDEX IF NOT EXISTS idx_exercises_name      ON exercises(name);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

CREATE TABLE IF NOT EXISTS routines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id  INTEGER NOT NULL REFERENCES routines(id)  ON DELETE CASCADE,
  exercise_id TEXT    NOT NULL REFERENCES exercises(id),
  position    INTEGER NOT NULL,
  UNIQUE(routine_id, position)
);

CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine ON routine_exercises(routine_id);

CREATE TABLE IF NOT EXISTS sessions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  date       TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at   TEXT,
  notes      TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);

CREATE TABLE IF NOT EXISTS sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  INTEGER NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  exercise_id TEXT    NOT NULL REFERENCES exercises(id),
  set_number  INTEGER NOT NULL,
  weight      REAL    NOT NULL,
  reps        INTEGER NOT NULL,
  logged_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sets_session  ON sets(session_id);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('default_rest_seconds', '90'),
  ('units', 'lbs'),
  ('seeded', '0'),
  ('theme', 'system');
`;
