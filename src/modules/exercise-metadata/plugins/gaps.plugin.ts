import { Injectable } from '@nestjs/common';
import type { GapEntry } from '@src/modules/exercise-metadata/dto/get-insights.dto';
import type {
  InsightPlugin,
  WorkoutData,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import dayjs from 'dayjs';

const GAP_THRESHOLD_DAYS = 14;
const REGULARITY_WINDOW_DAYS = 28;
const REGULARITY_MIN_SESSIONS = 2;

@Injectable()
export class GapsPlugin implements InsightPlugin {
  readonly key = 'gaps';

  compute(data: WorkoutData): GapEntry[] {
    if (!Array.isArray(data.entries) || data.entries.length === 0) return [];

    const to = dayjs(data.to ?? dayjs().format('YYYY-MM-DD'));

    // Group dates by exercise
    const datesByExercise = new Map<string, string[]>();
    for (const entry of data.entries) {
      const dates = datesByExercise.get(entry.exerciseName) ?? [];
      if (!dates.includes(entry.date)) dates.push(entry.date);
      datesByExercise.set(entry.exerciseName, dates);
    }

    const gaps: GapEntry[] = [];

    for (const [exerciseName, dates] of datesByExercise.entries()) {
      const sortedDates = dates.slice().sort();
      const lastDate = sortedDates[sortedDates.length - 1];
      const daysSince = to.diff(dayjs(lastDate), 'day');

      if (daysSince < GAP_THRESHOLD_DAYS) continue;

      // Count sessions in the 28-day window ending on the last performed date
      const windowStart = dayjs(lastDate).subtract(REGULARITY_WINDOW_DAYS, 'day');
      const sessionsInWindow = sortedDates.filter((d) => {
        const dd = dayjs(d);
        return !dd.isBefore(windowStart) && !dd.isAfter(dayjs(lastDate));
      }).length;

      if (sessionsInWindow < REGULARITY_MIN_SESSIONS) continue;

      gaps.push({ exerciseName, lastPerformed: lastDate, daysSince });
    }

    return gaps;
  }
}
