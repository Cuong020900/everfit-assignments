---
phase: 04
title: AI_WORKFLOW.md — Document AI-Assisted Development
status: completed
priority: P0
effort: 20min
---

# Phase 04 — AI_WORKFLOW.md

Create `AI_WORKFLOW.md` documenting how AI tools were used during development,
including corrections made, suggestions rejected, and prompting strategy.

## Context Links

- `docs/interview_assetment.md` §Deliverables — "describe how you used AI assistance"
- `git log --oneline` — 12 commits showing actual development progression

## What the Assignment Requires

From `interview_assetment.md`:
> "An AI_WORKFLOW.md file that describes:
> - Which AI tools you used and for what
> - At least 2 examples of where AI output was wrong/suboptimal and how you corrected it
> - At least 1 example of where you rejected an AI suggestion and why
> - Your general prompting strategy"

## Content to Include

### 1. AI Tools Used

- **Claude Code (claude.ai/code)** — primary driver for all implementation
  - `/ck:plan` skill — generated architecture and implementation plans
  - `/ck:cook` skill — drove TDD implementation loop (Red → Green → Refactor)
  - `/ck:scout` — explored codebase to inform planning
  - General Q&A — TypeORM behaviour, NestJS DI patterns

### 2. Examples of AI Mistakes Corrected (≥2)

**Mistake 1: Overengineered initial module structure**
- AI initially proposed a single `WorkoutModule` with all services, controllers, and repositories in one module — mirroring the CLAUDE.md `Architecture` section literally
- Correction: Refactored into 3 separate bounded modules (`WorkoutEntryModule`, `WorkoutSetModule`, `ExerciseMetadataModule`) matching domain boundaries — commit `f8fc61d refactor: codebase structure (overengineering)`
- Why it mattered: The single-module approach created circular dependencies between PR logic and history logic

**Mistake 2: `TransformResponseInterceptor` double-wrapping**
- AI added a `{ data: ... }` key in the interceptor AND services were returning `{ data: ... }` shaped objects — causing `{ data: { data: [...], meta: ... } }` double-wrapped responses
- Correction: Services return plain data types (e.g., `{ data: T[], pagination }` for lists, `{ data: T }` for singles). Interceptor only adds `meta`. Services are unaware of the HTTP envelope.
- Why it mattered: Integration tests were failing with unexpected `data.data` nesting — caught in `b4e8241 fix: resolve integration test failures`

**Mistake 3 (if needed): PRSetResult missing exerciseName**
- AI's initial `findPRSets` query selected only `reps, weight_kg, date` — missing `exercise_name`
- This made grouping by exercise impossible in the service layer
- Correction: Added `e.exercise_name AS "exerciseName"` to the SELECT and updated the repository type

### 3. Example of Rejected AI Suggestion (≥1)

**Rejected: Auto-run migrations in seed**
- AI suggested adding migration execution logic inside the seed script to ensure DB is ready before seeding
- Rejected because: migrations already run automatically on NestJS bootstrap (`migrationsRun: true` in TypeORM config). Adding migration logic in the seed script would violate SRP and create a second code path for a responsibility that's already handled.
- Alternative chosen: Document in README that seed runs after `docker compose up` (migrations already applied)

**Rejected: Redis cache for PR queries**
- AI suggested adding a Redis cache layer for `GET /workouts/pr` since it involves table scans
- Rejected because: YAGNI. The assignment scope is a fitness app for personal use — not a high-traffic service. Adding Redis increases operational complexity for no demonstrated benefit at this scale. The composite index `(user_id, exercise_name, date DESC)` handles the query efficiently.

### 4. Prompting Strategy

Key principles used:
- **Specific file paths in prompts** — "Update `src/modules/workout-set/dto/get-pr.dto.ts` to add..." rather than "Update the PR DTO"
- **Acceptance criteria first** — defined what "done" looks like before asking for implementation
- **TDD framing** — prompted with the failing test assertion, not the desired output
- **Incremental scope** — one endpoint at a time, not all 5 at once
- **Reference existing patterns** — "Follow the same pattern as `WorkoutEntryRepository.findHistory`"

## Todo List

- [ ] Write `AI_WORKFLOW.md` root file
- [ ] Section 1: Tools used + their purpose
- [ ] Section 2: ≥2 AI mistakes with specific examples + commit references
- [ ] Section 3: ≥1 rejected suggestion with reasoning
- [ ] Section 4: Prompting strategy (≥4 principles)
- [ ] Be honest — describe actual workflow, not a sanitised version

## Success Criteria

- File exists at repo root `AI_WORKFLOW.md`
- Covers all 4 required sections from the assignment
- At least 2 specific AI mistakes with concrete examples
- At least 1 rejected suggestion with clear reasoning
- Prompting strategy reflects actual technique used
- Written in first person, honest tone
