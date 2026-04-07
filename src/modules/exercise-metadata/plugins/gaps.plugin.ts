import { Injectable } from '@nestjs/common';
import type {
  InsightPlugin,
  WorkoutData,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import dayjs from 'dayjs';

const GAP_THRESHOLD_DAYS = 14;
const REGULARITY_WINDOW_DAYS = 28;
const REGULARITY_MIN_SESSIONS = 2;

interface NeglectedExercise {
  name: string;
  lastSeenDaysAgo: number;
}

interface GapsResult {
  exercises: NeglectedExercise[];
}

@Injectable()
export class GapsPlugin implements InsightPlugin {
  readonly name = 'gaps';

  compute(data: WorkoutData): GapsResult {
    if (!Array.isArray(data.entries) || data.entries.length === 0) return { exercises: [] };

    const to = dayjs(data.to ?? dayjs().format('YYYY-MM-DD'));

    // Group dates by exercise
    const datesByExercise = new Map<string, string[]>();
    for (const entry of data.entries) {
      const dates = datesByExercise.get(entry.exerciseName) ?? [];
      if (!dates.includes(entry.date)) dates.push(entry.date);
      datesByExercise.set(entry.exerciseName, dates);
    }

    const exercises: NeglectedExercise[] = [];

    for (const [exerciseName, dates] of datesByExercise.entries()) {
      const sortedDates = dates.slice().sort();
      const lastDate = sortedDates[sortedDates.length - 1];
      const lastSeenDaysAgo = to.diff(dayjs(lastDate), 'day');

      if (lastSeenDaysAgo < GAP_THRESHOLD_DAYS) continue;

      // Count sessions in the 28-day window ending on the last performed date
      const windowStart = dayjs(lastDate).subtract(REGULARITY_WINDOW_DAYS, 'day');
      const sessionsInWindow = sortedDates.filter((d) => {
        const dd = dayjs(d);
        return !dd.isBefore(windowStart) && !dd.isAfter(dayjs(lastDate));
      }).length;

      if (sessionsInWindow < REGULARITY_MIN_SESSIONS) continue;

      exercises.push({ name: exerciseName, lastSeenDaysAgo });
    }

    return { exercises };
  }
}
