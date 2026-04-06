import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { createTestApp } from './helpers/app-factory';
import { truncateAll } from './helpers/db-cleaner';

const USER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const validBody = {
  date: '2024-01-15',
  entries: [
    {
      exerciseName: 'Bench Press',
      sets: [{ reps: 5, weight: 100, unit: 'kg' }],
    },
  ],
};

describe('POST /workouts', () => {
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

  it('201 — saves entries and returns 201 with empty body', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toBeNull();
  });

  it('201 — bulk: saves multiple exercises in one request', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [
          { exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] },
          { exerciseName: 'Squat', sets: [{ reps: 3, weight: 150, unit: 'kg' }] },
        ],
      });

    expect(res.status).toBe(201);
  });

  it('201 — stores weight_kg computed from lb correctly', async () => {
    await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 220.46, unit: 'lb' }] }],
      })
      .expect(201);

    const history = await request(app.getHttpServer())
      .get(`/workouts?userId=${USER_ID}&unit=kg`)
      .expect(200);

    const sets = history.body.data[0].sets;
    expect(sets[0].weight).toBeCloseTo(100, 1);
  });

  it('400 — missing userId returns 400', async () => {
    const res = await request(app.getHttpServer()).post('/workouts').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid userId (not UUID) returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/workouts?userId=not-a-uuid')
      .send(validBody);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — empty entries array returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({ date: '2024-01-15', entries: [] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — entry with empty sets returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [{ exerciseName: 'Bench Press', sets: [] }],
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — invalid unit returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'stone' }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — negative weight returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: -10, unit: 'kg' }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — reps = 0 returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        date: '2024-01-15',
        entries: [{ exerciseName: 'Bench Press', sets: [{ reps: 0, weight: 100, unit: 'kg' }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('400 — missing date returns 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/workouts?userId=${USER_ID}`)
      .send({
        entries: [{ exerciseName: 'Bench Press', sets: [{ reps: 5, weight: 100, unit: 'kg' }] }],
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400 });
  });

  it('error response shape: { statusCode, error, message }', async () => {
    const res = await request(app.getHttpServer())
      .post('/workouts?userId=not-a-uuid')
      .send(validBody);
    expect(res.body).toHaveProperty('statusCode');
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
  });
});
