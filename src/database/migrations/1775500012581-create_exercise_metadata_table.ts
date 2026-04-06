import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table } from 'typeorm';

export class CreateExerciseMetadata1743990000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'exercise_metadata',
        columns: [
          {
            name: 'name',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'muscle_group',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'aliases',
            type: 'text',
            isArray: true,
            isNullable: false,
            default: "'{}'",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('exercise_metadata', true);
  }
}
