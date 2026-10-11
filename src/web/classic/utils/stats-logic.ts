import { User } from "@/types/user";

/**
 * Get the number of questions attempted today from dailyProgress.
 */
export function getTodayCount(user: User): number {
    const today = new Date().toDateString();
    const dailyStats = user.dailyProgress.find(
        (dp) => new Date(dp.date).toDateString() === today
    );
    return dailyStats?.attempted ?? 0;
}

/**
 * Normalise any date-like value to a day-only integer (ms at local midnight).
 */
function toDayKey(date: string | Date): number {
    const d = new Date(date);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Step one calendar day backwards from a local-midnight timestamp.
 * Avoids DST issues that arise from simple 86 400 000 ms subtraction.
 */
function prevDay(dayKey: number): number {
    const d = new Date(dayKey);
    d.setDate(d.getDate() - 1);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Calculate the current streak (consecutive days with at least one attempt)
 * from dailyProgress, counting backwards from today.
 */
export function calculateStreak(user: User): number {
    if (!user.dailyProgress || user.dailyProgress.length === 0) return 0;

    // Build a Set of day-keys that have at least one attempt
    const activeDays = new Set<number>();
    for (const dp of user.dailyProgress) {
        if (dp.attempted > 0) {
            activeDays.add(toDayKey(dp.date));
        }
    }

    if (activeDays.size === 0) return 0;

    const todayKey = toDayKey(new Date());
    const yesterdayKey = prevDay(todayKey);

    // The streak must start from today or yesterday
    let cursor: number;
    if (activeDays.has(todayKey)) {
        cursor = todayKey;
    } else if (activeDays.has(yesterdayKey)) {
        cursor = yesterdayKey;
    } else {
        return 0;
    }

    let streak = 0;
    while (activeDays.has(cursor)) {
        streak++;
        cursor = prevDay(cursor);
    }

    return streak;
}
