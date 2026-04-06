# Phase 04 — ExerciseMetadataService (Insights + Plugin Pattern)

**Priority:** High
**Status:** 🔲 todo
**Blocked by:** Phase 01

## Endpoint

- `GET /workouts/insights?userId=<uuid>&from=...&to=...` — workout summary & insights

## Plugin Architecture (OCP)

Adding a new insight type = one new class + one line in the module. No existing code modified.

```ts
// Interface
export interface InsightPlugin {
  readonly key: string;
  compute(data: WorkoutData): InsightResult;
}

// DI token
export const INSIGHT_PLUGINS = 'INSIGHT_PLUGINS';

// Module registration (multi: true)
{ provide: INSIGHT_PLUGINS, useClass: MostTrainedPlugin, multi: true }
{ provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyPlugin, multi: true }
{ provide: INSIGHT_PLUGINS, useClass: MuscleGroupBalancePlugin, multi: true }
{ provide: INSIGHT_PLUGINS, useClass: GapsPlugin, multi: true }
```

## WorkoutData shape (input to plugins)

```ts
interface WorkoutData {
  userId: string;
  from?: string;
  to?: string;
  entries: Array<{
    date: string;               // 'YYYY-MM-DD'
    exerciseName: string;
    muscleGroup: string | null;  // from exercise_metadata join
    sets: Array<{ reps: number; weightKg: number }>;
  }>;
}
```

## TDD Order: Red → Green → Refactor

### Step 1: Write failing unit tests for each plugin

**File:** `test/unit/insights/most-trained.plugin.spec.ts`
```
✅ returns exercises sorted by session count descending
✅ includes volume (sum of reps × weightKg) per exercise
✅ returns top 5 by default
✅ handles empty data → returns empty array
```

**File:** `test/unit/insights/training-frequency.plugin.spec.ts`
```
✅ counts sessions per week correctly
✅ a "session" = unique date with at least one entry
✅ returns average sessions/week across the period
✅ handles period < 1 week → returns count directly
✅ handles empty data → returns 0
```

**File:** `test/unit/insights/muscle-group-balance.plugin.spec.ts`
```
✅ groups exercises by muscle group
✅ computes % share of volume per muscle group
✅ exercises with null muscleGroup go into "unknown" bucket
✅ handles all-unknown → returns { unknown: 100 }
✅ returns empty map for empty data
```

**File:** `test/unit/insights/gaps.plugin.spec.ts`
```
✅ identifies exercises not performed in 2+ weeks
✅ "previously regular" = performed in the 4 weeks before the gap
✅ does not flag exercises that were only done once ever
✅ does not flag exercises done within 14 days of `to` date
✅ handles empty data → returns empty array
```

**File:** `test/unit/use-cases/get-insights.service.spec.ts`
```
✅ aggregates results from all plugins into one response
✅ passes WorkoutData to all plugins
✅ plugin with empty result is still included in response (empty array/object)
✅ calls repo.findWorkoutData with userId/from/to
```

### Step 2: Implement plugin classes

**File:** `src/modules/exercise-metadata/plugins/most-trained.plugin.ts`
```ts
@Injectable()
export class MostTrainedPlugin implements InsightPlugin {
  readonly key = 'mostTrained';
  compute(data: WorkoutData): InsightResult { ... }
}
```

**File:** `src/modules/exercise-metadata/plugins/training-frequency.plugin.ts`
**File:** `src/modules/exercise-metadata/plugins/muscle-group-balance.plugin.ts`
**File:** `src/modules/exercise-metadata/plugins/gaps.plugin.ts`

**Gaps detection logic:**
```ts
// For each exercise, find its last date in the data window.
// If lastDate < (to - 14 days) AND exercise appeared at least 2x
//   in the 28 days before lastDate → flag as gap.
const twoWeeksAgo = subtractDays(to, 14);
const prevWindow = subtractDays(lastDate, 28);
const regularCount = entries
  .filter(e => e.exerciseName === ex && e.date >= prevWindow && e.date <= lastDate)
  .length;
if (lastDate < twoWeeksAgo && regularCount >= 2) flag as gap;
```

### Step 3: Implement `ExerciseMetadataService`

**File:** `src/modules/exercise-metadata/exercise-metadata.service.ts`

```ts
@Injectable()
export class ExerciseMetadataService {
  constructor(
    @Inject(EXERCISE_METADATA_REPOSITORY)
    private readonly repo: IExerciseMetadataRepository,
    @Inject(INSIGHT_PLUGINS)
    private readonly plugins: InsightPlugin[],
  ) {}

  async getInsights(dto: GetInsightsDTO): Promise<InsightsResult> {
    const rawData = await this.repo.findWorkoutData(dto.userId, dto.from, dto.to);
    const workoutData: WorkoutData = { userId: dto.userId, from: dto.from, to: dto.to, entries: rawData };

    const insights: Record<string, InsightResult> = {};
    for (const plugin of this.plugins) {
      insights[plugin.key] = plugin.compute(workoutData);
    }
    return insights;
  }
}
```

### Step 4: Implement `TypeOrmExerciseMetadataRepository`

**File:** `src/modules/exercise-metadata/repositories/typeorm-exercise-metadata.repository.ts`

```ts
// findWorkoutData:
// SELECT we.date, we.exercise_name, em.muscle_group, ws.reps, ws.weight_kg
// FROM workout_entries we
// JOIN workout_sets ws ON ws.entry_id = we.id
// LEFT JOIN exercise_metadata em ON em.name = we.exercise_name
// WHERE we.user_id = :userId
// AND (we.date >= :from if provided)
// AND (we.date <= :to if provided)
// ORDER BY we.date DESC
```

### Step 5: Wire module

**File:** `src/modules/exercise-metadata/exercise-metadata.module.ts`
```ts
providers: [
  ExerciseMetadataService,
  { provide: EXERCISE_METADATA_REPOSITORY, useClass: TypeOrmExerciseMetadataRepository },
  { provide: INSIGHT_PLUGINS, useClass: MostTrainedPlugin, multi: true },
  { provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyPlugin, multi: true },
  { provide: INSIGHT_PLUGINS, useClass: MuscleGroupBalancePlugin, multi: true },
  { provide: INSIGHT_PLUGINS, useClass: GapsPlugin, multi: true },
]
```

### Step 6: Wire controller

**File:** `src/modules/exercise-metadata/exercise-metadata.controller.ts`
```ts
@Get('insights')
async getInsights(@Query() dto: GetInsightsDTO) {
  return this.service.getInsights(dto);
}
```

## Response Shape

```json
{
  "data": {
    "mostTrained": [
      { "exerciseName": "Bench Press", "sessions": 12, "volume": 48000 }
    ],
    "trainingFrequency": { "sessionsPerWeek": 3.5, "totalSessions": 14 },
    "muscleGroupBalance": {
      "chest": 35.2, "back": 28.1, "legs": 20.4, "shoulders": 16.3
    },
    "gaps": [
      { "exerciseName": "Deadlift", "lastPerformed": "2024-01-01", "daysSince": 21 }
    ]
  }
}
```

## Success Criteria

- All plugin unit tests green
- Adding a 5th plugin = 1 new class + 1 line in module (OCP validated)
- `ExerciseMetadataService` spec passes with mocked plugins
- Gaps logic: 2-week threshold, previously-regular check works
- Muscle group balance: handles null muscleGroup → "unknown" bucket
