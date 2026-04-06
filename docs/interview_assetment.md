# Everfit Backend Engineer Assignment

Thank you for your interest in joining Everfit!

As part of our hiring process, we'd like you to complete a short assignment to help us understand your skills, problem-solving approach, and attention to detail.

---

## 🧭 Purpose of the Test

This test evaluates: **system design, technical depth, problem-solving, production readiness, code quality, and AI-first workflow.**

---

## 💻 Your Test Assignment

### Overview

Build a **Workout Logging API** that allows coaches to track client workout metrics over time.

### Context

Everfit is a fitness coaching platform. Coaches create workout programs for their clients. This API powers the workout tracking experience — logging exercises, tracking personal records, and visualizing progress over time.

---

## Requirements

### Core Features

#### 1. Log a workout entry

Create an entry with: `userId`, `date`, `exerciseName`, `sets` (array of `{ reps, weight, unit }`)

- Weight units: `kg`, `lb`
- Auto-convert and store a normalized value (`kg`) alongside the original
- Support bulk logging: multiple exercises in a single request

#### 2. Get workout history

List all workout entries for a user, filterable by:

- Exercise name (partial match supported)
- Date range
- Muscle group (if exercise metadata is available)
- Return in the unit the user specifies (convert if needed)
- Paginated with cursor-based or offset pagination

#### 3. Get personal records (PRs)

For a given user and exercise, return:

- Heaviest single set (max weight)
- Highest volume set (reps × weight)
- Best estimated 1RM (using Epley formula: `weight × (1 + reps/30)`)
- Include the date each PR was achieved
- Support comparing PRs across a time range (e.g., "PR this month vs last month")

#### 4. Get progress chart data

For a user + exercise + time period (1M, 3M, 6M, custom range):

- Return the best set per day (by weight)
- Return in user-specified unit
- Support aggregation modes: **daily** (default), **weekly** (average of daily bests), **monthly**
- Include volume trend (total reps × weight per period) alongside weight trend

#### 5. Workout summary & insights

For a given user and time period:

- Most trained exercises (by frequency and volume)
- Training frequency (sessions per week)
- Muscle group balance analysis (requires exercise → muscle group mapping)
- Identify potential gaps: exercises not performed in 2+ weeks that were previously regular

---

### Edge Cases & Error Handling

The system must handle gracefully:

- Invalid or unsupported weight units
- Missing or malformed request fields (null date, negative weight/reps, empty sets array)
- Date ranges with no data (return empty result with appropriate message, not an error)
- Exercises with only 1 data point (no trend possible — communicate this clearly)
- Timezone handling: document your strategy (UTC storage recommended, explain trade-offs)
- Concurrent writes: same user logging same exercise at same time
- Large datasets: endpoints must perform well with 50,000+ workout entries per user

---

### Architecture & Extensibility

- Adding a new unit type (e.g., `stone`) should require minimal code changes
- Exercise → muscle group mapping should be configurable (not hardcoded in business logic)
- The insights endpoint (#5) should be designed so new insight types can be added without modifying existing ones (strategy/plugin pattern or similar)

---

### Technical Constraints

- **NodeJS** (NestJS recommended — justify if you choose otherwise)
- **Database:** MongoDB or PostgreSQL (justify your choice, explain schema design and indexing strategy)
- Any AI coding tools are encouraged (Claude, Copilot, Cursor, etc.)
- No authentication required — pass `userId` as a parameter

---

## What We Evaluate

| Criteria                 | What we look for                                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **System design**        | Schema design, indexing strategy, query efficiency for aggregations, normalization approach                                |
| **API design**           | RESTful conventions, consistent error responses, pagination, filtering, input validation                                   |
| **Code architecture**    | Separation of concerns, extensibility (insights plugin pattern, unit conversion abstraction), dependency injection         |
| **Problem-solving**      | Aggregation logic, 1RM calculation, muscle group balance, timezone handling, bulk operations                               |
| **Error handling**       | Graceful failures, structured error responses, validation at boundaries, meaningful messages                               |
| **Testing**              | Unit tests for calculations, integration tests for API endpoints, edge case coverage. We value test design over coverage % |
| **Production readiness** | Docker setup, structured logging, configuration management, performance awareness                                          |
| **AI adoption**          | See below                                                                                                                  |

---

## AI Adoption Evaluation (Critical)

We are an **AI-first engineering team**. We evaluate **how you use AI**, not whether you use it.

You must provide:

### 1. AI workflow log

A brief markdown file (`AI_WORKFLOW.md`) documenting:

- Which AI tools you used and for what purpose (architecture, coding, testing, debugging, documentation)
- At least **2 examples where AI output was wrong or suboptimal** and how you corrected it
- At least **1 example where you rejected an AI suggestion** and why
- Your prompting strategy — did you give the AI full context? Break tasks into smaller prompts? Use system prompts or rules files?

### 2. Commit history

We will review your git log. We expect to see:

- Evidence of iterative development (not one giant commit)
- Meaningful commit messages
- Evidence that you reviewed and refined AI-generated code (not blind copy-paste)

### What we're NOT looking for:

- We don't care if 90% of the code was AI-generated — that's fine
- We don't penalize for using AI on any part of the assignment

### What we ARE looking for:

- Can you **direct AI effectively** to produce production-quality code?
- Can you **identify when AI output is wrong**?
- Can you **debug issues** in AI-generated code?
- Do you **understand the code** AI wrote for you well enough to explain and extend it?

---

## 📩 Submission Instructions

When you complete the test, please provide:

1. **GitHub repository** with clean commit history

2. **README.md** with:

   - Architecture overview (a diagram is a plus)
   - Setup instructions (must work with `docker compose up` or clear step-by-step)
   - API documentation (endpoints, request/response format, error codes)
   - Database schema explanation and design decisions
   - Trade-offs and what you would change at scale

3. **AI_WORKFLOW.md** (see above)

4. **Video walkthrough** (English, 15–20 min) covering:
   - Architecture decisions and why
   - Demo of all APIs working, including edge cases and error handling
   - Walk through the insights endpoint (#5) — how would you add a new insight type?
   - Walk through your AI_WORKFLOW.md — show us your AI process
   - Pick one piece of AI-generated code and explain what it does line-by-line
   - What would you change if this API served 10,000 concurrent coaches?
