import { Inject, Injectable } from '@nestjs/common';
import type { IWorkoutSetRepository } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import { WORKOUT_SET_REPOSITORY } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import type { PRSetResult } from '@src/model/repositories/workout-set/workout-set.repository.types';
import type { GetPRDTO, GetPRResult, PRData } from '@src/modules/workout-set/dto/get-pr.dto';
import type {
  GetProgressDTO,
  GetProgressResult,
} from '@src/modules/workout-set/dto/get-progress.dto';
import { CompareTo } from '@src/shared/enums/compare-to.enum';
import { GroupBy } from '@src/shared/enums/group-by.enum';
import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { fromKg } from '@src/shared/units/unit-converter';
import { epley1RM } from '@src/shared/utils/epley';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

@Injectable()
export class WorkoutSetService {
  constructor(
    @Inject(WORKOUT_SET_REPOSITORY)
    private readonly repo: IWorkoutSetRepository,
  ) {}

  async getPRs(dto: GetPRDTO): Promise<GetPRResult> {
    const sets = await this.repo.findPRSets({
      userId: dto.userId,
      exerciseName: dto.exerciseName,
      from: dto.from,
      to: dto.to,
    });

    const current = this.computePRData(sets, dto.unit);

    if (dto.compareTo === CompareTo.PREVIOUS_PERIOD && dto.from && dto.to) {
      const prevFrom = dayjs(dto.from)
        .subtract(dayjs(dto.to).diff(dayjs(dto.from), 'day') + 1, 'day')
        .format('YYYY-MM-DD');
      const prevTo = dayjs(dto.from).subtract(1, 'day').format('YYYY-MM-DD');

      const prevSets = await this.repo.findPRSets({
        userId: dto.userId,
        exerciseName: dto.exerciseName,
        from: prevFrom,
        to: prevTo,
      });

      return { data: { ...current, previous: this.computePRData(prevSets, dto.unit) } };
    }

    return { data: current };
  }

  async getProgress(dto: GetProgressDTO): Promise<GetProgressResult> {
    const sets = await this.repo.findProgressSeries({
      userId: dto.userId,
      exerciseName: dto.exerciseName,
      from: dto.from,
      to: dto.to,
    });

    const dailyBests = this.computeDailyBests(sets);
    const aggregated = this.aggregate(dailyBests, dto.groupBy);

    return {
      data: {
        series: aggregated.map((p) => ({
          period: p.period,
          bestWeight: fromKg(p.bestWeightKg, dto.unit),
          volume: fromKg(p.volumeKg, dto.unit),
          unit: dto.unit,
        })),
        groupBy: dto.groupBy,
        note: aggregated.length === 1 ? 'Insufficient data for trend analysis' : null,
      },
    };
  }

  private computePRData(sets: PRSetResult[], unit: WeightUnit): PRData {
    if (sets.length === 0) return { maxWeight: null, maxVolume: null, best1RM: null };

    const maxWeight = sets.reduce((best, s) => (s.weightKg > best.weightKg ? s : best));
    const maxVolume = sets.reduce((best, s) =>
      s.reps * s.weightKg > best.reps * best.weightKg ? s : best,
    );
    const best1RM = sets.reduce((best, s) =>
      epley1RM(s.weightKg, s.reps) > epley1RM(best.weightKg, best.reps) ? s : best,
    );

    return {
      maxWeight: { weight: fromKg(maxWeight.weightKg, unit), unit, date: maxWeight.date },
      maxVolume: {
        reps: maxVolume.reps,
        weight: fromKg(maxVolume.weightKg, unit),
        unit,
        date: maxVolume.date,
      },
      best1RM: {
        estimated1RM: fromKg(epley1RM(best1RM.weightKg, best1RM.reps), unit),
        unit,
        date: best1RM.date,
      },
    };
  }

  private computeDailyBests(
    sets: { date: string; reps: number; weightKg: number }[],
  ): { date: string; bestWeightKg: number; volumeKg: number }[] {
    const map = new Map<string, { bestWeightKg: number; volumeKg: number }>();

    for (const s of sets) {
      const existing = map.get(s.date);
      if (!existing) {
        map.set(s.date, { bestWeightKg: s.weightKg, volumeKg: s.reps * s.weightKg });
      } else {
        existing.bestWeightKg = Math.max(existing.bestWeightKg, s.weightKg);
        existing.volumeKg += s.reps * s.weightKg;
      }
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }

  private aggregate(
    dailyBests: { date: string; bestWeightKg: number; volumeKg: number }[],
    groupBy: GroupBy,
  ): { period: string; bestWeightKg: number; volumeKg: number }[] {
    if (groupBy === GroupBy.DAILY) {
      return dailyBests.map((d) => ({
        period: d.date,
        bestWeightKg: d.bestWeightKg,
        volumeKg: d.volumeKg,
      }));
    }

    const buckets = new Map<string, { weights: number[]; volumeKg: number }>();

    for (const d of dailyBests) {
      const period =
        groupBy === GroupBy.WEEKLY
          ? `${dayjs(d.date).isoWeekYear()}-W${String(dayjs(d.date).isoWeek()).padStart(2, '0')}`
          : dayjs(d.date).format('YYYY-MM');

      const bucket = buckets.get(period);
      if (!bucket) {
        buckets.set(period, { weights: [d.bestWeightKg], volumeKg: d.volumeKg });
      } else {
        bucket.weights.push(d.bestWeightKg);
        bucket.volumeKg += d.volumeKg;
      }
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, b]) => ({
        period,
        bestWeightKg: b.weights.reduce((sum, w) => sum + w, 0) / b.weights.length,
        volumeKg: b.volumeKg,
      }));
  }
}
