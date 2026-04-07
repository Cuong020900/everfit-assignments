import { Inject, Injectable } from '@nestjs/common';
import type { IWorkoutSetRepository } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import { WORKOUT_SET_REPOSITORY } from '@src/model/repositories/workout-set/workout-set.repository.interface';
import type { PRSetResult } from '@src/model/repositories/workout-set/workout-set.repository.types';
import type {
  ComparisonValue,
  GetPRDTO,
  GetPRResult,
  PRComparison,
  PRExerciseResult,
  PRSet,
  PRValue,
} from '@src/modules/workout-set/dto/get-pr.dto';
import type {
  GetProgressDTO,
  GetProgressResult,
  ProgressPoint,
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
  /* istanbul ignore next */
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

    const grouped = this.groupByExercise(sets);

    let prevGrouped: Map<string, PRSetResult[]> | null = null;
    let comparison: {
      period: { from: string; to: string };
      prevPeriod: { from: string; to: string };
    } | null = null;

    if (dto.compareTo === CompareTo.PREVIOUS_PERIOD && dto.from && dto.to) {
      const periodDays = dayjs(dto.to).diff(dayjs(dto.from), 'day');
      const prevTo = dayjs(dto.from).subtract(1, 'day').format('YYYY-MM-DD');
      const prevFrom = dayjs(prevTo).subtract(periodDays, 'day').format('YYYY-MM-DD');

      const prevSets = await this.repo.findPRSets({
        userId: dto.userId,
        exerciseName: dto.exerciseName,
        from: prevFrom,
        to: prevTo,
      });

      prevGrouped = this.groupByExercise(prevSets);
      comparison = {
        period: { from: dto.from, to: dto.to },
        prevPeriod: { from: prevFrom, to: prevTo },
      };
    }

    const exerciseNames = new Set([...grouped.keys(), ...(prevGrouped?.keys() ?? [])]);
    const data: PRExerciseResult[] = [];

    for (const name of exerciseNames) {
      const currentSets = grouped.get(name) ?? [];
      const prs = this.computePRSet(currentSets, dto.unit);

      const result: PRExerciseResult = { exerciseName: name, prs };

      if (prevGrouped !== null && comparison !== null) {
        const prevSetsForExercise = prevGrouped.get(name) ?? [];
        const prevPrs = this.computePRSet(prevSetsForExercise, dto.unit);
        result.comparison = this.buildComparison(prs, prevPrs, comparison);
      }

      data.push(result);
    }

    return { data };
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

    const points: ProgressPoint[] = aggregated.map((p) => ({
      period: p.period,
      bestWeight: fromKg(p.bestWeightKg, dto.unit),
      volume: fromKg(p.volumeKg, dto.unit),
    }));

    return {
      exerciseName: dto.exerciseName,
      groupBy: dto.groupBy ?? 'week',
      unit: dto.unit ?? 'kg',
      data: points,
      insufficientData: points.length < 2,
    };
  }

  private groupByExercise(sets: PRSetResult[]): Map<string, PRSetResult[]> {
    const map = new Map<string, PRSetResult[]>();
    for (const s of sets) {
      const existing = map.get(s.exerciseName) ?? [];
      existing.push(s);
      map.set(s.exerciseName, existing);
    }
    return map;
  }

  private computePRSet(sets: PRSetResult[], unit: WeightUnit): PRSet {
    if (sets.length === 0) return { maxWeight: null, maxVolume: null, bestOneRM: null };

    const maxWeightSet = sets.reduce((best, s) => (s.weightKg > best.weightKg ? s : best));
    const maxVolumeSet = sets.reduce((best, s) =>
      s.reps * s.weightKg > best.reps * best.weightKg ? s : best,
    );
    const bestOneRMSet = sets.reduce((best, s) =>
      epley1RM(s.weightKg, s.reps) > epley1RM(best.weightKg, best.reps) ? s : best,
    );

    const maxWeight: PRValue = {
      value: fromKg(maxWeightSet.weightKg, unit),
      unit,
      reps: maxWeightSet.reps,
      achievedAt: maxWeightSet.date,
    };

    const maxVolume: PRValue = {
      value: fromKg(maxVolumeSet.reps * maxVolumeSet.weightKg, unit),
      unit,
      reps: maxVolumeSet.reps,
      achievedAt: maxVolumeSet.date,
    };

    const bestOneRM: PRValue = {
      value: fromKg(epley1RM(bestOneRMSet.weightKg, bestOneRMSet.reps), unit),
      unit,
      reps: bestOneRMSet.reps,
      achievedAt: bestOneRMSet.date,
    };

    return { maxWeight, maxVolume, bestOneRM };
  }

  private buildComparison(
    current: PRSet,
    prev: PRSet,
    periods: { period: { from: string; to: string }; prevPeriod: { from: string; to: string } },
  ): PRComparison {
    return {
      period: periods.period,
      prevPeriod: periods.prevPeriod,
      maxWeight: this.buildDelta(current.maxWeight?.value ?? 0, prev.maxWeight?.value ?? 0),
      maxVolume: this.buildDelta(current.maxVolume?.value ?? 0, prev.maxVolume?.value ?? 0),
      bestOneRM: this.buildDelta(current.bestOneRM?.value ?? 0, prev.bestOneRM?.value ?? 0),
    };
  }

  private buildDelta(current: number, previous: number): ComparisonValue {
    const deltaKg = current - previous;
    const deltaPct = previous !== 0 ? (deltaKg / previous) * 100 : 0;
    return { current, previous, deltaKg, deltaPct };
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
