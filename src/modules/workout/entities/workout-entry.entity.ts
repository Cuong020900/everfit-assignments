import { WorkoutSet } from '@src/modules/workout/entities/workout-set.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('workout_entries')
export class WorkoutEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // pg returns DATE columns as 'YYYY-MM-DD' strings — intentional, avoids timezone shifts
  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'exercise_name', type: 'varchar' })
  exerciseName!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(
    () => WorkoutSet,
    (set) => set.entry,
    { cascade: true, eager: false },
  )
  sets!: WorkoutSet[];
}
