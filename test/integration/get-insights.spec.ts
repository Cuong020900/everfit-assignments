import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateAll } from './helpers/db-cleaner';
import { seedExerciseMetadata } from './helpers/seed';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function logWorkout(
  app: INestApplication,
  date: string,
  entries: { exerciseName: string; sets: { reps: number; weight: number; unit: string }[] }[],
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/workouts?userId=${USER_ID}`)
    .send({ date, entries })
    .expect(201);
}

describe('GET /workouts/insights', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
    await seedExerciseMetadata(dataSource);
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 — empty data: all insights return empty/zero values', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.data.mostTrained).toEqual([]);
    expect(res.body.data.trainingFrequency.totalSessions).toBe(0);
    expect(res.body.data.muscleGroupBalance).toEqual({});
    expect(res.body.data.gaps).toEqual([]);
    expect(res.body.meta).toBeDefined();
  });

  it('200 — returns all 4 insight types', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.data).toHaveProperty('mostTrained');
    expect(res.body.data).toHaveProperty('trainingFrequency');
    expect(res.body.data).toHaveProperty('muscleGroupBalance');
    expect(res.body.data).toHaveProperty('gaps');
  });

  it('200 — mostTrained sorted by session count desc', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-16', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Squat', sets: [{ reps: 3, weight: 150, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    const mostTrained = res.body.data.mostTrained;
    expect(mostTrained[0].exerciseName).toBe('Bench Press');
    expect(mostTrained[0].sessions).toBe(2);
    expect(mostTrained[1].exerciseName).toBe('Squat');
    expect(mostTrained[1].sessions).toBe(1);
  });

  it('200 — trainingFrequency totalSessions counts unique dates', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
      { exerciseName: 'Squat', sets: [{ reps: 3, weight: 150, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-16', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.data.trainingFrequency.totalSessions).toBe(2);
  });

  it('200 — muscleGroupBalance uses exercise_metadata mapping', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 10, weight: 100, unit: 'kg' }] }, // chest: 1000
      { exerciseName: 'Squat', sets: [{ reps: 10, weight: 100, unit: 'kg' }] }, // legs: 1000
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    const balance = res.body.data.muscleGroupBalance;
    expect(balance.chest).toBeCloseTo(50, 0);
    expect(balance.legs).toBeCloseTo(50, 0);
  });

  it('200 — gaps identifies exercises not done in 2+ weeks', async () => {
    // Bench Press: 3 sessions in Jan, last done Jan 15
    await logWorkout(app, '2024-01-01', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-08', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    // Query with to=2024-02-15 (31 days after last session)
    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&to=2024-02-15`)
      .expect(200);

    const gaps = res.body.data.gaps;
    expect(gaps).toHaveLength(1);
    expect(gaps[0].exerciseName).toBe('Bench Press');
    expect(gaps[0].daysSince).toBe(31);
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts/insights');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });
});
