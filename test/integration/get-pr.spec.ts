import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateAll } from './helpers/db-cleaner';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

async function logEntry(
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

describe('GET /workouts/pr', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 — no data returns empty data array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
  });

  it('200 — returns array with one entry per exercise', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);
    await logEntry(app, USER_ID, '2024-01-15', 'Squat', [{ reps: 3, weight: 120, unit: 'kg' }]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    const names = res.body.data.map((e: any) => e.exerciseName);
    expect(names).toContain('Bench Press');
    expect(names).toContain('Squat');
  });

  it('200 — prs has maxWeight, maxVolume, bestOneRM', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
      { reps: 3, weight: 120, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.prs.maxWeight).not.toBeNull();
    expect(bench.prs.maxVolume).not.toBeNull();
    expect(bench.prs.bestOneRM).not.toBeNull();
  });

  it('200 — maxWeight picks the heaviest set', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
      { reps: 1, weight: 140, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.prs.maxWeight.value).toBe(140);
  });

  it('200 — each PR value includes achievedAt date', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.prs.maxWeight.achievedAt).toBe('2024-01-15');
  });

  it('200 — returns weights in requested unit (lb)', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}&unit=lb`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.prs.maxWeight.value).toBeCloseTo(220.46, 0);
    expect(bench.prs.maxWeight.unit).toBe('lb');
  });

  it('200 — bestOneRM uses Epley formula (100kg × 5 reps ≈ 116.67)', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    // Epley: 100 * (1 + 5/30) = 116.6667
    expect(bench.prs.bestOneRM.value).toBeCloseTo(116.67, 1);
  });

  it('200 — compareTo=previousPeriod returns comparison object on each exercise', async () => {
    await logEntry(app, USER_ID, '2024-01-01', 'Bench Press', [
      { reps: 5, weight: 90, unit: 'kg' },
    ]);
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}&from=2024-01-08&to=2024-01-20&compareTo=previousPeriod`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.comparison).toBeDefined();
    expect(bench.comparison.period).toBeDefined();
    expect(bench.comparison.prevPeriod).toBeDefined();
  });

  it('200 — filters by exerciseName returns only matching exercise', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);
    await logEntry(app, USER_ID, '2024-01-15', 'Squat', [{ reps: 3, weight: 200, unit: 'kg' }]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}&exerciseName=Bench Press`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].exerciseName).toBe('Bench Press');
    expect(res.body.data[0].prs.maxWeight.value).toBe(100);
  });

  it('200 — filters by date range', async () => {
    await logEntry(app, USER_ID, '2024-01-01', 'Bench Press', [
      { reps: 5, weight: 80, unit: 'kg' },
    ]);
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}&from=2024-01-10&to=2024-01-20`)
      .expect(200);

    const bench = res.body.data.find((e: any) => e.exerciseName === 'Bench Press');
    expect(bench.prs.maxWeight.value).toBe(100);
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts/pr');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid userId (not UUID format) returns 400', async () => {
    const res = await request(app.getHttpServer()).get('/workouts/pr?userId=not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid unit enum (unit=stone) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts/pr?userId=${USER_ID}&unit=stone`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid compareTo enum (compareTo=bogus) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/pr?userId=${USER_ID}&compareTo=bogus`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (from=not-a-date) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/pr?userId=${USER_ID}&from=not-a-date`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (to=bogus) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts/pr?userId=${USER_ID}&to=bogus`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('200 — from > to (inverted range) returns 200 with empty data array', async () => {
    await logEntry(app, USER_ID, '2024-01-15', 'Bench Press', [
      { reps: 5, weight: 100, unit: 'kg' },
    ]);

    const res = await request(app.getHttpServer())
      .get(`/workouts/pr?userId=${USER_ID}&from=2024-02-01&to=2024-01-01`)
      .expect(200);

    expect(res.body.data).toEqual([]);
  });
});
