import type { DataSource } from 'typeorm';

export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE workout_sets, workout_entries RESTART IDENTITY CASCADE');
}
