import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { IWorkoutEntryRepository } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import { WORKOUT_ENTRY_REPOSITORY } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import type {
  GetHistoryDTO,
  GetHistoryResult,
} from '@src/modules/workout-entry/dto/get-history.dto';
import type {
  LogWorkoutDTO,
  LogWorkoutResult,
} from '@src/modules/workout-entry/dto/log-workout.dto';
import { ERROR_MESSAGES } from '@src/shared/constants/error-codes';
import { fromKg, toKg } from '@src/shared/units/unit-converter';

/** PostgreSQL unique_violation error code */
const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class WorkoutEntryService {
  constructor(
    @Inject(WORKOUT_ENTRY_REPOSITORY)
    private readonly repo: IWorkoutEntryRepository,
  ) {}

  async logWorkout(userId: string, dto: LogWorkoutDTO): Promise<LogWorkoutResult> {
    const entries = dto.entries.map((entry) => ({
      exerciseName: entry.exerciseName,
      sets: entry.sets.map((set) => ({
        reps: set.reps,
        weight: set.weight,
        unit: set.unit,
        weightKg: toKg(set.weight, set.unit),
      })),
    }));

    try {
      const saved = await this.repo.saveEntries(userId, dto.date, entries);
      return { date: dto.date, userId, entries: saved };
    } catch (error: unknown) {
      if (isDatabaseError(error) && error.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException(ERROR_MESSAGES.DUPLICATE_ENTRY);
      }
      throw error;
    }
  }

  async getHistory(dto: GetHistoryDTO): Promise<GetHistoryResult> {
    const result = await this.repo.findHistory({
      userId: dto.userId,
      limit: dto.limit,
      cursor: dto.cursor,
      exerciseName: dto.exerciseName,
      from: dto.from,
      to: dto.to,
      muscleGroup: dto.muscleGroup,
    });

    return {
      data: result.entries.map((entry) => ({
        ...entry,
        sets: entry.sets.map((set) => ({
          reps: set.reps,
          weight: fromKg(set.weightKg, dto.unit),
          unit: dto.unit,
        })),
      })),
      pagination: {
        nextCursor: result.nextCursor,
        hasMore: result.nextCursor !== null,
        limit: dto.limit,
      },
    };
  }
}

/** Narrow unknown to a PG driver error with a `code` property. */
function isDatabaseError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
