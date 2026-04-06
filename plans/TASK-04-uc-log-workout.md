# TASK-04 — UC-1: Log Workout

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1 hour |
| **Blocks** | TASK-05, TASK-06, TASK-07, TASK-08 |
| **Blocked by** | TASK-02, TASK-03 |
| **Commit message** | `feat: implement POST /workouts bulk log endpoint` |

---

## Goal

`POST /workouts?userId={uuid}` — logs one or more exercise entries in a single request. Each entry has a name and 1+ sets. Returns all persisted entries with IDs.

---

## Endpoint Contract

```
POST /workouts?userId=uuid
Body: {
  "date": "2024-01-15",
  "entries": [
    {
      "exerciseName": "Bench Press",
      "sets": [
        { "reps": 10, "weight": 100, "unit": "kg" },
        { "reps": 8, "weight": 105, "unit": "kg" }
      ]
    }
  ]
}

→ 201 Created
{
  "date": "2024-01-15",
  "userId": "uuid",
  "entries": [
    {
      "id": "uuid",
      "exerciseName": "Bench Press",
      "sets": [
        { "id": "uuid", "reps": 10, "weight": 100, "unit": "kg", "weightKg": 100 }
      ],
      "createdAt": "2024-01-15T01:00:00.000Z"
    }
  ]
}
```

---

## TDD: Write unit tests FIRST

File: `test/unit/use-cases/log-workout.use-case.spec.ts`

---

## Deliverables

### [ ] `test/unit/use-cases/log-workout.use-case.spec.ts`

```typescript
import { createMockRepository } from '../../repositories/workout-repository.mock';
import { LogWorkoutUseCase } from '../../../src/modules/workout/use-cases/log-workout.use-case';

describe('LogWorkoutUseCase', () => {
  let useCase: LogWorkoutUseCase;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    useCase = new LogWorkoutUseCase(repo);
  });

  it('calls repo.saveEntries with normalized weightKg', async () => {
    repo.saveEntries.mockResolvedValue([/* mock entry */]);
    await useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Squat', sets: [{ reps: 5, weight: 100, unit: 'kg' }] }],
    });
    expect(repo.saveEntries).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      '2024-01-15',
      [expect.objectContaining({
        sets: [expect.objectContaining({ weightKg: 100 })],
      })],
    );
  });

  it('normalizes lb weight to kg before saving', async () => {
    repo.saveEntries.mockResolvedValue([/* mock entry */]);
    await useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Bench', sets: [{ reps: 5, weight: 220.46, unit: 'lb' }] }],
    });
    expect(repo.saveEntries).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      [expect.objectContaining({
        sets: [expect.objectContaining({ weightKg: expect.closeTo(100, 1) })],
      })],
    );
  });

  it('throws EMPTY_ENTRIES when entries array is empty', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [],
    })).rejects.toThrow('EMPTY_ENTRIES');
  });

  it('throws EMPTY_SETS when an entry has empty sets', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Squat', sets: [] }],
    })).rejects.toThrow('EMPTY_SETS');
  });

  it('throws INVALID_REPS when reps is 0', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Squat', sets: [{ reps: 0, weight: 100, unit: 'kg' }] }],
    })).rejects.toThrow('INVALID_REPS');
  });

  it('throws INVALID_WEIGHT when weight is negative', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Squat', sets: [{ reps: 5, weight: -1, unit: 'kg' }] }],
    })).rejects.toThrow('INVALID_WEIGHT');
  });

  it('throws INVALID_UNIT for unsupported unit', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: 'Squat', sets: [{ reps: 5, weight: 100, unit: 'stone' }] }],
    })).rejects.toThrow('INVALID_UNIT');
  });

  it('throws INVALID_EXERCISE_NAME for empty exercise name', async () => {
    await expect(useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [{ exerciseName: '', sets: [{ reps: 5, weight: 100, unit: 'kg' }] }],
    })).rejects.toThrow('INVALID_EXERCISE_NAME');
  });

  it('handles multiple entries in one request', async () => {
    repo.saveEntries.mockResolvedValue([/* 2 mock entries */]);
    await useCase.execute({
      userId: '00000000-0000-0000-0000-000000000001',
      date: '2024-01-15',
      entries: [
        { exerciseName: 'Bench Press', sets: [{ reps: 10, weight: 100, unit: 'kg' }] },
        { exerciseName: 'Squat',       sets: [{ reps: 5,  weight: 140, unit: 'kg' }] },
      ],
    });
    expect(repo.saveEntries).toHaveBeenCalledWith(
      expect.anything(), expect.anything(),
      expect.arrayContaining([
        expect.objectContaining({ exerciseName: 'Bench Press' }),
        expect.objectContaining({ exerciseName: 'Squat' }),
      ]),
    );
  });
});
```

---

### [ ] `src/modules/workout/dto/log-workout.dto.ts`

```typescript
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsNotEmpty,
  IsNumber, IsString, IsUUID, Min, ValidateNested,
} from 'class-validator';

export class WorkoutSetDto {
  @IsInt() @Min(1)
  reps: number;

  @IsNumber() @Min(0.001)
  weight: number;

  @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb';
}

export class WorkoutEntryDto {
  @IsString() @IsNotEmpty()
  exerciseName: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => WorkoutSetDto)
  sets: WorkoutSetDto[];
}

export class LogWorkoutDto {
  @IsDateString()
  date: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => WorkoutEntryDto)
  entries: WorkoutEntryDto[];
}

export class LogWorkoutQueryDto {
  @IsUUID()
  userId: string;
}
```

> **Note:** `ArrayMinSize(1)` on `entries` and `sets` via class-validator will produce a 400 via `GlobalExceptionFilter`. For domain-level errors like `INVALID_REPS` and `INVALID_WEIGHT`, the use-case validates and throws. Both layers complement each other.

---

### [ ] `src/modules/workout/use-cases/log-workout.use-case.ts`

```typescript
@Injectable()
export class LogWorkoutUseCase {
  constructor(@Inject(WORKOUT_REPOSITORY) private readonly repo: IWorkoutRepository) {}

  async execute(dto: { userId: string; date: string; entries: WorkoutEntryDto[] }) {
    if (!dto.entries || dto.entries.length === 0) throw new Error('EMPTY_ENTRIES');

    const mapped = dto.entries.map((entry) => {
      if (!entry.exerciseName?.trim()) throw new Error('INVALID_EXERCISE_NAME');
      if (!entry.sets || entry.sets.length === 0) throw new Error('EMPTY_SETS');

      const sets = entry.sets.map((s) => {
        if (!Number.isInteger(s.reps) || s.reps <= 0) throw new Error('INVALID_REPS');
        if (typeof s.weight !== 'number' || s.weight <= 0) throw new Error('INVALID_WEIGHT');
        const weightKg = toKg(s.weight, s.unit);  // throws INVALID_UNIT if unit unknown
        return { reps: s.reps, weight: s.weight, unit: s.unit, weightKg };
      });

      return { exerciseName: entry.exerciseName, sets };
    });

    const saved = await this.repo.saveEntries(dto.userId, dto.date, mapped);
    return { date: dto.date, userId: dto.userId, entries: saved };
  }
}
```

---

### [ ] Controller handler — `POST /workouts`

```typescript
@Post()
@HttpCode(201)
@ApiOperation({ summary: 'Log one or more workout entries' })
@ApiResponse({ status: 201, description: 'Workout logged successfully' })
@ApiResponse({ status: 400, description: 'Validation error' })
async logWorkout(
  @Query() query: LogWorkoutQueryDto,
  @Body() dto: LogWorkoutDto,
) {
  return this.logWorkoutUseCase.execute({ ...dto, userId: query.userId });
}
```

---

### [ ] `test/integration/log-workout.spec.ts`

```typescript
describe('POST /workouts', () => {
  it('201 — creates entries with correct weightKg')
  it('201 — lb input is normalized to kg in response weightKg')
  it('201 — multiple entries in one request')
  it('400 EMPTY_ENTRIES — entries: []')
  it('400 EMPTY_SETS — entry with sets: []')
  it('400 INVALID_REPS — reps: 0')
  it('400 INVALID_WEIGHT — weight: -1')
  it('400 INVALID_UNIT — unit: "stone"')
  it('400 INVALID_DATE — date: "not-a-date"')
  it('400 INVALID_USER_ID — missing userId query param')
  it('400 INVALID_USER_ID — userId: "not-uuid"')
  it('201 — concurrent posts for same userId+date+exercise do not error')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=log-workout.use-case` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=log-workout` → GREEN
- [ ] `weightKg` is computed at write time via `toKg()` — never at read time
- [ ] Response includes `id` for each entry and each set
- [ ] `date` in response is the input date string (not a timestamp)
