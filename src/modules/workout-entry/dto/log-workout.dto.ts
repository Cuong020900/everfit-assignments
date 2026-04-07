import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkoutSetDTO {
  @ApiProperty({ description: 'Number of reps', minimum: 1, example: 5 })
  @IsInt()
  @Min(1)
  reps!: number;

  @ApiProperty({ description: 'Weight lifted', minimum: 0.001, example: 100 })
  @IsNumber()
  @Min(0.001)
  weight!: number;

  @ApiProperty({ description: 'Weight unit', enum: WeightUnit, example: WeightUnit.KG })
  @IsEnum(WeightUnit)
  unit!: WeightUnit;
}

export class WorkoutEntryDTO {
  @ApiProperty({ description: 'Exercise name', example: 'Bench Press' })
  @IsString()
  @IsNotEmpty()
  exerciseName!: string;

  @ApiProperty({ description: 'Sets performed', type: [WorkoutSetDTO], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDTO)
  sets!: WorkoutSetDTO[];
}

export class LogWorkoutDTO {
  @ApiProperty({ description: 'Workout date (YYYY-MM-DD)', example: '2024-01-15' })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'Exercises performed', type: [WorkoutEntryDTO], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutEntryDTO)
  entries!: WorkoutEntryDTO[];
}

export class LogWorkoutQueryDTO {
  @ApiProperty({ description: 'User UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsUUID()
  userId!: string;
}

export interface LogWorkoutEntryDisplay {
  id: string;
  exerciseName: string;
  sets: Array<{ id: string; reps: number; weight: number; unit: string; weightKg: number }>;
  createdAt: string;
}

export interface LogWorkoutResult {
  date: string;
  userId: string;
  entries: LogWorkoutEntryDisplay[];
}
