import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateAll } from './helpers/db-cleaner';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const EXERCISE = 'Bench Press';

async function logEntry(
  app: INestApplication,
  date: string,
  weight: number,
  reps = 5,
): Promise<void> {
  await request(app.getHttpServer())
    .post(`/workouts?userId=${USER_ID}`)
    .send({ date, entries: [{ exerciseName: EXERCISE, sets: [{ reps, weight, unit: 'kg' }] }] })
    .expect(201);
}

describe('GET /workouts/progress', () => {
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

  it('200 — empty range returns { series: [], note: null }', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.data.series).toEqual([]);
    expect(res.body.data.note).toBeNull();
  });

  it('200 — daily groupBy: one point per day', async () => {
    await logEntry(app, '2024-01-15', 100);
    await logEntry(app, '2024-01-16', 105);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=daily`,
      )
      .expect(200);

    expect(res.body.data.series).toHaveLength(2);
    expect(res.body.data.series[0].period).toBe('2024-01-15');
    expect(res.body.data.series[0].bestWeight).toBe(100);
    expect(res.body.data.groupBy).toBe('daily');
  });

  it('200 — volume trend included per period', async () => {
    await logEntry(app, '2024-01-15', 100, 5); // volume = 500

    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.data.series[0].volume).toBe(500);
  });

  it('200 — weekly groupBy: aggregates days into weeks', async () => {
    await logEntry(app, '2024-01-15', 100); // Week 3
    await logEntry(app, '2024-01-17', 105); // Week 3
    await logEntry(app, '2024-01-22', 110); // Week 4

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=weekly`,
      )
      .expect(200);

    expect(res.body.data.series).toHaveLength(2);
    expect(res.body.data.groupBy).toBe('weekly');
    expect(res.body.data.series[0].period).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('200 — monthly groupBy: aggregates days into months', async () => {
    await logEntry(app, '2024-01-15', 100);
    await logEntry(app, '2024-02-10', 110);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=monthly`,
      )
      .expect(200);

    expect(res.body.data.series).toHaveLength(2);
    expect(res.body.data.series[0].period).toBe('2024-01');
    expect(res.body.data.series[1].period).toBe('2024-02');
  });

  it('200 — returns weight in requested unit (lb)', async () => {
    await logEntry(app, '2024-01-15', 100);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&unit=lb`,
      )
      .expect(200);

    expect(res.body.data.series[0].bestWeight).toBeCloseTo(220.46, 0);
    expect(res.body.data.series[0].unit).toBe('lb');
  });

  it('200 — single data point returns series with note about insufficient data', async () => {
    await logEntry(app, '2024-01-15', 100);

    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.data.series).toHaveLength(1);
    expect(res.body.data.note).toBe('Insufficient data for trend analysis');
  });

  it('400 — missing exerciseName returns 400', async () => {
    const res = await request(app.getHttpServer()).get(`/workouts/progress?userId=${USER_ID}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?exerciseName=${encodeURIComponent(EXERCISE)}`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });
});
