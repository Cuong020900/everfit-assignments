import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutEntry } from '@src/model/entities/workout-entry.entity';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { WORKOUT_ENTRY_REPOSITORY } from '@src/model/repositories/workout-entry/workout-entry.repository.interface';
import { WorkoutEntryController } from '@src/modules/workout-entry/workout-entry.controller';
import { WorkoutEntryService } from '@src/modules/workout-entry/workout-entry.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutEntry, WorkoutSet])],
  controllers: [WorkoutEntryController],
  providers: [
    WorkoutEntryService,
    // Repository provider will be added in Phase 02
    { provide: WORKOUT_ENTRY_REPOSITORY, useValue: null },
  ],
})
export class WorkoutEntryModule {}
