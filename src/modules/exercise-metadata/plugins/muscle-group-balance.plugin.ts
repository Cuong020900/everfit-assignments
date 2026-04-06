import { Injectable } from '@nestjs/common';
import type { MuscleGroupBalanceData } from '@src/modules/exercise-metadata/dto/get-insights.dto';
import type { InsightPlugin, WorkoutData } from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';

@Injectable()
export class MuscleGroupBalancePlugin implements InsightPlugin {
  readonly key = 'muscleGroupBalance';

  compute(data: WorkoutData): MuscleGroupBalanceData {
    if (!Array.isArray(data.entries) || data.entries.length === 0) return {};

    const volumeByGroup = new Map<string, number>();

    for (const entry of data.entries) {
      const group = entry.muscleGroup ?? 'unknown';
      const entryVolume = entry.sets.reduce((s, set) => s + set.reps * set.weightKg, 0);
      volumeByGroup.set(group, (volumeByGroup.get(group) ?? 0) + entryVolume);
    }

    const total = Array.from(volumeByGroup.values()).reduce((s, v) => s + v, 0);
    if (total === 0) return {};

    const result: MuscleGroupBalanceData = {};
    for (const [group, volume] of volumeByGroup.entries()) {
      result[group] = Math.round((volume / total) * 1000) / 10;
    }

    return result;
  }
}
