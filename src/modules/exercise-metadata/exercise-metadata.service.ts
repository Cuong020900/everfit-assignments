import { Inject, Injectable } from '@nestjs/common';
import {
  EXERCISE_METADATA_REPOSITORY,
  type IExerciseMetadataRepository,
} from '@src/model/repositories/exercise-metadata/exercise-metadata.repository.interface';
import type {
  GetInsightsDTO,
  GetInsightsResult,
  InsightItem,
} from '@src/modules/exercise-metadata/dto/get-insights.dto';
import {
  INSIGHT_PLUGINS,
  type InsightPlugin,
} from '@src/modules/exercise-metadata/plugins/insight-plugin.interface';
import dayjs from 'dayjs';

@Injectable()
export class ExerciseMetadataService {
  /* istanbul ignore next */
  constructor(
    @Inject(EXERCISE_METADATA_REPOSITORY)
    private readonly repo: IExerciseMetadataRepository,
    @Inject(INSIGHT_PLUGINS)
    private readonly plugins: InsightPlugin[],
  ) {}

  async getInsights(dto: GetInsightsDTO): Promise<GetInsightsResult> {
    const resolvedFrom = dto.from ?? dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const resolvedTo = dto.to ?? dayjs().format('YYYY-MM-DD');

    const entries = await this.repo.findWorkoutData({
      userId: dto.userId,
      from: dto.from,
      to: dto.to,
    });

    const period = { from: resolvedFrom, to: resolvedTo };

    if (entries.length === 0) {
      return { period, insights: [] };
    }

    const workoutData = { userId: dto.userId, from: resolvedFrom, to: resolvedTo, entries };
    const insights: InsightItem[] = [];

    for (const plugin of this.plugins) {
      const result = plugin.compute(workoutData);
      if (result !== null && result !== undefined) {
        insights.push({ name: plugin.name, data: result });
      }
    }

    return { period, insights };
  }
}
