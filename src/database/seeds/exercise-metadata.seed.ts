import { AppDataSource } from '@src/database/data-source';

const SEED_DATA = [
  { name: 'Bench Press', muscleGroup: 'push', aliases: ['bench'] },
  { name: 'Overhead Press', muscleGroup: 'push', aliases: ['ohp', 'shoulder press'] },
  { name: 'Pull-Up', muscleGroup: 'pull', aliases: ['pullup', 'chin-up'] },
  { name: 'Barbell Row', muscleGroup: 'pull', aliases: ['row'] },
  { name: 'Deadlift', muscleGroup: 'legs', aliases: ['dl'] },
  { name: 'Squat', muscleGroup: 'legs', aliases: ['back squat'] },
  { name: 'Romanian Deadlift', muscleGroup: 'legs', aliases: ['rdl'] },
  { name: 'Lat Pulldown', muscleGroup: 'pull', aliases: [] },
  { name: 'Dumbbell Curl', muscleGroup: 'pull', aliases: ['bicep curl'] },
  { name: 'Tricep Pushdown', muscleGroup: 'push', aliases: ['tricep extension'] },
  { name: 'Leg Press', muscleGroup: 'legs', aliases: [] },
  { name: 'Incline Bench Press', muscleGroup: 'push', aliases: ['incline bench'] },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();

  const runner = AppDataSource.createQueryRunner();
  await runner.connect();

  try {
    console.log('Seeding exercise_metadata...');

    for (const row of SEED_DATA) {
      await runner.query(
        `INSERT INTO "exercise_metadata" ("name", "muscle_group", "aliases")
         VALUES ($1, $2, $3)
         ON CONFLICT ("name") DO NOTHING`,
        [row.name, row.muscleGroup, row.aliases],
      );
    }

    console.log(`Seeded ${SEED_DATA.length} exercises.`);
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
