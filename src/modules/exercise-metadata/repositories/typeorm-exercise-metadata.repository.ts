import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ExerciseMetadata } from '@src/model/entities/exercise-metadata.entity';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import type { IExerciseMetadataRepository } from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import type {
  InsightQuery,
  WorkoutEntryData,
} from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.types';
import type { Repository } from 'typeorm';

interface RawRow {
  date: string;
  exercise_name: string;
  muscle_group: string | null;
  reps: string;
  weight_kg: string;
}

@Injectable()
export class TypeOrmExerciseMetadataRepository implements IExerciseMetadataRepository {
  constructor(
    @InjectRepository(WorkoutEntry)
    private readonly entryRepo: Repository<WorkoutEntry>,
  ) {}

  async findWorkoutData(query: InsightQuery): Promise<WorkoutEntryData[]> {
    const qb = this.entryRepo
      .createQueryBuilder('entry')
      .select([
        'entry.date AS date',
        'entry.exercise_name AS exercise_name',
        'em.muscle_group AS muscle_group',
        's.reps AS reps',
        's.weight_kg AS weight_kg',
      ])
      .leftJoin(WorkoutSet, 's', 's.entry_id = entry.id')
      .leftJoin(ExerciseMetadata, 'em', 'em.name = entry.exercise_name')
      .where('entry.user_id = :userId', { userId: query.userId })
      .orderBy('entry.date', 'ASC')
      .addOrderBy('entry.id', 'ASC');

    if (query.from) qb.andWhere('entry.date >= :from', { from: query.from });
    if (query.to) qb.andWhere('entry.date <= :to', { to: query.to });

    const rows = await qb.getRawMany<RawRow>();

    // Group rows by (date, exerciseName) to reconstruct WorkoutEntryData[]
    const entryMap = new Map<string, WorkoutEntryData>();
    for (const row of rows) {
      const key = `${row.date}||${row.exercise_name}`;
      if (!entryMap.has(key)) {
        entryMap.set(key, {
          date: row.date,
          exerciseName: row.exercise_name,
          muscleGroup: row.muscle_group ?? null,
          sets: [],
        });
      }
      if (row.reps !== null && row.weight_kg !== null) {
        entryMap.get(key)!.sets.push({
          reps: Number(row.reps),
          weightKg: parseFloat(row.weight_kg),
        });
      }
    }

    return Array.from(entryMap.values());
  }
}
