import { DataSource } from 'typeorm';

function resolvePort(): number {
  const raw = process.env.DB_PORT;
  if (raw !== undefined && raw !== '') {
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 5432;
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST !== undefined && process.env.DB_HOST !== '' ? process.env.DB_HOST : 'localhost',
  port: resolvePort(),
  username: process.env.DB_USER !== undefined && process.env.DB_USER !== '' ? process.env.DB_USER : 'workout',
  password: process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== '' ? process.env.DB_PASSWORD : 'workout',
  database: process.env.DB_NAME !== undefined && process.env.DB_NAME !== '' ? process.env.DB_NAME : 'workout_db',
  entities: [`${__dirname}/../modules/**/*.entity{.ts,.js}`],
  migrations: [`${__dirname}/migrations/*{.ts,.js}`],
  synchronize: false,
});
