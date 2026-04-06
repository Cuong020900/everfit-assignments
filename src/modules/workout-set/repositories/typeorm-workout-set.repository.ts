import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import type { IWorkoutSetRepository } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import type {
  PRQuery,
  PRSetResult,
  ProgressQuery,
  ProgressSetResult,
} from '@src/model/repositories/workout-set/workout-set.repository.types';
import type { Repository } from 'typeorm';

@Injectable()
export class TypeOrmWorkoutSetRepository implements IWorkoutSetRepository {
  constructor(
    @InjectRepository(WorkoutSet)
    private readonly setRepo: Repository<WorkoutSet>,
  ) {}

  async findPRSets(query: PRQuery): Promise<PRSetResult[]> {
    const { userId, exerciseName, from, to } = query;

    const qb = this.setRepo
      .createQueryBuilder('s')
      .select(['s.reps AS reps', 's.weight_kg AS "weightKg"', 'e.date AS date'])
      .innerJoin(WorkoutEntry, 'e', 'e.id = s.entry_id')
      .where('e.user_id = :userId', { userId });

    if (exerciseName) qb.andWhere('e.exercise_name = :exerciseName', { exerciseName });
    if (from) qb.andWhere('e.date >= :from', { from });
    if (to) qb.andWhere('e.date <= :to', { to });

    const rows = await qb.getRawMany<{ reps: string; weightKg: string; date: string }>();

    return rows.map((r) => ({
      reps: Number(r.reps),
      weightKg: parseFloat(r.weightKg),
      date: r.date,
    }));
  }

  async findProgressSeries(query: ProgressQuery): Promise<ProgressSetResult[]> {
    const { userId, exerciseName, from, to } = query;

    const qb = this.setRepo
      .createQueryBuilder('s')
      .select(['e.date AS date', 's.reps AS reps', 's.weight_kg AS "weightKg"'])
      .innerJoin(WorkoutEntry, 'e', 'e.id = s.entry_id')
      .where('e.user_id = :userId', { userId })
      .andWhere('e.exercise_name = :exerciseName', { exerciseName })
      .orderBy('e.date', 'ASC');

    if (from) qb.andWhere('e.date >= :from', { from });
    if (to) qb.andWhere('e.date <= :to', { to });

    const rows = await qb.getRawMany<{ date: string; reps: string; weightKg: string }>();

    return rows.map((r) => ({
      date: r.date,
      reps: Number(r.reps),
      weightKg: parseFloat(r.weightKg),
    }));
  }
}
