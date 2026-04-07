export interface PRSetResult {
  reps: number;
  weightKg: number;
  date: string;
  exerciseName: string;
}

export interface PRQuery {
  userId: string;
  exerciseName?: string;
  from?: string;
  to?: string;
}

export interface ProgressSetResult {
  date: string;
  reps: number;
  weightKg: number;
}

export interface ProgressQuery {
  userId: string;
  exerciseName: string;
  from?: string;
  to?: string;
}
