# Phase 03 — WorkoutSetService (Get PR + Get Progress)

**Priority:** High
**Status:** 🔲 todo
**Blocked by:** Phase 01

## Endpoints

- `GET /workouts/pr?userId=<uuid>&exerciseName=...` — personal records
- `GET /workouts/progress?userId=<uuid>&exerciseName=...` — progress chart data

## TDD Order: Red → Green → Refactor

### Step 1: Write failing unit tests first

**File:** `test/unit/use-cases/get-pr.service.spec.ts`

```
describe('GetPRService')

✅ returns heaviest single set (max weight_kg)
✅ returns highest volume set (max reps × weight_kg)
✅ returns best estimated 1RM using Epley formula: weight*(1+reps/30)
✅ includes date for each PR
✅ returns weights in requested unit (converts from kg)
✅ returns PR comparison when compareTo='previousPeriod'
✅ comparison: previous period spans same length before `from`
✅ returns null for each PR field when no data exists
✅ handles single data point (no trend but PR is valid)
✅ filters by exerciseName when provided
✅ filters by date range when from/to provided
```

**File:** `test/unit/use-cases/get-progress.service.spec.ts`

```
describe('GetProgressService')

✅ returns best set per day (max weight_kg per date)
✅ groups by week (average of daily bests)
✅ groups by month (average of daily bests per month)
✅ returns weight in requested unit
✅ includes volume trend (total reps × weight per period)
✅ returns empty array when no data in range
✅ returns single point data without error (communicates "no trend")
✅ respects from/to date range
✅ throws MISSING_EXERCISE_NAME if exerciseName is absent
```

**File:** `test/unit/utils/epley.spec.ts` (or inline in get-pr spec)

```
describe('Epley 1RM formula')
✅ weight * (1 + reps/30) rounded to 4 decimal places
✅ 100kg x 5 reps → 100*(1+5/30) = 116.6667 kg
✅ 1 rep → same as weight (1+1/30 = 1.0333... rounded)
```

### Step 2: Implement `WorkoutSetService`

**File:** `src/modules/workout-set/workout-set.service.ts`

```ts
@Injectable()
export class WorkoutSetService {
  constructor(
    @Inject(WORKOUT_SET_REPOSITORY)
    private readonly repo: IWorkoutSetRepository,
  ) {}

  async getPRs(dto: GetPRDTO): Promise<PRResult> {
    const sets = await this.repo.findPRSets({
      userId: dto.userId,
      exerciseName: dto.exerciseName,
      from: dto.from,
      to: dto.to,
    });

    if (sets.length === 0) return { maxWeight: null, maxVolume: null, best1RM: null };

    const maxWeight = sets.reduce((best, s) => s.weightKg > best.weightKg ? s : best);
    const maxVolume = sets.reduce((best, s) =>
      s.reps * s.weightKg > best.reps * best.weightKg ? s : best
    );
    const best1RM = sets.reduce((best, s) => {
      const orm = s.weightKg * (1 + s.reps / 30);
      const bestOrm = best.weightKg * (1 + best.reps / 30);
      return orm > bestOrm ? s : best;
    });

    return {
      maxWeight: { weight: fromKg(maxWeight.weightKg, dto.unit), unit: dto.unit, date: maxWeight.date },
      maxVolume: { reps: maxVolume.reps, weight: fromKg(maxVolume.weightKg, dto.unit), unit: dto.unit, date: maxVolume.date },
      best1RM: { estimated1RM: fromKg(best1RM.weightKg * (1 + best1RM.reps / 30), dto.unit), unit: dto.unit, date: best1RM.date },
      // If compareTo='previousPeriod', fetch previous period sets and compute same metrics
    };
  }

  async getProgress(dto: GetProgressDTO): Promise<ProgressResult> {
    if (!dto.exerciseName) throw new Error('MISSING_EXERCISE_NAME');
    const series = await this.repo.findProgressSeries({...});
    return this.aggregateSeries(series, dto.groupBy, dto.unit);
  }
}
```

**Epley formula** (pure function, extract to `src/shared/utils/epley.ts`):
```ts
export function epley1RM(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10000) / 10000;
}
```

**Aggregation modes:**
- `daily`: return one point per calendar date, value = max `weight_kg` that day
- `weekly`: group dates into ISO weeks, value = average of daily bests
- `monthly`: group by YYYY-MM, value = average of daily bests

**Volume trend** (per period): sum of `reps × weight_kg` for all sets in the period.

### Step 3: Implement `TypeOrmWorkoutSetRepository`

**File:** `src/modules/workout-set/repositories/typeorm-workout-set.repository.ts`

```ts
// findPRSets: join workout_sets + workout_entries
// SELECT ws.*, we.date, we.exercise_name
// FROM workout_sets ws
// JOIN workout_entries we ON ws.entry_id = we.id
// WHERE we.user_id = :userId
// AND (we.exercise_name = :exerciseName if provided)
// AND (we.date >= :from AND we.date <= :to if provided)

// findProgressSeries: same join + ORDER BY we.date ASC
// Returns: { date, weightKg, reps } per set
```

### Step 4: Previous period comparison logic

When `compareTo='previousPeriod'`:
1. Compute period length: `to - from` in days
2. Previous period: `from - length` to `from - 1`
3. Fetch PR sets for previous period
4. Return both `current` and `previous` PR objects in response

```ts
// In service:
if (dto.compareTo === 'previousPeriod' && dto.from && dto.to) {
  const fromDate = new Date(dto.from);
  const toDate = new Date(dto.to);
  const days = (toDate.getTime() - fromDate.getTime()) / 86400000;
  const prevTo = new Date(fromDate.getTime() - 86400000).toISOString().split('T')[0];
  const prevFrom = new Date(fromDate.getTime() - (days + 1) * 86400000).toISOString().split('T')[0];
  const prevSets = await this.repo.findPRSets({ ...query, from: prevFrom, to: prevTo });
  // compute prevPR from prevSets
}
```

### Step 5: Wire controller and module

**File:** `src/modules/workout-set/workout-set.controller.ts`
```ts
@Get('pr')
async getPRs(@Query() dto: GetPRDTO) {
  return this.service.getPRs(dto);
}

@Get('progress')
async getProgress(@Query() dto: GetProgressDTO) {
  return this.service.getProgress(dto);
}
```

**File:** `src/modules/workout-set/workout-set.module.ts`
```ts
providers: [
  WorkoutSetService,
  { provide: WORKOUT_SET_REPOSITORY, useClass: TypeOrmWorkoutSetRepository },
]
```

## Response Shapes

```json
// GET /workouts/pr
{
  "data": {
    "maxWeight": { "weight": 120, "unit": "kg", "date": "2024-01-15" },
    "maxVolume": { "reps": 10, "weight": 100, "unit": "kg", "date": "2024-01-10" },
    "best1RM": { "estimated1RM": 133.33, "unit": "kg", "date": "2024-01-15" },
    "previous": null  // populated when compareTo=previousPeriod
  }
}

// GET /workouts/progress
{
  "data": {
    "series": [
      { "period": "2024-01-15", "bestWeight": 120, "volume": 3000, "unit": "kg" }
    ],
    "groupBy": "daily",
    "note": null  // "Insufficient data for trend" when only 1 point
  }
}
```

## Success Criteria

- All unit tests green
- Epley formula: `weight * (1 + reps/30)` exact
- PR comparison returns previous period data correctly
- Progress aggregation: daily/weekly/monthly all work
- Single-data-point case returns data with `note: "Insufficient data for trend"`
- No unit conversion in repository queries — all in `weight_kg`
