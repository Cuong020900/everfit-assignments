# TASK-08 — UC-5: Insights & Plugin System

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~2 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/insights with extensible plugin architecture` |

---

## Goal

`GET /workouts/insights` — returns training analytics for the analysis window. Plugin-based architecture: each insight is an independent class implementing `InsightPlugin`. Adding a new insight = creating a new class + registering it. No existing code modified (OCP).

---

## Endpoint Contract

```
GET /workouts/insights
  ?userId=uuid          required
  &from=2023-12-07      optional (default: 30 days ago)
  &to=2024-01-06        optional (default: today)

→ 200 OK
{
  "period": { "from": "2023-12-07", "to": "2024-01-06" },
  "insights": [
    { "name": "most-trained",       "data": { ... } },
    { "name": "training-frequency", "data": { "sessionsPerWeek": 4.2 } },
    { "name": "muscle-balance",     "data": { ... } },
    { "name": "neglected-exercise", "data": { ... } }
  ]
}
```

No workout data → `{ "period": {...}, "insights": [], "message": "No workout data found for the given period" }`

---

## Plugin Interface

```typescript
export interface InsightResult {
  name: string;
  data: Record<string, any>;
}

export interface InsightPlugin {
  readonly name: string;
  compute(data: WorkoutData): InsightResult | null;
  // Return null if insufficient data — plugin is silently excluded from response
}

export const INSIGHT_PLUGINS = Symbol('INSIGHT_PLUGINS');
```

---

## Plugin Registration Pattern (NestJS DI)

```typescript
// workout.module.ts
providers: [
  { provide: INSIGHT_PLUGINS, useClass: MostTrainedInsight,       multi: true },
  { provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyInsight, multi: true },
  { provide: INSIGHT_PLUGINS, useClass: MuscleBalanceInsight,     multi: true },
  { provide: INSIGHT_PLUGINS, useClass: NeglectedExerciseInsight, multi: true },
  // Adding a 5th plugin = add ONE line here only
]
```

`GetInsightsUseCase` injects `@Inject(INSIGHT_PLUGINS) private plugins: InsightPlugin[]`

---

## TDD: Write tests FIRST (4 plugin specs + 1 use-case spec)

```bash
test/unit/insights/most-trained.insight.spec.ts
test/unit/insights/training-frequency.insight.spec.ts
test/unit/insights/muscle-balance.insight.spec.ts
test/unit/insights/neglected-exercise.insight.spec.ts
test/unit/use-cases/get-insights.use-case.spec.ts
```

---

## Deliverables

### [ ] Plugin 1: `most-trained.insight.ts`

**Tests:**
```typescript
describe('MostTrainedInsight', () => {
  it('ranks exercises by frequency (session count per exercise per day)')
  it('ranks exercises by volume (SUM weight_kg * reps)')
  it('returns top 5 for each dimension')
  it('returns null when data has no entries')
});
```

**Output shape:**
```json
{
  "name": "most-trained",
  "data": {
    "byFrequency": [
      { "exercise": "Bench Press", "sessionCount": 12 },
      { "exercise": "Squat",       "sessionCount": 10 }
    ],
    "byVolume": [
      { "exercise": "Squat",       "totalVolumeKg": 42000 },
      { "exercise": "Bench Press", "totalVolumeKg": 38500 }
    ]
  }
}
```

---

### [ ] Plugin 2: `training-frequency.insight.ts`

**Tests:**
```typescript
describe('TrainingFrequencyInsight', () => {
  it('calculates sessionsPerWeek = totalSessions / weeksAnalyzed')
  it('counts unique workout days as sessions (not individual exercises)')
  it('handles partial first/last weeks without skewing the average')
  it('returns null when fewer than 2 sessions')
});
```

**Output shape:**
```json
{
  "name": "training-frequency",
  "data": {
    "sessionsPerWeek": 4.2,
    "totalSessions": 17,
    "weeksAnalyzed": 4
  }
}
```

---

### [ ] Plugin 3: `muscle-balance.insight.ts`

**Tests:**
```typescript
describe('MuscleBalanceInsight', () => {
  it('calculates volume % per muscle group')
  it('flags warning when push:pull ratio < 0.8 or > 1.25')
  it('excludes exercises not found in exercise_metadata (no muscleGroup)')
  it('returns null when no exercises have metadata')
});
```

**Output shape:**
```json
{
  "name": "muscle-balance",
  "data": {
    "distribution": { "push": 45, "pull": 30, "legs": 25 },
    "warnings": ["Pull volume is lower than recommended push:pull ratio"]
  }
}
```

---

### [ ] Plugin 4: `neglected-exercise.insight.ts`

**Tests:**
```typescript
describe('NeglectedExerciseInsight', () => {
  it('flags exercise absent for >= 14 days that was present before that in window')
  it('does NOT flag exercise never performed in window')
  it('does NOT flag exercise performed within last 14 days')
  it('includes lastSeenDaysAgo in result')
  it('returns null when no exercises qualify')
});
```

**Neglected threshold:** absent for **≥ 14 days** from the analysis window end date, but present at least once before that cutoff within the window.

**Output shape:**
```json
{
  "name": "neglected-exercise",
  "data": {
    "exercises": [
      { "name": "Deadlift",          "lastSeenDaysAgo": 18 },
      { "name": "Romanian Deadlift", "lastSeenDaysAgo": 21 }
    ]
  }
}
```

---

### [ ] `test/unit/use-cases/get-insights.use-case.spec.ts`

```typescript
describe('GetInsightsUseCase', () => {
  it('calls all registered plugins with WorkoutData')
  it('excludes plugins that return null')
  it('returns insights:[] with message when no workout data in window')
  it('does not throw if one plugin throws — catches and excludes it')
  it('defaults from/to to last 30 days')
  it('passes period to response')
});
```

---

### [ ] `src/modules/workout/use-cases/get-insights.use-case.ts`

```typescript
@Injectable()
export class GetInsightsUseCase {
  constructor(
    @Inject(WORKOUT_REPOSITORY) private readonly repo: IWorkoutRepository,
    @Inject(INSIGHT_PLUGINS)    private readonly plugins: InsightPlugin[],
  ) {}

  async execute(dto: GetInsightsDto) {
    const from = dto.from ?? defaultFrom();
    const to   = dto.to   ?? defaultTo();

    const workoutData = await this.repo.findWorkoutData(dto.userId, from, to);

    if (!workoutData.entries.length) {
      return { period: { from, to }, insights: [], message: 'No workout data found for the given period' };
    }

    const insights = this.plugins
      .map((plugin) => {
        try { return plugin.compute(workoutData); }
        catch { return null; }
      })
      .filter((r): r is InsightResult => r !== null);

    return { period: { from, to }, insights };
  }
}
```

---

### [ ] Controller — GET /workouts/insights handler

```typescript
// Declare before @Get(':id')
@Get('insights')
@ApiOperation({ summary: 'Get training insights for the analysis window' })
async getInsights(@Query() dto: GetInsightsDto) {
  return this.getInsightsUseCase.execute(dto);
}
```

---

### [ ] `test/integration/get-insights.spec.ts`

```typescript
describe('GET /workouts/insights', () => {
  it('200 — all 4 plugins return data for user with sufficient data')
  it('200 — insights:[] with message when no data in window')
  it('200 — plugin with insufficient data is excluded silently')
  it('200 — most-trained returns both byFrequency and byVolume')
  it('200 — neglected-exercise flags exercise absent >= 14 days')
  it('400 INVALID_DATE_RANGE — from after to')
  it('400 INVALID_USER_ID — missing userId')
  // Extensibility test:
  it('200 — adding a 6th plugin does not break response shape')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test:unit -- --testPathPattern=insights` → all 4 plugin specs GREEN
- [ ] `pnpm test:unit -- --testPathPattern=get-insights` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-insights` → GREEN
- [ ] Adding a 5th plugin = add 1 class + 1 line in `workout.module.ts` only
- [ ] Plugin returning `null` is silently excluded (no 500 error)
- [ ] Plugin throwing is caught and excluded (no 500 error)
- [ ] Neglected exercise threshold is exactly 14 days
