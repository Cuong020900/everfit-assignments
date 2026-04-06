/** Epley estimated 1-rep max: weight × (1 + reps / 30), rounded to 4 decimal places. */
export function epley1RM(weightKg: number, reps: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10000) / 10000;
}
