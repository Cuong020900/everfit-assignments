export interface WorkoutSetInput {
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface WorkoutEntryInput {
  exerciseName: string;
  sets: WorkoutSetInput[];
}

export interface HistorySetResult {
  reps: number;
  weightKg: number;
  unit: string;
}

export interface HistoryEntryResult {
  id: string;
  date: string;
  exerciseName: string;
  sets: HistorySetResult[];
}

export interface HistoryQuery {
  userId: string;
  limit: number;
  cursor?: string;
  exerciseName?: string;
  from?: string;
  to?: string;
  muscleGroup?: string;
}

export interface HistoryResult {
  entries: HistoryEntryResult[];
  nextCursor: string | null;
}

export interface SavedSetData {
  id: string;
  reps: number;
  weight: number;
  unit: string;
  weightKg: number;
}

export interface SavedWorkoutEntry {
  id: string;
  exerciseName: string;
  sets: SavedSetData[];
  createdAt: string; // ISO 8601 UTC
}
