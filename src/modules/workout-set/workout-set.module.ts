import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkoutSet } from '@src/model/entities/workout-set.entity';
import { WorkoutSetController } from '@src/modules/workout-set/workout-set.controller';
import { WorkoutSetService } from '@src/modules/workout-set/workout-set.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkoutSet])],
  controllers: [WorkoutSetController],
  providers: [WorkoutSetService],
})
export class WorkoutSetModule {}
