import { BaseEntity } from '@src/model/entities/base.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { Column, Entity, OneToMany } from 'typeorm';

@Entity('workout_entries')
export class WorkoutEntry extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  // pg returns DATE columns as 'YYYY-MM-DD' strings — intentional, avoids timezone shifts
  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'exercise_name', type: 'varchar' })
  exerciseName!: string;

  @OneToMany(
    () => WorkoutSet,
    (set) => set.entry,
    {
      cascade: true,
      eager: false,
    },
  )
  sets!: WorkoutSet[];
}
