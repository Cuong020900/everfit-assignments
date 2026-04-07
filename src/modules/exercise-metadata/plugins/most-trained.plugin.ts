import { Injectable } from '@nestjs/common';
import type {
  InsightPlugin,
  WorkoutData,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

interface MostTrainedByFrequency {
  exercise: string;
  sessionCount: number;
}

interface MostTrainedByVolume {
  exercise: string;
  totalVolumeKg: number;
}

interface MostTrainedResult {
  byFrequency: MostTrainedByFrequency[];
  byVolume: MostTrainedByVolume[];
}

@Injectable()
export class MostTrainedPlugin implements InsightPlugin {
  readonly name = 'mostTrained';

  compute(data: WorkoutData): MostTrainedResult {
    const map = new Map<string, { sessions: Set<string>; volume: number }>();

    for (const entry of data.entries) {
      const acc = map.get(entry.exerciseName) ?? { sessions: new Set(), volume: 0 };
      acc.sessions.add(entry.date);
      acc.volume += entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0);
      map.set(entry.exerciseName, acc);
    }

    const byFrequency: MostTrainedByFrequency[] = Array.from(map.entries())
      .map(([exercise, acc]) => ({ exercise, sessionCount: acc.sessions.size }))
      .sort((a, b) => b.sessionCount - a.sessionCount);

    const byVolume: MostTrainedByVolume[] = Array.from(map.entries())
      .map(([exercise, acc]) => ({ exercise, totalVolumeKg: acc.volume }))
      .sort((a, b) => b.totalVolumeKg - a.totalVolumeKg);

    return { byFrequency, byVolume };
  }
}
