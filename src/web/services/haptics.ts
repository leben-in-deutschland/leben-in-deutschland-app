import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

/**
 * Short vibrations for answer feedback in the Android app.
 *
 * Pass the learner's `haptics` preference as `enabled`. Every function does
 * nothing on the web or when `enabled` is false, and never throws, so callers
 * can fire and forget.
 */

function canVibrate(enabled: boolean): boolean {
    if (!enabled) {
        return false;
    }
    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

async function play(action: string, effect: () => Promise<void>): Promise<void> {
    try {
        await effect();
    } catch (error) {
        console.warn(`[haptics] ${action} failed`, error);
    }
}

/** Correct answer. */
export function hapticSuccess(enabled = true): Promise<void> {
    if (!canVibrate(enabled)) {
        return Promise.resolve();
    }
    return play("success", () => Haptics.notification({ type: NotificationType.Success }));
}

/** Wrong answer. */
export function hapticError(enabled = true): Promise<void> {
    if (!canVibrate(enabled)) {
        return Promise.resolve();
    }
    return play("error", () => Haptics.notification({ type: NotificationType.Error }));
}

/** Light tap, for example when an answer is selected. */
export function hapticTap(enabled = true): Promise<void> {
    if (!canVibrate(enabled)) {
        return Promise.resolve();
    }
    return play("tap", () => Haptics.impact({ style: ImpactStyle.Light }));
}
