import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('exercise_metadata')
export class ExerciseMetadata {
  @PrimaryColumn({ type: 'varchar' })
  name!: string;

  @Column({ name: 'muscle_group', type: 'varchar' })
  muscleGroup!: string;

  @Column({ type: 'text', array: true, default: '{}' })
  aliases!: string[];
}
