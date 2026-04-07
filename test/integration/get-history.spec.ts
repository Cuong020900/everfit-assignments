import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateAll } from './helpers/db-cleaner';
import { seedExerciseMetadata } from './helpers/seed';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function logWorkout(
  app: INestApplication,
  userId: string,
  date: string,
  exerciseName: string,
  sets: { reps: number; weight: number; unit: string }[],
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/workouts?userId=${userId}`)
    .send({ date, entries: [{ exerciseName, sets }] })
    .expect(201);
}

describe('GET /workouts (history)', () => {
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

  it('200 — returns entries for the user', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}`).expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].exerciseName).toBe('Bench Press');
    expect(res.body.meta).toBeDefined();
  });

  it('200 — returns weights in kg by default', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}`).expect(200);
    expect(res.body.data[0].sets[0].weight).toBe(100);
    expect(res.body.data[0].sets[0].unit).toBe('kg');
  });

  it('200 — converts weights to lb when unit=lb', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&unit=lb`)
      .expect(200);

    expect(res.body.data[0].sets[0].weight).toBeCloseTo(220.46, 0);
    expect(res.body.data[0].sets[0].unit).toBe('lb');
  });

  it('200 — filters by exerciseName (partial match)', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);
    await logWorkout(app, USER_ID, '2024-01-15', 'Squat', [{ reps: 3, weight: 150, unit: 'kg' }]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&exerciseName=Bench`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].exerciseName).toBe('Bench Press');
  });

  it('200 — filters by date range (from/to)', async () => {
    await logWorkout(app, USER_ID, '2024-01-10', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);
    await logWorkout(app, USER_ID, '2024-01-20', 'Bench Press', [
      { reps: 5, weight: 105, unit: 'kg' },
    ]);
    await logWorkout(app, USER_ID, '2024-02-01', 'Bench Press', [
      { reps: 5, weight: 110, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&from=2024-01-15&to=2024-01-31`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].date).toBe('2024-01-20');
  });

  it('200 — filters by muscleGroup using exercise_metadata', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);
    await logWorkout(app, USER_ID, '2024-01-15', 'Squat', [{ reps: 3, weight: 150, unit: 'kg' }]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&muscleGroup=chest`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].exerciseName).toBe('Bench Press');
  });

  it('200 — pagination: returns nextCursor when more pages exist', async () => {
    for (let i = 1; i <= 5; i++) {
      await logWorkout(app, USER_ID, `2024-01-${String(i).padStart(2, '0')}`, 'Bench Press', [
        { reps: 5, weight: 100, unit: 'kg' },
      ]);
    }

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=3`)
      .expect(200);

    expect(res.body.pagination.hasMore).toBe(true);
    expect(res.body.pagination.nextCursor).not.toBeNull();
    expect(res.body.data).toHaveLength(3);
  });

  it('200 — pagination: nextCursor null on last page', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=10`)
      .expect(200);

    expect(res.body.pagination.nextCursor).toBeNull();
    expect(res.body.pagination.hasMore).toBe(false);
  });

  it('200 — pagination: fetching with cursor returns correct next page', async () => {
    for (let i = 1; i <= 4; i++) {
      await logWorkout(app, USER_ID, `2024-01-${String(i).padStart(2, '0')}`, 'Bench Press', [
        { reps: i, weight: 100, unit: 'kg' },
      ]);
    }

    const page1 = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=2`)
      .expect(200);

    const cursor = page1.body.pagination.nextCursor;
    expect(cursor).not.toBeNull();

    const page2 = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=2&cursor=${cursor}`)
      .expect(200);

    expect(page2.body.data).toHaveLength(2);
    // Combined, should cover all 4 entries with no overlap
    const allDates = [...page1.body.data, ...page2.body.data].map((e: { date: string }) => e.date);
    expect(new Set(allDates).size).toBe(4);
  });

  it('200 — empty result returns { data: [], pagination: { nextCursor: null } }', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}`).expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.nextCursor).toBeNull();
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — limit > 100 returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}&limit=101`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid userId (not UUID format) returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts?userId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid unit enum (unit=stone) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}&unit=stone`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (from=15-01-2024) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts?userId=${USER_ID}&from=15-01-2024`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (to=not-a-date) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}&to=not-a-date`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — limit=0 (below @Min(1)) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}&limit=0`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('200 — limit=1 (exact minimum boundary) returns 200', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=1`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
  });

  it('200 — limit=100 (exact maximum boundary) returns 200', async () => {
    for (let i = 1; i <= 100; i++) {
      await logWorkout(
        app,
        USER_ID,
        `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
        `Exercise ${i}`,
        [{ reps: 5, weight: 100, unit: 'kg' }],
      );
    }

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&limit=100`)
      .expect(200);

    expect(res.body.data.length).toBeLessThanOrEqual(100);
  });

  it('400 — limit=abc (non-numeric string) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts?userId=${USER_ID}&limit=abc`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('200 — data isolation: User B cannot see User A entries', async () => {
    const USER_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const USER_B = 'f1f2f3f4-e5f6-7890-abcd-ef1234567890';

    await logWorkout(app, USER_A, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const resA = await request(app.getHttpServer()).get(`/workouts?userId=${USER_A}`).expect(200);
    const resB = await request(app.getHttpServer()).get(`/workouts?userId=${USER_B}`).expect(200);

    expect(resA.body.data).toHaveLength(1);
    expect(resB.body.data).toHaveLength(0);
  });

  it('200 — from > to (inverted range) returns 200 with empty results', async () => {
    await logWorkout(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&from=2024-02-01&to=2024-01-01`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.nextCursor).toBeNull();
  });
});
