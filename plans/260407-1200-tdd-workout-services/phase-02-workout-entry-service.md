# Phase 02 — WorkoutEntryService (Log Workout + Get History)

**Priority:** High
**Status:** 🔲 todo
**Blocked by:** Phase 01

## Endpoints

- `POST /workouts?userId=<uuid>` — log workout entries
- `GET /workouts?userId=<uuid>&...` — get paginated workout history

## TDD Order: Red → Green → Refactor

### Step 1: Write failing unit tests first

**File:** `test/unit/use-cases/log-workout.service.spec.ts`

Test cases (write ALL before implementing):

```
describe('LogWorkoutService')

✅ saves entries with weight_kg computed at write time
✅ converts lb to kg correctly (stores 0.4536 kg for 1 lb)
✅ handles bulk: multiple exercises in one request
✅ throws EMPTY_ENTRIES when entries array is empty
✅ throws EMPTY_SETS when a set array is empty
✅ throws INVALID_UNIT for unsupported unit (e.g. 'stone')
✅ throws INVALID_WEIGHT for weight <= 0
✅ throws INVALID_REPS for reps < 1
✅ throws INVALID_DATE for malformed date string
✅ passes userId and date through to repository
```

**File:** `test/unit/use-cases/get-history.service.spec.ts`

Test cases:
```
describe('GetHistoryService')

✅ returns entries with weight converted to requested unit
✅ returns weight in kg by default
✅ converts kg→lb when unit=lb is requested
✅ returns nextCursor=null when no more pages
✅ returns nextCursor when more pages exist
✅ passes exerciseName filter to repository
✅ passes from/to date range to repository
✅ passes muscleGroup filter to repository
✅ uses default limit=20 when not specified
✅ respects caller-supplied limit
```

### Step 2: Implement `WorkoutEntryService`

**File:** `src/modules/workout-entry/workout-entry.service.ts`

```ts
@Injectable()
export class WorkoutEntryService {
  constructor(
    @Inject(WORKOUT_ENTRY_REPOSITORY)
    private readonly repo: IWorkoutEntryRepository,
  ) {}

  async logWorkout(userId: string, dto: LogWorkoutDTO): Promise<void> {
    if (dto.entries.length === 0) throw new Error('EMPTY_ENTRIES');
    // validate each entry/set, convert weight to kg, call repo.saveEntries()
  }

  async getHistory(dto: GetHistoryDTO): Promise<HistoryResult> {
    // call repo.findHistory(), convert weights in result to requested unit
  }
}
```

**Key logic:**
- `weight_kg` computed via `toKg(weight, unit)` at save time — never in queries
- Cursor: base64url-encoded `{ date, id }` JSON
- Weight in history result: `fromKg(set.weightKg, dto.unit)`
- Validate `dto.date` matches `YYYY-MM-DD` regex before saving

### Step 3: Implement `TypeOrmWorkoutEntryRepository`

**File:** `src/modules/workout-entry/repositories/typeorm-workout-entry.repository.ts`

```ts
@Injectable()
export class TypeOrmWorkoutEntryRepository implements IWorkoutEntryRepository {
  constructor(
    @InjectRepository(WorkoutEntry) private entryRepo: Repository<WorkoutEntry>,
  ) {}

  async saveEntries(userId, date, entries): Promise<void> {
    // Create WorkoutEntry + WorkoutSet entities, save with cascade
  }

  async findHistory(query: HistoryQuery): Promise<HistoryResult> {
    // QueryBuilder with:
    //   WHERE user_id = :userId
    //   AND (exercise_name ILIKE :name if provided)
    //   AND (date >= :from if provided)
    //   AND (date <= :to if provided)
    //   AND (exercise_name IN (SELECT name FROM exercise_metadata WHERE muscle_group = :mg) if muscleGroup)
    //   ORDER BY date DESC, id DESC
    //   LIMIT limit+1 (to detect next page)
    //   Cursor: WHERE (date, id) < (cursor.date, cursor.id)
  }
}
```

**Cursor decode/encode:**
```ts
// encode: Buffer.from(JSON.stringify({ date, id })).toString('base64url')
// decode: JSON.parse(Buffer.from(cursor, 'base64url').toString())
```

### Step 4: Wire up in module

**File:** `src/modules/workout-entry/workout-entry.module.ts`
```ts
providers: [
  WorkoutEntryService,
  { provide: WORKOUT_ENTRY_REPOSITORY, useClass: TypeOrmWorkoutEntryRepository },
]
```

### Step 5: Wire controller

**File:** `src/modules/workout-entry/workout-entry.controller.ts`
```ts
constructor(private readonly service: WorkoutEntryService) {}

@Post()
async logWorkout(@Query() q: LogWorkoutQueryDTO, @Body() dto: LogWorkoutDTO) {
  await this.service.logWorkout(q.userId, dto);
  return null; // 201 no body
}

@Get()
async getHistory(@Query() dto: GetHistoryDTO) {
  return this.service.getHistory(dto);
}
```

### Step 6: Run tests, confirm green

```bash
pnpm test -- --testPathPattern=log-workout
pnpm test -- --testPathPattern=get-history
```

## Validation Logic (in service, not DTO)

Domain validation belongs in the service layer (not just class-validator):
- `date`: must match `/^\d{4}-\d{2}-\d{2}$/`
- `reps`: integer ≥ 1
- `weight`: number > 0
- `unit`: must be 'kg' | 'lb'
- `entries.length`: ≥ 1
- Each `sets.length`: ≥ 1

> class-validator handles this at HTTP boundary; services throw domain errors for programmatic callers.

## Response Shape

```json
// GET /workouts
{
  "data": {
    "entries": [
      {
        "id": "uuid",
        "date": "2024-01-15",
        "exerciseName": "Bench Press",
        "sets": [{ "reps": 5, "weight": 100, "unit": "kg" }]
      }
    ],
    "nextCursor": "eyJkYXRlIjoiMjAyNC0wMS0xNSIsImlkIjoiYWJjZCJ9"
  }
}
```

## Success Criteria

- All unit tests green
- Weight conversion happens at write time (`weight_kg` stored)
- History returns weights in requested unit
- Cursor pagination works: `nextCursor` null when no more data
- Domain error codes thrown correctly
