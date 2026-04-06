import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import type { GetHistoryResult } from '@src/modules/workout-entry/dto/get-history.dto';
import { GetHistoryDTO } from '@src/modules/workout-entry/dto/get-history.dto';
import { LogWorkoutDTO, LogWorkoutQueryDTO } from '@src/modules/workout-entry/dto/log-workout.dto';
import { WorkoutEntryService } from '@src/modules/workout-entry/workout-entry.service';

@Controller('workouts')
export class WorkoutEntryController {
  constructor(private readonly service: WorkoutEntryService) {}

  @Post()
  @HttpCode(201)
  async logWorkout(@Query() query: LogWorkoutQueryDTO, @Body() dto: LogWorkoutDTO): Promise<null> {
    await this.service.logWorkout(query.userId, dto);
    return null;
  }

  @Get()
  async getHistory(@Query() dto: GetHistoryDTO): Promise<GetHistoryResult> {
    return this.service.getHistory(dto);
  }
}
