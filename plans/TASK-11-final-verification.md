# TASK-11 — Final Integration Pass & Docker Verification

## Metadata

| Field | Value |
|-------|-------|
| **Status** | `[ ]` Pending |
| **Estimated effort** | ~30 minutes |
| **Blocks** | — (last task) |
| **Blocked by** | TASK-10 |
| **Commit message** | `chore: final verification — docker compose, all tests green, submission checklist` |

---

## Goal

End-to-end verification pass. Nothing gets shipped until all items below are ✅.

---

## Checklist

### Docker

- [ ] `docker compose down -v && docker compose up --build` — full clean start succeeds
- [ ] API container starts without crashing
- [ ] Database migrations run automatically on container start (check logs: "Migration ran successfully")
- [ ] Exercise seed data present: `SELECT name FROM exercise_metadata;` returns ≥10 rows
- [ ] `curl http://localhost:3000/api/docs` returns 200 (Swagger UI)
- [ ] `curl -X POST "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001" ...` returns 201

### Tests

- [ ] `pnpm test` — all unit tests GREEN (no failures, no skips)
- [ ] `pnpm test:integration` — all integration tests GREEN (requires DB on port 5433)
- [ ] `pnpm test:cov` — coverage report generated (no minimum %, but no untested use-cases)
- [ ] Zero `console.error` or unhandled promise rejection in test output

### Build

- [ ] `pnpm build` — TypeScript compiles with zero errors
- [ ] `pnpm lint` — Biome reports zero errors (warnings acceptable)
- [ ] `pnpm check` — lint + format + import sort all pass

### API Smoke Test

Run these manually against `docker compose up`:

```bash
# UC-1: Log workout
curl -s -X POST "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"date":"2024-01-15","entries":[{"exerciseName":"Bench Press","sets":[{"reps":10,"weight":100,"unit":"kg"}]}]}' \
  | jq .

# UC-2: History
curl -s "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001" | jq .

# UC-3: PRs
curl -s "http://localhost:3000/workouts/pr?userId=00000000-0000-0000-0000-000000000001" | jq .

# UC-4: Progress
curl -s "http://localhost:3000/workouts/progress?userId=00000000-0000-0000-0000-000000000001&exerciseName=Bench+Press" | jq .

# UC-5: Insights
curl -s "http://localhost:3000/workouts/insights?userId=00000000-0000-0000-0000-000000000001" | jq .

# Error cases
curl -s "http://localhost:3000/workouts?userId=not-a-uuid" | jq .  # → 400 INVALID_USER_ID
curl -s "http://localhost:3000/workouts?userId=00000000-0000-0000-0000-000000000001&limit=101" | jq .  # → 400 LIMIT_EXCEEDED
```

### Submission Checklist

- [ ] GitHub repository with clean, iterative commit history (one commit per task)
- [ ] `README.md` — architecture diagram, setup instructions, API docs, schema, trade-offs, scale strategy
- [ ] `AI_WORKFLOW.md` — tools used, ≥2 AI mistakes corrected, ≥1 AI suggestion rejected, prompting strategy
- [ ] `docker compose up` works out of the box
- [ ] Video walkthrough (English, 15–20 min) covering:
  1. Project architecture and design decisions
  2. API demonstration (all 5 endpoints)
  3. Test suite walkthrough
  4. Docker compose demo
  5. Code walkthrough (use-cases, repository, plugin system)
  6. Scale-up strategy discussion

---

## Common Issues to Check

| Issue | Where to look |
|-------|---------------|
| Static routes shadowed by `/:id` | `workout.controller.ts` route ordering |
| `synchronize: true` leaking into test | `config/config.test.yaml` |
| Migration not running on Docker start | `docker-compose.yml` command line |
| Cursor with `+` chars causing 400 | base64url vs base64 (must use `base64url`) |
| Weekly period format wrong | SQL `TO_CHAR(DATE_TRUNC('week',..))` with `IYYY-"W"IW` |
| PR `achievedAt` wrong (exercise date, not set date) | Correlated subquery in `findPRs()` |

---

## Acceptance Criteria

- [ ] All 5 endpoints respond correctly to the smoke test above
- [ ] All error scenarios return `{ statusCode, error, message }`
- [ ] `docker compose up --build` → zero configuration required
- [ ] All unit + integration tests green
- [ ] Submission checklist complete
