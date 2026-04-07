import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import type { IWorkoutEntryRepository } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import type {
  HistoryQuery,
  HistoryResult,
  SavedWorkoutEntry,
  WorkoutEntryInput,
} from '@src/model/repositories/workout-entry/workout-entry.repository.types';
import type { Repository } from 'typeorm';

@Injectable()
export class TypeOrmWorkoutEntryRepository implements IWorkoutEntryRepository {
  constructor(
    @InjectRepository(WorkoutEntry)
    private readonly entryRepo: Repository<WorkoutEntry>,
  ) {}

  async saveEntries(
    userId: string,
    date: string,
    entries: WorkoutEntryInput[],
  ): Promise<SavedWorkoutEntry[]> {
    const entities = entries.map((entry) => {
      const workoutEntry = this.entryRepo.create({
        userId,
        date,
        exerciseName: entry.exerciseName,
      });
      workoutEntry.sets = entry.sets.map((s) => {
        const set = new WorkoutSet();
        set.reps = s.reps;
        set.weight = s.weight;
        set.unit = s.unit;
        set.weightKg = s.weightKg;
        return set;
      });
      return workoutEntry;
    });

    const saved = await this.entryRepo.save(entities);

    return saved.map((entry) => ({
      id: entry.id,
      exerciseName: entry.exerciseName,
      sets: entry.sets.map((s) => ({
        id: s.id,
        reps: s.reps,
        weight: s.weight,
        unit: s.unit,
        weightKg: s.weightKg,
      })),
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async findHistory(query: HistoryQuery): Promise<HistoryResult> {
    const { userId, limit, cursor, exerciseName, from, to, muscleGroup } = query;

    const qb = this.entryRepo
      .createQueryBuilder('entry')
      .leftJoinAndSelect('entry.sets', 'ws')
      .where('entry.user_id = :userId', { userId })
      .orderBy('entry.date', 'DESC')
      .addOrderBy('entry.id', 'DESC')
      .take(limit + 1);

    if (exerciseName) {
      qb.andWhere('entry.exercise_name ILIKE :exerciseName', {
        exerciseName: `%${exerciseName}%`,
      });
    }

    if (from) qb.andWhere('entry.date >= :from', { from });
    if (to) qb.andWhere('entry.date <= :to', { to });

    if (muscleGroup) {
      qb.andWhere(
        `entry.exercise_name IN (
          SELECT name FROM exercise_metadata WHERE muscle_group = :muscleGroup
        )`,
        { muscleGroup },
      );
    }

    if (cursor) {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as {
        date: string;
        id: string;
      };
      qb.andWhere('(entry.date < :cDate OR (entry.date = :cDate AND entry.id < :cId))', {
        cDate: decoded.date,
        cId: decoded.id,
      });
    }

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;

    const last = entries.at(-1);
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ date: last.date, id: last.id })).toString('base64url')
        : null;

    return {
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date,
        exerciseName: e.exerciseName,
        sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg, unit: s.unit })),
      })),
      nextCursor,
    };
  }
}
