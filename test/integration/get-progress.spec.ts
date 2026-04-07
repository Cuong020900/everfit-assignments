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

  it('200 — empty range returns flat result with empty data and insufficientData=true', async () => {
    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.exerciseName).toBe(EXERCISE);
    expect(res.body.data).toEqual([]);
    expect(res.body.insufficientData).toBe(true);
  });

  it('200 — daily groupBy: one point per day', async () => {
    await logEntry(app, '2024-01-15', 100);
    await logEntry(app, '2024-01-16', 105);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=daily`,
      )
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].period).toBe('2024-01-15');
    expect(res.body.data[0].bestWeight).toBe(100);
    expect(res.body.groupBy).toBe('daily');
  });

  it('200 — volume trend included per period', async () => {
    await logEntry(app, '2024-01-15', 100, 5); // volume = 500

    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.data[0].volume).toBe(500);
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

    expect(res.body.data).toHaveLength(2);
    expect(res.body.groupBy).toBe('weekly');
    expect(res.body.data[0].period).toMatch(/^\d{4}-W\d{2}$/);
  });

  it('200 — monthly groupBy: aggregates days into months', async () => {
    await logEntry(app, '2024-01-15', 100);
    await logEntry(app, '2024-02-10', 110);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=monthly`,
      )
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].period).toBe('2024-01');
    expect(res.body.data[1].period).toBe('2024-02');
  });

  it('200 — returns weight in requested unit (lb)', async () => {
    await logEntry(app, '2024-01-15', 100);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&unit=lb`,
      )
      .expect(200);

    expect(res.body.data[0].bestWeight).toBeCloseTo(220.46, 0);
    expect(res.body.unit).toBe('lb');
  });

  it('200 — single data point returns insufficientData=true', async () => {
    await logEntry(app, '2024-01-15', 100);

    const res = await request(app.getHttpServer())
      .get(`/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.insufficientData).toBe(true);
  });

  it('200 — two data points returns insufficientData=false', async () => {
    await logEntry(app, '2024-01-15', 100);
    await logEntry(app, '2024-01-16', 105);

    const res = await request(app.getHttpServer())
      .get(
        `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=daily`,
      )
      .expect(200);

    expect(res.body.insufficientData).toBe(false);
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

  it('400 — invalid userId (not UUID format) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=not-a-uuid&exerciseName=${encodeURIComponent(EXERCISE)}`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid unit enum (unit=stone) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&unit=stone`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid groupBy enum (groupBy=quarterly) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&groupBy=quarterly`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (from=not-a-date) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&from=not-a-date`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid date format (to=bogus) returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=${USER_ID}&exerciseName=${encodeURIComponent(EXERCISE)}&to=bogus`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — exerciseName as empty string returns 400', async () => {
    const res = await request(app.getHttpServer()).get(
      `/workouts/progress?userId=${USER_ID}&exerciseName=`,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });
});
