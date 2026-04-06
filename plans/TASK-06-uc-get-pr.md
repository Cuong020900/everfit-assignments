# TASK-06 — UC-3: Personal Records (PRs)

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~1.5 hours |
| **Blocks** | TASK-09 |
| **Blocked by** | TASK-03, TASK-04 |
| **Commit message** | `feat: implement GET /workouts/pr endpoint with 3 PR types` |

---

## Goal

`GET /workouts/pr` — returns three PR types per exercise: heaviest weight, highest volume set, and best estimated 1RM (Epley formula). Supports optional time-range comparison (current vs previous period).

> **Route ordering:** `GET /workouts/pr` **must be registered before** `GET /workouts/:id` in the controller to avoid NestJS treating `pr` as an `:id` param.

---

## Endpoint Contract

```
GET /workouts/pr
  ?userId=uuid                  required
  &exerciseName=Bench Press     optional
  &from=2024-01-01              optional
  &to=2024-01-31                optional
  &compareTo=previousPeriod     optional
  &unit=kg                      optional, default kg

→ 200 OK
{
  "data": [
    {
      "exerciseName": "Bench Press",
      "prs": {
        "maxWeight": { "value": 120, "unit": "kg", "reps": 5,  "achievedAt": "2024-01-10" },
        "maxVolume": { "value": 900, "unit": "kg", "reps": 10, "achievedAt": "2024-01-08" },
        "bestOneRM": { "value": 134.0, "unit": "kg", "reps": 5,"achievedAt": "2024-01-10" }
      }
    }
  ]
}
```

---

## PR Definitions

| Type | Formula | SQL |
|------|---------|-----|
| `maxWeight` | Heaviest single set | `MAX(weight_kg)` |
| `maxVolume` | Best volume single set | `MAX(weight_kg * reps)` |
| `bestOneRM` | Epley estimated 1RM | `MAX(weight_kg * (1 + reps / 30.0))` |

---

## TDD: Write unit tests FIRST

```bash
test/unit/use-cases/get-pr.use-case.spec.ts
```

---

## Deliverables

### [ ] `test/unit/use-cases/get-pr.use-case.spec.ts`

```typescript
describe('GetPRUseCase', () => {
  it('returns all 3 PR types for each exercise')

  it('maxWeight picks set with highest weight_kg', async () => {
    // fixture: two sets — 100kg×10reps, 120kg×3reps
    // expected maxWeight.value = 120, reps = 3
  });

  it('maxVolume picks set with highest weight_kg*reps', async () => {
    // fixture: 120kg×3reps (360), 100kg×10reps (1000)
    // expected maxVolume.value = 1000 (100kg×10)
  });

  it('bestOneRM uses Epley formula: weight * (1 + reps/30)', async () => {
    // fixture: 100kg×10reps → 1RM = 100*(1+10/30) = 133.33
    // fixture: 120kg×3reps  → 1RM = 120*(1+3/30)  = 132
    // expected bestOneRM.value ≈ 133.33 (100×10 wins)
  });

  it('achievedAt returns the workout date of the winning set')
  it('filters by exerciseName when provided')
  it('returns empty array for unknown exerciseName')
  it('converts values to lb when unit=lb requested')

  it('compareTo=previousPeriod calculates delta', async () => {
    // current period: 120kg, previous period: 115kg
    // expected delta: +5kg, +4.35%
  });
});
```

---

### [ ] `src/modules/workout/dto/get-pr.dto.ts`

```typescript
export class GetPRDto {
  @IsUUID()                             userId: string;
  @IsOptional() @IsString()             exerciseName?: string;
  @IsOptional() @IsDateString()         from?: string;
  @IsOptional() @IsDateString()         to?: string;
  @IsOptional() @IsEnum(['previousPeriod']) compareTo?: 'previousPeriod';
  @IsOptional() @IsEnum(['kg', 'lb'])   unit: 'kg' | 'lb' = 'kg';
}
```

---

### [ ] `src/modules/workout/use-cases/get-pr.use-case.ts`

Key logic:
1. Call `repo.findPRs(userId, exerciseName?, from?, to?)`
2. For each PR result, build response shape with `value` converted to requested `unit`
3. If `compareTo === 'previousPeriod'`:
   - Derive previous period from `from`/`to` (same duration, immediately before)
   - Call `repo.findPRs()` again for previous window
   - Compute `deltaKg` and `deltaPct` for `maxWeight`

```typescript
// Previous period derivation:
const duration = dayjs(to).diff(dayjs(from), 'day') + 1;
const prevTo   = dayjs(from).subtract(1, 'day').format('YYYY-MM-DD');
const prevFrom = dayjs(prevTo).subtract(duration - 1, 'day').format('YYYY-MM-DD');
```

---

### [ ] Controller — GET /workouts/pr handler

```typescript
// IMPORTANT: declare before any @Get(':id') route
@Get('pr')
@ApiOperation({ summary: 'Get personal records per exercise' })
async getPR(@Query() dto: GetPRDto) {
  return this.getPRUseCase.execute(dto);
}
```

---

### [ ] `test/integration/get-pr.spec.ts`

```typescript
describe('GET /workouts/pr', () => {
  it('200 — returns all 3 PR types for user with data')
  it('200 — maxWeight, maxVolume, bestOneRM are mathematically correct')
  it('200 — empty array for user with no data')
  it('200 — empty array for unknown exerciseName')
  it('200 — unit=lb converts all values')
  it('200 — compareTo=previousPeriod returns delta')
  it('400 INVALID_USER_ID — missing userId')
});
```

---

## Acceptance Criteria

- [ ] `pnpm test:unit -- --testPathPattern=get-pr` → GREEN
- [ ] `pnpm test:integration -- --testPathPattern=get-pr` → GREEN
- [ ] `maxWeight` is NOT Epley — it is raw `MAX(weight_kg)`
- [ ] `bestOneRM` uses Epley: `weight_kg * (1 + reps / 30)`
- [ ] Route `/workouts/pr` does not conflict with `/workouts/:id`
- [ ] `compareTo=previousPeriod` delta is only returned for `maxWeight`
