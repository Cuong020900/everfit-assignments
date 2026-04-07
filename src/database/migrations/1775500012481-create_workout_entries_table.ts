import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';

export class CreateWorkoutEntries1743990000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'workout_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'exercise_name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // TableIndex does not support per-column DESC — raw SQL required for sort direction
    // Composite (user_id, date DESC, id DESC) covers cursor pagination efficiently.
    await queryRunner.query(`
      CREATE INDEX "idx_entries_user_date_id"
        ON "workout_entries" ("user_id", "date" DESC, "id" DESC)
    `);
    // Unique index on (user_id, exercise_name, date) enforces one entry per exercise per day
    // and also optimises PR/progress queries (supersedes a plain non-unique index).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_entries_user_exercise_date"
        ON "workout_entries" ("user_id", "exercise_name", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('workout_entries', true);
  }
}
