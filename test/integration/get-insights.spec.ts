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

  it('200 — empty data: returns { period, insights: [] }', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.period).toBeDefined();
    expect(res.body.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.insights).toEqual([]);
    expect(res.body.meta).toBeDefined();
  });

  it('200 — returns all 4 insight types with { name, data } shape', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-02-01`)
      .expect(200);

    const names = res.body.insights.map((i: any) => i.name);
    expect(names).toContain('mostTrained');
    expect(names).toContain('trainingFrequency');
    expect(names).toContain('muscleGroupBalance');
    expect(names).toContain('gaps');

    for (const insight of res.body.insights) {
      expect(insight.name).toBeDefined();
      expect(insight.data).toBeDefined();
    }
  });

  it('200 — period reflects from/to query params', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-01-31`)
      .expect(200);

    expect(res.body.period).toEqual({ from: '2024-01-01', to: '2024-01-31' });
  });

  it('200 — mostTrained insight has byFrequency and byVolume arrays', async () => {
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
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-02-01`)
      .expect(200);

    const mostTrained = res.body.insights.find((i: any) => i.name === 'mostTrained');
    expect(mostTrained).toBeDefined();
    expect(Array.isArray(mostTrained.data.byFrequency)).toBe(true);
    expect(Array.isArray(mostTrained.data.byVolume)).toBe(true);

    const bench = mostTrained.data.byFrequency.find((e: any) => e.exercise === 'Bench Press');
    expect(bench.sessionCount).toBe(2);
  });

  it('200 — trainingFrequency insight has totalSessions and weeksAnalyzed', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
      { exerciseName: 'Squat', sets: [{ reps: 3, weight: 150, unit: 'kg' }] },
    ]);
    await logWorkout(app, '2024-01-16', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-02-01`)
      .expect(200);

    const freq = res.body.insights.find((i: any) => i.name === 'trainingFrequency');
    expect(freq).toBeDefined();
    expect(freq.data.totalSessions).toBe(2);
    expect(freq.data.weeksAnalyzed).toBeDefined();
  });

  it('200 — muscleGroupBalance insight has distribution and warnings', async () => {
    await logWorkout(app, '2024-01-15', [
      { exerciseName: 'Bench Press', sets: [{ reps: 10, weight: 100, unit: 'kg' }] }, // chest: 1000
      { exerciseName: 'Squat', sets: [{ reps: 10, weight: 100, unit: 'kg' }] }, // legs: 1000
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-02-01`)
      .expect(200);

    const balance = res.body.insights.find((i: any) => i.name === 'muscleGroupBalance');
    expect(balance).toBeDefined();
    expect(balance.data.distribution).toBeDefined();
    expect(Array.isArray(balance.data.warnings)).toBe(true);
    expect(balance.data.distribution.chest).toBeCloseTo(50, 0);
    expect(balance.data.distribution.legs).toBeCloseTo(50, 0);
  });

  it('200 — gaps insight has exercises array with name and lastSeenDaysAgo', async () => {
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

    // Query with explicit from/to so the window contains all 3 entries
    // and to=2024-02-15 is 31 days after the last session
    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}&from=2024-01-01&to=2024-02-15`)
      .expect(200);

    const gaps = res.body.insights.find((i: any) => i.name === 'gaps');
    expect(gaps).toBeDefined();
    expect(Array.isArray(gaps.data.exercises)).toBe(true);
    expect(gaps.data.exercises).toHaveLength(1);
    expect(gaps.data.exercises[0].name).toBe('Bench Press');
    expect(gaps.data.exercises[0].lastSeenDaysAgo).toBe(31);
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts/insights');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid userId (not UUID format) returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts/insights?userId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (from=not-a-date) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/insights?userId=${USER_ID}&from=not-a-date`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (to=bogus) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/insights?userId=${USER_ID}&to=bogus`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('200 — default period (no from/to) excludes data older than 30 days', async () => {
    // Log one entry far in the past (outside 30-day window) and one recent entry
    await logWorkout(app, '2020-01-01', [
      { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/insights?userId=${USER_ID}`)
      .expect(200);

    // The 2020 entry is outside the 30-day default window — insights should be empty
    expect(res.body.insights).toEqual([]);
  });
});
