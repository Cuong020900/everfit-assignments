#!/usr/bin/env bash

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-workout_db}"
DB_USER="${DB_USER:-workout}"
DB_PASSWORD="${DB_PASSWORD:-workout}"

USERS_COUNT="${USERS_COUNT:-5}"
ENTRIES_PER_USER="${ENTRIES_PER_USER:-10000}"
SETS_PER_ENTRY="${SETS_PER_ENTRY:-1}"
EXERCISE_VARIANTS="${EXERCISE_VARIANTS:-200}"
DATE_SPAN_DAYS="${DATE_SPAN_DAYS:-365}"
START_DATE="${START_DATE:-2023-01-01}"
START_MONTHS_AGO="${START_MONTHS_AGO:-}"

TRUNCATE_FIRST="${TRUNCATE_FIRST:-false}"

export PGPASSWORD="${DB_PASSWORD}"

run_psql() {
  psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" "$@"
}

resolve_start_date() {
  if [[ -n "${START_MONTHS_AGO}" ]]; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      date -v-"${START_MONTHS_AGO}"m '+%Y-%m-%d'
    else
      date -d "${START_MONTHS_AGO} months ago" '+%Y-%m-%d'
    fi
  else
    echo "${START_DATE}"
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

echo "==> Checking required tools"
require_cmd psql

echo "==> Target DB: ${DB_HOST}:${DB_PORT}/${DB_NAME}"
RESOLVED_START_DATE="$(resolve_start_date)"

if [[ "${TRUNCATE_FIRST}" == 'true' ]]; then
  echo "==> Truncating workout tables"
  run_psql -v ON_ERROR_STOP=1 -c "
    TRUNCATE TABLE workout_sets, workout_entries RESTART IDENTITY;
  "
fi

echo "==> Inserting fake data (no API calls)"
run_psql -v ON_ERROR_STOP=1 -c "
WITH users AS (
  SELECT
    (
      substr(md5('fake-user-' || u::text), 1, 8) || '-' ||
      substr(md5('fake-user-' || u::text), 9, 4) || '-' ||
      '4' || substr(md5('fake-user-' || u::text), 14, 3) || '-' ||
      '8' || substr(md5('fake-user-' || u::text), 18, 3) || '-' ||
      substr(md5('fake-user-' || u::text), 21, 12)
    )::uuid AS user_id
  FROM generate_series(1, ${USERS_COUNT}) AS u
),
entry_source AS (
  SELECT
    gen_random_uuid() AS id,
    u.user_id,
    (
      DATE '${RESOLVED_START_DATE}' +
      (((s - 1) % ${DATE_SPAN_DAYS})::int) +
      (((s - 1) / (${DATE_SPAN_DAYS} * ${EXERCISE_VARIANTS}))::int * (${DATE_SPAN_DAYS} + 1))
    )::date AS date,
    ('Exercise ' || (((s - 1) / ${DATE_SPAN_DAYS}) % ${EXERCISE_VARIANTS}))::text AS exercise_name,
    now() AS created_at,
    now() AS updated_at,
    (1 + ((random() * 11)::int))::int AS reps,
    (20 + (random() * 220))::numeric(10, 4) AS weight_kg
  FROM users u
  CROSS JOIN generate_series(1, ${ENTRIES_PER_USER}) AS s
),
inserted_entries AS (
  INSERT INTO workout_entries (id, user_id, date, exercise_name, created_at, updated_at)
  SELECT id, user_id, date, exercise_name, created_at, updated_at
  FROM entry_source
  RETURNING id
)
INSERT INTO workout_sets (id, entry_id, reps, weight, unit, weight_kg, created_at, updated_at)
SELECT
  gen_random_uuid(),
  es.id,
  es.reps,
  es.weight_kg,
  'kg',
  es.weight_kg,
  now(),
  now()
FROM entry_source es
JOIN inserted_entries ie ON ie.id = es.id
CROSS JOIN generate_series(1, ${SETS_PER_ENTRY});
"

echo "==> Updating planner stats"
run_psql -v ON_ERROR_STOP=1 -c "ANALYZE workout_entries; ANALYZE workout_sets;" >/dev/null

ENTRIES_TOTAL="$(run_psql -X -A -t -c 'SELECT count(*) FROM workout_entries;' | tr -d '[:space:]')"
SETS_TOTAL="$(run_psql -X -A -t -c 'SELECT count(*) FROM workout_sets;' | tr -d '[:space:]')"
USERS_TOTAL="$(run_psql -X -A -t -c 'SELECT count(DISTINCT user_id) FROM workout_entries;' | tr -d '[:space:]')"

echo "==> Done"
echo "Users in dataset: ${USERS_TOTAL}"
echo "Total workout_entries: ${ENTRIES_TOTAL}"
echo "Total workout_sets: ${SETS_TOTAL}"
