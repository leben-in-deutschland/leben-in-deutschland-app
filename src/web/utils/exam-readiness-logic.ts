import { MockTestProgress } from "@/types/user";

/**
 * Calculate exam readiness percentage.
 *
 * Rules (matching ExamReadiness component):
 * - Only non-cancelled tests count
 * - If total non-cancelled tests <= 8, readiness is 0%
 * - Otherwise, percentage = (passed / totalSubmitted) * 100
 */
export function calculateExamReadiness(
  testProgress: MockTestProgress[]
): number {
  const nonCancelled = testProgress.filter((t) => !t.cancelled);
  const totalSubmitted = nonCancelled.length;
  const passed = nonCancelled.filter((t) => t.passed).length;

  if (totalSubmitted <= 8) {
    return 0;
  }

  return (passed / totalSubmitted) * 100;
}

/**
 * Determine if the user is exam-ready (>= 75%).
 */
export function isExamReady(testProgress: MockTestProgress[]): boolean {
  return calculateExamReadiness(testProgress) >= 75;
}
