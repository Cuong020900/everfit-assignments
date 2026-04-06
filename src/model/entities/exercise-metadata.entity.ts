import { BaseEntity } from '@src/model/entities/base.entity';
import { Column, Entity } from 'typeorm';

@Entity('exercise_metadata')
export class ExerciseMetadata extends BaseEntity {
  // natural key — name is the primary identifier for exercises
  @Column({ type: 'varchar', primary: true })
  name!: string;

  @Column({ name: 'muscle_group', type: 'varchar' })
  muscleGroup!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases!: string[];
}
