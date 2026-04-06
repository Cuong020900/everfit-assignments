import { BaseEntity } from '@src/model/entities/base.entity';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

const numericTransformer = {
  from: (v: string | null): number => (v === null ? 0 : parseFloat(v)),
  to: (v: number): number => v,
};

@Entity('workout_sets')
export class WorkoutSet extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(
    () => WorkoutEntry,
    (entry) => entry.sets,
  )
  @JoinColumn({ name: 'entry_id' })
  entry!: WorkoutEntry;

  @Column({ type: 'int' })
  reps!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  weight!: number;

  @Column({ type: 'varchar', length: '10' })
  unit!: string;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 10,
    scale: 4,
    transformer: numericTransformer,
  })
  weightKg!: number;
}
