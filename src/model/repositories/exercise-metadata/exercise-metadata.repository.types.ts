export interface WorkoutSetData {
  reps: number;
  weightKg: number;
}

export interface WorkoutEntryData {
  date: string;
  exerciseName: string;
  muscleGroup: string | null;
  sets: WorkoutSetData[];
}

export interface InsightQuery {
  userId: string;
  from?: string;
  to?: string;
}
