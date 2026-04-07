import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import type { GetHistoryResult } from '@src/modules/workout-entry/dto/get-history.dto';
import { GetHistoryDTO } from '@src/modules/workout-entry/dto/get-history.dto';
import {
  LogWorkoutDTO,
  LogWorkoutQueryDTO,
  type LogWorkoutResult,
} from '@src/modules/workout-entry/dto/log-workout.dto';
import { WorkoutEntryService } from '@src/modules/workout-entry/workout-entry.service';
import type { ApiResponse } from '@src/shared/types/api-response.type';

@Controller('workouts')
export class WorkoutEntryController {
  constructor(private readonly service: WorkoutEntryService) {}

  @Post()
  @HttpCode(201)
  async logWorkout(
    @Query() query: LogWorkoutQueryDTO,
    @Body() dto: LogWorkoutDTO,
  ): Promise<ApiResponse<LogWorkoutResult>> {
    return { data: await this.service.logWorkout(query.userId, dto) };
  }

  @Get()
  async getHistory(@Query() dto: GetHistoryDTO): Promise<GetHistoryResult> {
    return this.service.getHistory(dto);
  }
}
