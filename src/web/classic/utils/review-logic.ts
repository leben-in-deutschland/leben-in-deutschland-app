import { User } from "@/types/user";

/**
 * Minimum number of questions attempted before prompting for review.
 */
export const MIN_QUESTIONS_FOR_REVIEW = 50;

/**
 * Maximum number of times the user can say "no" before we stop asking.
 */
export const MAX_NO_COUNT = 3;

/**
 * Minimum days between review prompts.
 */
export const MIN_DAYS_BETWEEN_PROMPTS = 7;

/**
 * Determine whether to show the in-app review prompt.
 *
 * Conditions:
 * 1. User has NOT already reviewed
 * 2. User has not said "no" more than MAX_NO_COUNT times
 * 3. User has attempted at least MIN_QUESTIONS_FOR_REVIEW questions
 * 4. At least MIN_DAYS_BETWEEN_PROMPTS days since last prompt (or never prompted)
 */
export function shouldShowReviewPrompt(
  user: User,
  now: Date = new Date()
): boolean {
  // Already reviewed
  if (user.userReviewed) {
    return false;
  }

  // Too many "no" responses
  if (user.reviewNoCount >= MAX_NO_COUNT) {
    return false;
  }

  // Not enough questions attempted
  const totalAttempted = user.questionProgress.length;
  if (totalAttempted < MIN_QUESTIONS_FOR_REVIEW) {
    return false;
  }

  // Check time since last prompt
  if (user.lastReviewPromptDateTime) {
    const lastPrompt = new Date(user.lastReviewPromptDateTime);
    const daysSinceLastPrompt = Math.floor(
      (now.getTime() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastPrompt < MIN_DAYS_BETWEEN_PROMPTS) {
      return false;
    }
  }

  return true;
}

/**
 * Handle "no" response — increment count and record prompt time.
 */
export function handleReviewNo(user: User, now: Date = new Date()): User {
  return {
    ...user,
    reviewNoCount: user.reviewNoCount + 1,
    lastReviewPromptDateTime: now,
  };
}

/**
 * Handle "yes/done" response — mark as reviewed.
 */
export function handleReviewDone(user: User): User {
  return {
    ...user,
    userReviewed: true,
  };
}
