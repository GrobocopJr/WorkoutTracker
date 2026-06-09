import type { SQLiteDatabase } from 'expo-sqlite';
import exercisesData from '../../assets/data/exercises.json';

interface RawExercise {
  id: string;
  name: string;
  equipment?: string;
  category?: string;
  force?: string;
  level?: string;
  mechanic?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
}

export async function seedExercisesIfNeeded(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'seeded'"
  );
  if (row?.value === '1') return;

  const exercises = exercisesData as RawExercise[];

  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const ex of exercises) {
      await tx.runAsync(
        `INSERT OR IGNORE INTO exercises
          (id, name, equipment, category, force, level, mechanic, primary_muscles, secondary_muscles, instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ex.id,
          ex.name,
          ex.equipment ?? null,
          ex.category ?? null,
          ex.force ?? null,
          ex.level ?? null,
          ex.mechanic ?? null,
          JSON.stringify(ex.primaryMuscles ?? []),
          JSON.stringify(ex.secondaryMuscles ?? []),
          JSON.stringify(ex.instructions ?? []),
        ]
      );
    }
    await tx.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('seeded', '1')"
    );
  });
}
