# TASK-11 — Final Integration Pass & Docker Verification

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~30 minutes |
| **Blocks** | — (final task) |
| **Blocked by** | TASK-10 |
| **Commit message** | `chore: final verification — all tests green, Docker clean start confirmed` |

---

## Goal

Confirm the project is fully submission-ready. Everything runs from a clean state. All tests pass. All acceptance criteria from all tasks are met.

---

## Checklist

### Docker clean start
- [ ] `docker compose down -v` — remove all volumes
- [ ] `docker compose up --build` — from scratch
- [ ] Migrations run automatically on start (no manual steps)
- [ ] `GET http://localhost:3000/api/docs` → 200, Swagger UI renders all 5 endpoints
- [ ] `GET http://localhost:3000` or any invalid route → structured JSON error (not HTML)

---

### Test suite
- [ ] `pnpm test:unit` → all GREEN, 0 failures
- [ ] `pnpm test:integration` → all GREEN, 0 failures (requires Docker DB running on port 5433)
- [ ] `pnpm test:cov` → report generated, no runtime errors

---

### Manual smoke tests (via Swagger UI or curl)

```bash
# 1. Log a workout
curl -s -X POST "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","entries":[{"exerciseName":"Bench Press","sets":[{"reps":10,"weight":100,"unit":"kg"}]}]}'
# Expected: 201 with entry id

# 2. Get history
curl -s "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001"
# Expected: 200 with data array

# 3. Get PRs
curl -s "http://localhost:3000/workouts/pr?userId=00000000-0000-0000-0000-000000000001"
# Expected: 200 with prs.maxWeight, prs.maxVolume, prs.bestOneRM

# 4. Get progress
curl -s "http://localhost:3000/workouts/progress?userId=00000000-0000-0000-0000-000000000001&exerciseName=Bench%20Press"
# Expected: 200 with data array (may be insufficientData:true with only 1 entry)

# 5. Get insights
curl -s "http://localhost:3000/workouts/insights?userId=00000000-0000-0000-0000-000000000001"
# Expected: 200 with insights array

# 6. Validation error
curl -s -X POST "http://localhost:3000/workouts?userId=bad-uuid" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","entries":[]}'
# Expected: 400 { "statusCode": 400, "error": "EMPTY_ENTRIES"|"INVALID_USER_ID", "message": "..." }

# 7. Limit exceeded
curl -s "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001&limit=101"
# Expected: 400 { "error": "LIMIT_EXCEEDED" }
```

---

### Code quality
- [ ] No `console.log` statements left in source (only Pino logger)
- [ ] No `TODO` / `FIXME` comments left uncommitted
- [ ] No `synchronize: true` anywhere
- [ ] No hardcoded credentials (all from env/config)
- [ ] `pnpm build` succeeds with zero TypeScript errors in strict mode

---

### Git history
- [ ] Commits are clean, iterative, and descriptive
- [ ] Each task corresponds to at most 1–2 commits
- [ ] No `.env` file committed (only `.env.example`)
- [ ] `node_modules/` not committed (verify `.gitignore`)

---

### Assessment requirements checklist

From `interview_assetment.md`:

- [ ] GitHub repository with clean commit history ✓
- [ ] `docker compose up` works out of the box ✓
- [ ] All 5 endpoints implemented and working ✓
- [ ] `README.md` with architecture, setup, schema, trade-offs ✓
- [ ] `AI_WORKFLOW.md` with tools, ≥2 mistakes, ≥1 rejection, strategy ✓
- [ ] Video walkthrough ready (15–20 min, English, covers 6 required points) ← manual step

---

## Video Walkthrough Checklist (6 required points from assessment)

1. [ ] Architecture overview — explain modules, use-cases, repository pattern
2. [ ] Database design — schema, indexes, why PostgreSQL
3. [ ] API walkthrough — demo all 5 endpoints via Swagger or Postman
4. [ ] TDD approach — show a test, explain Red→Green→Refactor
5. [ ] Scale strategy — explain materialized views, Redis, partitioning plan
6. [ ] AI workflow — how Claude + Context7 were used, what was corrected/rejected

---

## Acceptance Criteria

- [ ] All items above checked
- [ ] Project is ready to submit
