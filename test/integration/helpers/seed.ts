import type { DataSource } from 'typeorm';

export async function seedExerciseMetadata(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    INSERT INTO exercise_metadata (name, muscle_group, aliases)
    VALUES ('Bench Press', 'chest', '{}'),
           ('Squat', 'legs', '{}'),
           ('Pull-up', 'back', '{}')
    ON CONFLICT (name) DO NOTHING
  `);
}
