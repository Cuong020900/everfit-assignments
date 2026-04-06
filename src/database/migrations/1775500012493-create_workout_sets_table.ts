import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class CreateWorkoutSets1743990000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'workout_sets',
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
            name: 'entry_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'reps',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'weight',
            type: 'numeric',
            precision: 10,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'unit',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'weight_kg',
            type: 'numeric',
            precision: 10,
            scale: 4,
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

    await queryRunner.createIndex(
      'workout_sets',
      new TableIndex({
        name: 'idx_sets_entry',
        columnNames: ['entry_id'],
      }),
    );

    // TableIndex does not support per-column DESC — raw SQL required for sort direction
    await queryRunner.query(`
      CREATE INDEX "idx_sets_weight_kg"
        ON "workout_sets" ("weight_kg" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('workout_sets', true);
  }
}
