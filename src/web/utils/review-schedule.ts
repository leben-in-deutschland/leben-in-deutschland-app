import { ReviewItem } from "@/types/user";
import { addDays } from "./date-utils";

/**
 * Spaced repetition with Leitner boxes.
 *
 * Every answered question sits in a box from 1 (new to the learner or just
 * answered wrong) to MAX_BOX (well known) and has a due day. A correct answer
 * on or after the due day moves the question up one box and pushes the next
 * review further out. A wrong answer sends it back to box 1, due again today.
 * A correct answer before the due day only updates `lastReviewed`, so
 * answering the same question again and again on one day does not count as
 * knowing it.
 *
 * Days are "YYYY-MM-DD" day keys, which compare correctly as plain strings.
 * When a record holds more than one item for a question, the first one counts.
 */

/** Days until the next review after a question reaches box n. */
export const REVIEW_INTERVALS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };

export const MAX_BOX = 5;

/** No schedule item: "new". Box 1-2: "learning". Box 3-4: "known". Box 5: "mastered". */
export type MasteryLevel = "new" | "learning" | "known" | "mastered";

/** Catalogue order for question numbers: "2" before "10", general before "BE-1", "BE-2" before "BE-10". */
const NUM_ORDER = new Intl.Collator("en", { numeric: true });

/**
 * Box of a stored item as a whole number from 1 to MAX_BOX. Reading a record
 * does not validate the box, so damaged values are repaired here.
 */
function boxOf(item: ReviewItem): number {
    const box = Math.floor(Number(item.box));
    return Number.isFinite(box) ? Math.min(MAX_BOX, Math.max(1, box)) : 1;
}

function answeredItem(item: ReviewItem, correct: boolean, today: string): ReviewItem {
    if (!correct) {
        return { ...item, box: 1, due: today, lastReviewed: today };
    }
    const box = boxOf(item);
    if (item.due > today) {
        // Not due yet: no promotion for cramming.
        return { ...item, box, lastReviewed: today };
    }
    const nextBox = Math.min(MAX_BOX, box + 1);
    return { ...item, box: nextBox, due: addDays(today, REVIEW_INTERVALS[nextBox]), lastReviewed: today };
}

/**
 * Records one answer and returns the updated schedule as a new array. Other
 * items keep their place and identity; a new question is appended.
 */
export function scheduleAnswer(
    schedule: ReviewItem[] | undefined,
    num: string,
    correct: boolean,
    today: string,
): ReviewItem[] {
    const items = schedule ?? [];
    const index = items.findIndex((item) => item.num === num);

    if (index === -1) {
        // Right the first time: no need to see it again today, so it starts in box 2.
        const item: ReviewItem = correct
            ? { num, box: 2, due: addDays(today, REVIEW_INTERVALS[2]), lastReviewed: today }
            : { num, box: 1, due: today, lastReviewed: today };
        return [...items, item];
    }

    const updated = answeredItem(items[index], correct, today);
    const next: ReviewItem[] = [];
    items.forEach((item, i) => {
        if (i === index) {
            next.push(updated);
        } else if (item.num !== num) {
            // Later duplicates of the answered question are dropped.
            next.push(item);
        }
    });
    return next;
}

/** Schedule item of a question, or undefined when it was never answered. */
export function getReviewItem(schedule: ReviewItem[] | undefined, num: string): ReviewItem | undefined {
    return schedule?.find((item) => item.num === num);
}

/** Due items (due today or earlier), one per question, in schedule order. */
function collectDue(
    schedule: ReviewItem[] | undefined,
    today: string,
    isRelevant?: (num: string) => boolean,
): ReviewItem[] {
    const seen = new Set<string>();
    const due: ReviewItem[] = [];
    for (const item of schedule ?? []) {
        if (seen.has(item.num)) {
            continue;
        }
        seen.add(item.num);
        if (item.due <= today && (!isRelevant || isRelevant(item.num))) {
            due.push(item);
        }
    }
    return due;
}

function compareDue(a: ReviewItem, b: ReviewItem): number {
    if (a.due !== b.due) {
        return a.due < b.due ? -1 : 1;
    }
    return boxOf(a) - boxOf(b) || NUM_ORDER.compare(a.num, b.num);
}

/**
 * Questions to review today: most overdue first, then the lowest box, then
 * catalogue order. `isRelevant` keeps only questions of the learner's
 * catalogue, for example after a change of federal state.
 */
export function dueItems(
    schedule: ReviewItem[] | undefined,
    today: string,
    isRelevant?: (num: string) => boolean,
): ReviewItem[] {
    return collectDue(schedule, today, isRelevant).sort(compareDue);
}

/** Number of questions `dueItems` would return. */
export function dueCount(
    schedule: ReviewItem[] | undefined,
    today: string,
    isRelevant?: (num: string) => boolean,
): number {
    return collectDue(schedule, today, isRelevant).length;
}

export function masteryLevel(item: ReviewItem | undefined): MasteryLevel {
    if (!item) {
        return "new";
    }
    const box = boxOf(item);
    if (box >= MAX_BOX) {
        return "mastered";
    }
    return box >= 3 ? "known" : "learning";
}
