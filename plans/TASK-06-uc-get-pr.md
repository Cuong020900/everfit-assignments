# TASK-06 — UC-3: Personal Records (PRs)

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/pr personal records endpoint` |

---

## Goal

`GET /workouts/pr?userId={uuid}` — returns three PR types per exercise. Supports optional time-range filter and previous-period comparison.

---

## Endpoint Contract

```
GET /workouts/pr
  ?userId=uuid               required
  &exerciseName=Bench Press  optional, exact/partial match
  &from=2024-01-01           optional, inclusive
  &to=2024-01-31             optional, inclusive
  &compareTo=previousPeriod  optional, triggers comparison block
  &unit=kg                   optional, default kg

→ 200 OK
{
  "data": [
    {
      "exerciseName": "Bench Press",
      "prs": {
        "maxWeight": { "value": 120, "unit": "kg", "reps": 5,  "achievedAt": "2024-01-10" },
        "maxVolume": { "value": 900, "unit": "kg", "reps": 10, "achievedAt": "2024-01-08" },
        "bestOneRM": { "value": 134.0, "unit": "kg", "reps": 5, "achievedAt": "2024-01-10" }
      },
      "comparison": {              // only when compareTo=previousPeriod
        "period":     { "from": "2024-01-01", "to": "2024-01-31" },
        "prevPeriod": { "from": "2023-12-01", "to": "2023-12-31" },
        "maxWeight":  { "current": 120, "previous": 115, "deltaKg": 5, "deltaPct": 4.35 }
      }
    }
  ]
}
```

---

## PR Formulas

| Type | Formula |
|------|---------|
| `maxWeight` | `MAX(weight_kg)` |
| `maxVolume` | `MAX(weight_kg × reps)` |
| `bestOneRM` | `MAX(weight_kg × (1 + reps / 30.0))` — Epley formula |

All computed in SQL — no application-layer loop aggregation.

---

## TDD: Write unit tests FIRST

File: `test/unit/use-cases/get-pr.use-case.spec.ts`

---

## Deliverables

### [ ] `test/unit/use-cases/get-pr.use-case.spec.ts`

```typescript
describe('GetPRUseCase', () => {
  it('returns all 3 PR types per exercise')
  it('converts PR values to requested unit')
  it('returns empty data array when no entries exist for user')
  it('throws INVALID_DATE_RANGE when from is after to')
  it('when compareTo=previousPeriod and from/to provided, returns comparison block')
  it('comparison prevPeriod spans same duration as current period')
  it('deltaPct rounds to 2 decimal places')
  it('deltaPct is null when previous value is 0')
  it('comparison block absent when compareTo param not provided')
});
```

---

### [ ] `src/common/utils/date-period.util.ts`

```typescript
// Calculates previous period of equal duration
// from='2024-01-01', to='2024-01-31' (31 days)
// → prevFrom='2023-12-01', prevTo='2023-12-31' (31 days back)

export function calcPreviousPeriod(from: string, to: string): { from: string; to: string } {
  const start = new Date(from);
  const end = new Date(to);
  const durationMs = end.getTime() - start.getTime() + 86_400_000; // +1 day inclusive
  const prevEnd = new Date(start.getTime() - 86_400_000);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 86_400_000);
  return {
    from: prevStart.toISOString().slice(0, 10),
    to: prevEnd.toISOString().slice(0, 10),
  };
}

export function calcDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}
```

> **Note:** Using native `Date` is sufficient here. `dayjs` is available if date arithmetic becomes complex — but this case doesn't need it.

---

### [ ] `test/unit/utils/date-period.util.spec.ts`

```typescript
describe('calcPreviousPeriod', () => {
  it('returns same-length period immediately before')
  it('handles month boundary correctly (Jan → Dec prior year)')
  it('single-day period returns day before')
})

describe('calcDeltaPct', () => {
  it('returns null when previous is 0')
  it('calculates positive delta correctly')
  it('calculates negative delta correctly')
  it('rounds to 2 decimal places')
})
```

---

### [ ] `src/modules/workout/dto/get-pr.dto.ts`

```typescript
export class GetPRDto {
  @IsUUID()
  userId: string;

  @IsOptional() @IsString()
  exerciseName?: string;

  @IsOptional() @IsDateString()
  from?: string;

  @IsOptional() @IsDateString()
  to?: string;

  @IsOptional() @IsEnum(['previousPeriod'])
  compareTo?: 'previousPeriod';

  @IsOptional() @IsEnum(['kg', 'lb'])
  unit: 'kg' | 'lb' = 'kg';
}
```

---

### [ ] `src/modules/workout/use-cases/get-pr.use-case.ts`

```typescript
async execute(dto: GetPRDto) {
  if (dto.from && dto.to && dto.from > dto.to) throw new Error('INVALID_DATE_RANGE');

  const results = await this.repo.findPRs(dto.userId, dto.exerciseName, dto.from, dto.to);

  if (results.length === 0) return { data: [] };

  const data = results.map((r) => {
    const prs = {
      maxWeight: {
        value: fromKg(r.maxWeightKg, dto.unit),
        unit: dto.unit,
        reps: r.maxWeightReps,
        achievedAt: r.maxWeightDate,
      },
      maxVolume: {
        value: fromKg(r.maxVolumeKg, dto.unit),
        unit: dto.unit,
        reps: r.maxVolumeReps,
        achievedAt: r.maxVolumeDate,
      },
      bestOneRM: {
        value: fromKg(r.bestOneRMKg, dto.unit),
        unit: dto.unit,
        reps: r.bestOneRMReps,
        achievedAt: r.bestOneRMDate,
      },
    };

    let comparison: Record<string, unknown> | undefined;
    if (dto.compareTo === 'previousPeriod' && dto.from && dto.to) {
      const prev = calcPreviousPeriod(dto.from, dto.to);
      const [prevResult] = await this.repo.findPRs(dto.userId, r.exerciseName, prev.from, prev.to);
      comparison = {
        period: { from: dto.from, to: dto.to },
        prevPeriod: prev,
        maxWeight: {
          current: fromKg(r.maxWeightKg, dto.unit),
          previous: prevResult ? fromKg(prevResult.maxWeightKg, dto.unit) : 0,
          deltaKg: prevResult ? fromKg(r.maxWeightKg - prevResult.maxWeightKg, dto.unit) : null,
          deltaPct: prevResult ? calcDeltaPct(r.maxWeightKg, prevResult.maxWeightKg) : null,
        },
      };
    }

    return { exerciseName: r.exerciseName, prs, ...(comparison ? { comparison } : {}) };
  });

  return { data };
}
```

> **Note on comparison volume query:** The spec shows only `maxWeight` in the comparison block example. Include it; add `maxVolume` and `bestOneRM` only if time allows. The spec doesn't show them in the comparison object, so `maxWeight` is sufficient for acceptance.

---

### [ ] Controller handler — `GET /workouts/pr`

```typescript
@Get('pr')
@ApiOperation({ summary: 'Get personal records per exercise' })
async getPRs(@Query() dto: GetPRDto) {
  return this.getPRUseCase.execute(dto);
}
```

**Must be declared BEFORE `@Get()` in the controller.**

---

### [ ] `test/integration/get-pr.spec.ts`

```typescript
describe('GET /workouts/pr', () => {
  it('200 — returns maxWeight, maxVolume, bestOneRM per exercise')
  it('200 — achievedAt date is correct for each PR type')
  it('200 — unit=lb converts all values')
  it('200 — exerciseName filter returns only that exercise')
  it('200 — no data returns { data: [] }')
  it('200 — from/to date range filters correctly')
  it('200 — compareTo=previousPeriod returns comparison block with correct prev period')
  it('400 INVALID_DATE_RANGE — from after to')
  it('400 INVALID_USER_ID — missing userId')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test -- --testPathPattern=get-pr` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-pr` → GREEN
- [ ] All 3 PR types returned per exercise
- [ ] `achievedAt` is the date of the workout set that achieved the PR
- [ ] `compareTo=previousPeriod` with `from`+`to` returns `comparison` block
- [ ] Previous period is same duration immediately before current period
- [ ] `deltaPct` is `null` when `previous` value is 0 (avoid divide-by-zero)
- [ ] `unit=lb` converts all weight values in response
