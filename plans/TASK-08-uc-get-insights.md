# TASK-08 — UC-5: Insights & Plugin System

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~2 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/insights with plugin-based architecture` |

---

## Goal

`GET /workouts/insights?userId={uuid}` — runs a set of insight plugins over the user's workout data and returns all results. Plugin system follows Open/Closed Principle: add insight = add class + register, no existing code changes.

---

## Endpoint Contract

```
GET /workouts/insights
  ?userId=uuid               required
  &from=2024-01-01           optional, default 30 days ago
  &to=2024-01-06             optional, default today

→ 200 OK
{
  "period": { "from": "2023-12-07", "to": "2024-01-06" },
  "insights": [
    {
      "name": "most-trained",
      "data": {
        "byFrequency": [{ "exercise": "Bench Press", "sessionCount": 12 }],
        "byVolume":    [{ "exercise": "Squat", "totalVolumeKg": 42000 }]
      }
    },
    {
      "name": "training-frequency",
      "data": { "sessionsPerWeek": 4.2, "totalSessions": 17, "weeksAnalyzed": 4 }
    },
    {
      "name": "muscle-balance",
      "data": {
        "distribution": { "push": 45, "pull": 30, "legs": 25 },
        "warnings": ["Pull volume is lower than recommended 1:1 ratio with Push"]
      }
    },
    {
      "name": "neglected-exercise",
      "data": {
        "exercises": [
          { "name": "Deadlift", "lastSeenDaysAgo": 18 }
        ]
      }
    }
  ]
}

→ 200 (no data)
{
  "period": { ... },
  "insights": [],
  "message": "No workout data found for the given period"
}
```

---

## Plugin Architecture

```typescript
// InsightPlugin interface (defined in TASK-03)
interface InsightPlugin {
  readonly name: string;
  compute(data: WorkoutData): InsightResult | null;
}

// Registration (multi: true DI)
providers: [
  { provide: INSIGHT_PLUGINS, useClass: MostTrainedPlugin,          multi: true },
  { provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyPlugin,    multi: true },
  { provide: INSIGHT_PLUGINS, useClass: MuscleBalancePlugin,        multi: true },
  { provide: INSIGHT_PLUGINS, useClass: NeglectedExercisePlugin,    multi: true },
]

// GetInsightsUseCase receives:
@Inject(INSIGHT_PLUGINS) private readonly plugins: InsightPlugin[]
```

---

## TDD: Write unit tests FIRST

Files:
- `test/unit/use-cases/get-insights.use-case.spec.ts`
- `test/unit/insights/most-trained.plugin.spec.ts`
- `test/unit/insights/training-frequency.plugin.spec.ts`
- `test/unit/insights/muscle-balance.plugin.spec.ts`
- `test/unit/insights/neglected-exercise.plugin.spec.ts`

---

## Deliverables

### [ ] `test/unit/use-cases/get-insights.use-case.spec.ts`

```typescript
describe('GetInsightsUseCase', () => {
  it('runs all registered plugins and returns their results')
  it('excludes plugins that return null (insufficient data)')
  it('returns insights: [] + message when no workout data in window')
  it('passes correct date range to repo.findWorkoutData')
  it('throws INVALID_DATE_RANGE when from is after to')
  it('defaults from to 30 days ago and to to today')
});
```

---

### [ ] `src/modules/workout/use-cases/get-insights.use-case.ts`

```typescript
@Injectable()
export class GetInsightsUseCase {
  constructor(
    @Inject(WORKOUT_REPOSITORY) private readonly repo: IWorkoutRepository,
    @Inject(INSIGHT_PLUGINS) private readonly plugins: InsightPlugin[],
  ) {}

  async execute(dto: GetInsightsDto) {
    if (dto.from && dto.to && dto.from > dto.to) throw new Error('INVALID_DATE_RANGE');

    const to = dto.to ?? new Date().toISOString().slice(0, 10);
    const from = dto.from ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().slice(0, 10);
    })();

    const data = await this.repo.findWorkoutData(dto.userId, from, to);

    if (data.entries.length === 0) {
      return {
        period: { from, to },
        insights: [],
        message: 'No workout data found for the given period',
      };
    }

    const insights = this.plugins
      .map((p) => p.compute(data))
      .filter((r): r is InsightResult => r !== null);

    return { period: { from, to }, insights };
  }
}
```

---

### [ ] `src/modules/workout/plugins/most-trained.plugin.ts`

```typescript
// name: 'most-trained'
// byFrequency: count distinct dates per exercise (1 session = 1 distinct date+exercise combo)
// byVolume: SUM(weight_kg × reps) per exercise across all sets

compute(data: WorkoutData): InsightResult | null {
  if (data.entries.length === 0) return null;

  // Group by exerciseName
  // sessionCount: count unique dates for each exercise
  // totalVolumeKg: sum(weightKg * reps) for each exercise

  // Sort by sessionCount DESC, then by totalVolumeKg DESC
  // Return top N (all exercises, sorted)
}
```

---

### [ ] `test/unit/insights/most-trained.plugin.spec.ts`

```typescript
describe('MostTrainedPlugin', () => {
  it('counts sessions by distinct date not by entry count')
  it('sorts byFrequency in descending session count order')
  it('sorts byVolume in descending total volume order')
  it('returns null when data.entries is empty')
  it('same exercise on same date counts as 1 session, not 2')
});
```

---

### [ ] `src/modules/workout/plugins/training-frequency.plugin.ts`

```typescript
// name: 'training-frequency'
// sessionsPerWeek = totalSessions / weeksAnalyzed
// weeksAnalyzed = ceil(daysDiff / 7) where daysDiff = (to - from) in days
// totalSessions = count distinct (date) values in entries

compute(data: WorkoutData): InsightResult | null {
  if (data.entries.length === 0) return null;

  const distinctDates = new Set(data.entries.map((e) => e.date));
  const totalSessions = distinctDates.size;
  const from = new Date(data.from);
  const to = new Date(data.to);
  const daysDiff = (to.getTime() - from.getTime()) / 86_400_000 + 1;
  const weeksAnalyzed = Math.max(1, Math.ceil(daysDiff / 7));
  const sessionsPerWeek = Math.round((totalSessions / weeksAnalyzed) * 100) / 100;

  return { name: 'training-frequency', data: { sessionsPerWeek, totalSessions, weeksAnalyzed } };
}
```

---

### [ ] `test/unit/insights/training-frequency.plugin.spec.ts`

```typescript
describe('TrainingFrequencyPlugin', () => {
  it('returns null when no entries')
  it('calculates sessionsPerWeek correctly for 30-day window')
  it('distinct dates only — same exercise logged twice same day counts once')
  it('weeksAnalyzed rounds up (e.g. 31 days = 5 weeks)')
  it('sessionsPerWeek rounds to 2 decimal places')
});
```

---

### [ ] `src/modules/workout/plugins/muscle-balance.plugin.ts`

```typescript
// name: 'muscle-balance'
// Requires exercise_metadata to map exerciseName → muscleGroup
// WorkoutData doesn't include muscleGroup — need to resolve from metadata
// Options:
//   A) Pass metadata map into WorkoutData (add muscleGroup to WorkoutDataEntry)
//   B) Inject ExerciseMetadataService into the plugin
// → Option A: simplest. findWorkoutData enriches entries with muscleGroup if available.

// distribution: percentage of total volume per muscle group
// warnings: flag if any group is < 33% of max group volume
//   → "Pull volume is lower than recommended 1:1 ratio with Push"

compute(data: WorkoutData): InsightResult | null {
  const grouped = groupVolumeByMuscle(data.entries);  // uses entry.muscleGroup (nullable)
  if (Object.keys(grouped).length < 2) return null;   // need ≥2 groups to show balance

  const total = Object.values(grouped).reduce((a, b) => a + b, 0);
  const distribution = Object.fromEntries(
    Object.entries(grouped).map(([k, v]) => [k, Math.round((v / total) * 100)])
  );

  const warnings: string[] = buildWarnings(distribution);
  return { name: 'muscle-balance', data: { distribution, warnings } };
}
```

---

### [ ] `test/unit/insights/muscle-balance.plugin.spec.ts`

```typescript
describe('MuscleBalancePlugin', () => {
  it('returns null when fewer than 2 muscle groups in data')
  it('calculates correct percentage distribution')
  it('percentages sum to ~100 (rounding acceptable)')
  it('generates warning when pull < push volume')
  it('no warnings when distribution is balanced')
  it('ignores entries with null muscleGroup')
});
```

---

### [ ] `src/modules/workout/plugins/neglected-exercise.plugin.ts`

```typescript
// name: 'neglected-exercise'
// Threshold: absent for ≥14 days (from analysis window end date)
// "Previously regular" = appeared in the analysis window at least once before the 14-day gap

// Algorithm:
// 1. Find all exercises that appeared in data.entries
// 2. For each exercise, find max(date)
// 3. daysSinceLastSeen = (data.to - maxDate) in days
// 4. If daysSinceLastSeen >= 14 → neglected

compute(data: WorkoutData): InsightResult | null {
  if (data.entries.length === 0) return null;

  const to = new Date(data.to);
  const byExercise = new Map<string, Date>();

  for (const e of data.entries) {
    const d = new Date(e.date);
    const current = byExercise.get(e.exerciseName);
    if (!current || d > current) byExercise.set(e.exerciseName, d);
  }

  const neglected = [...byExercise.entries()]
    .map(([name, lastDate]) => {
      const daysAgo = Math.floor((to.getTime() - lastDate.getTime()) / 86_400_000);
      return { name, lastSeenDaysAgo: daysAgo };
    })
    .filter((e) => e.lastSeenDaysAgo >= 14)
    .sort((a, b) => b.lastSeenDaysAgo - a.lastSeenDaysAgo);

  if (neglected.length === 0) return null;
  return { name: 'neglected-exercise', data: { exercises: neglected } };
}
```

---

### [ ] `test/unit/insights/neglected-exercise.plugin.spec.ts`

```typescript
describe('NeglectedExercisePlugin', () => {
  it('returns null when no entries')
  it('flags exercises last seen >= 14 days before window end')
  it('does NOT flag exercises last seen < 14 days before window end')
  it('exercises last seen exactly 14 days ago ARE flagged')
  it('returns null when no exercises are neglected')
  it('sorts by lastSeenDaysAgo descending')
});
```

---

### [ ] `src/modules/workout/dto/get-insights.dto.ts`

```typescript
export class GetInsightsDto {
  @IsUUID()
  userId: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;
}
```

---

### [ ] `test/integration/get-insights.spec.ts`

```typescript
describe('GET /workouts/insights', () => {
  it('200 — returns all 4 insight plugins')
  it('200 — most-trained counts sessions not entries')
  it('200 — training-frequency sessionsPerWeek is correct')
  it('200 — neglected-exercise flags exercises not seen for 14+ days')
  it('200 — no data returns insights: [] + message')
  it('400 INVALID_DATE_RANGE — from after to')
  it('400 INVALID_USER_ID — missing userId')
  it('200 — plugin returning null is excluded from output')
});
```

---

### [ ] Register plugins in `WorkoutModule`

```typescript
providers: [
  { provide: WORKOUT_REPOSITORY, useClass: TypeOrmWorkoutRepository },
  { provide: INSIGHT_PLUGINS, useClass: MostTrainedPlugin,          multi: true },
  { provide: INSIGHT_PLUGINS, useClass: TrainingFrequencyPlugin,    multi: true },
  { provide: INSIGHT_PLUGINS, useClass: MuscleBalancePlugin,        multi: true },
  { provide: INSIGHT_PLUGINS, useClass: NeglectedExercisePlugin,    multi: true },
  LogWorkoutUseCase,
  GetHistoryUseCase,
  GetPRUseCase,
  GetProgressUseCase,
  GetInsightsUseCase,
],
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=insights|get-insights` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-insights` → GREEN
- [ ] Adding a new plugin class requires NO changes to `GetInsightsUseCase` or controller
- [ ] Plugin returning `null` is silently excluded from response
- [ ] `neglected-exercise` threshold is exactly 14 days (≥ 14 = neglected)
- [ ] `muscle-balance` requires exercise_metadata (gracefully skips unmapped exercises)
