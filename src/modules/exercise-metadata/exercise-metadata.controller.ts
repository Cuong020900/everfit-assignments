import { Controller, Get, Query } from '@nestjs/common';
import { GetInsightsDTO, type GetInsightsResult } from '@src/modules/exercise-metadata/dto/get-insights.dto';
import { ExerciseMetadataService } from '@src/modules/exercise-metadata/exercise-metadata.service';

@Controller('workouts')
export class ExerciseMetadataController {
  constructor(private readonly service: ExerciseMetadataService) {}

  @Get('insights')
  getInsights(@Query() dto: GetInsightsDTO): Promise<GetInsightsResult> {
    return this.service.getInsights(dto);
  }
}
