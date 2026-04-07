import { Injectable } from '@nestjs/common';
import type {
  InsightPlugin,
  WorkoutData,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import dayjs from 'dayjs';

interface TrainingFrequencyResult {
  sessionsPerWeek: number;
  totalSessions: number;
  weeksAnalyzed: number;
}

@Injectable()
export class TrainingFrequencyPlugin implements InsightPlugin {
  readonly name = 'trainingFrequency';

  compute(data: WorkoutData): TrainingFrequencyResult {
    const uniqueDates = new Set(data.entries.map((e) => e.date));
    const totalSessions = uniqueDates.size;

    if (totalSessions === 0) return { sessionsPerWeek: 0, totalSessions: 0, weeksAnalyzed: 0 };

    const sortedDates = Array.from(uniqueDates).sort();
    const from = data.from ?? sortedDates[0];
    const to = data.to ?? sortedDates[sortedDates.length - 1];

    const weeks = Math.max((dayjs(to).diff(dayjs(from), 'day') + 1) / 7, 1);
    const sessionsPerWeek = Math.round((totalSessions / weeks) * 10) / 10;
    const weeksAnalyzed = Math.round(weeks * 10) / 10;

    return { sessionsPerWeek, totalSessions, weeksAnalyzed };
  }
}
