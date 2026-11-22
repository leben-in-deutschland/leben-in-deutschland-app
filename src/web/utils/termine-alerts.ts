import type { TerminSlot } from "@/types/termine";
import type { InboxDraft } from "./engagement";
import { fmt, type Translations } from "./i18n";
import { slotKey, type TermineAlert } from "./termine-watch";

/**
 * What an exam-date alert (see `detectAlerts`) looks like in the inbox, in a
 * toast and as a system notification. Pure.
 */

/** Screen an alert opens. */
export const TERMINE_ROUTE = "/termine";

/** "03.12.2026, 14:30": numeric, so the stored text reads the same in both interface languages. */
export function whenText(slot: Pick<TerminSlot, "date" | "time">): string {
    const [year, month, day] = slot.date.split("-");
    return `${day}.${month}.${year}${slot.time ? `, ${slot.time}` : ""}`;
}

/** The date an alert is about, for ids and for replacing an older system notification. */
export function alertKey(alert: TermineAlert): string {
    return slotKey(alert.centre.id, alert.slot.id);
}

/**
 * The inbox note of an alert. The id carries the day, so a place that opens
 * again later is noted again, but never twice on one day.
 */
export function alertDraft(alert: TermineAlert, today: string): InboxDraft {
    return {
        id: `termine-${alert.kind}-${alertKey(alert)}-${today}`,
        type: "termine",
        titleKey: `termine_inbox_${alert.kind}_title`,
        bodyKey: alert.more > 0 ? "termine_inbox_body_more" : "termine_inbox_body",
        params: { city: alert.centre.city, centre: alert.centre.name, when: whenText(alert.slot), more: alert.more },
        route: TERMINE_ROUTE,
    };
}

/** Title and body of an alert in the current language. */
export function alertText(alert: TermineAlert, t: Translations, today: string): { title: string; body: string } {
    const draft = alertDraft(alert, today);
    return { title: fmt(t[draft.titleKey], draft.params) || draft.titleKey, body: fmt(t[draft.bodyKey], draft.params) };
}
