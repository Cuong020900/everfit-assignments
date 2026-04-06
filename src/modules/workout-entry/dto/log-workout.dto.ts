import { WeightUnit } from '@src/shared/enums/weight-unit.enum';
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
  @IsInt()
  @Min(1)
  reps!: number;

  @IsNumber()
  @Min(0.001)
  weight!: number;

  @IsEnum(WeightUnit)
  unit!: WeightUnit;
}

export class WorkoutEntryDTO {
  @IsString()
  @IsNotEmpty()
  exerciseName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutSetDTO)
  sets!: WorkoutSetDTO[];
}

export class LogWorkoutDTO {
  @IsDateString()
  date!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkoutEntryDTO)
  entries!: WorkoutEntryDTO[];
}

export class LogWorkoutQueryDTO {
  @IsUUID()
  userId!: string;
}
