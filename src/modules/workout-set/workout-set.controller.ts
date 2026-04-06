import { Controller, Get, Query } from '@nestjs/common';
import type { GetPRDTO, GetPRResult } from '@src/modules/workout-set/dto/get-pr.dto';
import type {
  GetProgressDTO,
  GetProgressResult,
} from '@src/modules/workout-set/dto/get-progress.dto';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';

@Controller('workouts')
export class WorkoutSetController {
  constructor(private readonly service: WorkoutSetService) {}

  @Get('pr')
  async getPRs(@Query() dto: GetPRDTO): Promise<GetPRResult> {
    return this.service.getPRs(dto);
  }

  @Get('progress')
  async getProgress(@Query() dto: GetProgressDTO): Promise<GetProgressResult> {
    return this.service.getProgress(dto);
  }
}
