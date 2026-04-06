import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Base entity providing common timestamp columns.
 * Each subclass declares its own primary key column.
 */
export abstract class BaseEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
