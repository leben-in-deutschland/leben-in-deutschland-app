"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import { notifyTermine } from "@/services/notifications";
import { refreshTermine } from "@/services/termine";
import type { TermineData } from "@/types/termine";
import { dayKey } from "@/utils/date-utils";
import { addInboxNotes } from "@/utils/engagement";
import type { Translations } from "@/utils/i18n";
import type { RemoteCache } from "@/utils/remote-cache";
import { alertDraft, alertKey, alertText, TERMINE_ROUTE } from "@/utils/termine-alerts";
import { TERMINE_MAX_AGE_MS, termineStore } from "@/utils/termine-store";
import { detectAlerts, EMPTY_WATCH, readWatch, subscribeWatch, writeWatch, type TermineWatch } from "@/utils/termine-watch";
import { readUiMode } from "@/utils/ui-mode";
import { prefsOf } from "@/utils/user-defaults";
import { readUser, writeUser } from "@/utils/user-store";

function serverCache(): RemoteCache<TermineData> {
    return termineStore.empty;
}

function serverWatch(): TermineWatch {
    return EMPTY_WATCH;
}

/**
 * Exam-date alerts (ADR-050), mounted once by the shell.
 *
 * While the learner watches at least one exam centre, the dates are kept
 * fresh: on start, whenever the app or tab comes back to the front, and once
 * an hour while it stays open. Every time the file or the watch list
 * changes, `detectAlerts` compares the two; news becomes an inbox note, a
 * toast, and - in the apps, when notifications are on - a system
 * notification. Nothing is fetched for a learner who watches nothing.
 */
export function useTermineAlerts(t: Translations) {
    const watch = useSyncExternalStore(subscribeWatch, readWatch, serverWatch);
    const cache = useSyncExternalStore(termineStore.subscribe, termineStore.read, serverCache);
    const watching = watch.centres.length > 0;
    const texts = useRef(t);
    useEffect(() => {
        texts.current = t;
    });

    useEffect(() => {
        if (!watching) {
            return;
        }
        const refresh = () => {
            if (document.visibilityState === "visible") {
                void refreshTermine();
            }
        };
        refresh();
        document.addEventListener("visibilitychange", refresh);
        const timer = window.setInterval(refresh, TERMINE_MAX_AGE_MS);
        return () => {
            document.removeEventListener("visibilitychange", refresh);
            window.clearInterval(timer);
        };
    }, [watching]);

    const data = cache.data;
    useEffect(() => {
        if (!data || watch.centres.length === 0) {
            return;
        }
        const today = dayKey();
        const { alerts, watch: next } = detectAlerts(watch, data, today);
        if (next !== watch) {
            // Stored before anything is shown, so the same news is never announced twice.
            writeWatch(next);
        }
        if (alerts.length === 0) {
            return;
        }
        const t = texts.current;
        const user = readUser();
        if (user) {
            const result = addInboxNotes(user, alerts.map((alert) => alertDraft(alert, today)), new Date());
            if (result.user !== user) {
                writeUser(result.user);
            }
        }
        const cards = alerts.map((alert) => ({ key: alertKey(alert), route: TERMINE_ROUTE, ...alertText(alert, t, today) }));
        if (readUiMode().mode !== "classic") {
            for (const card of cards) {
                toast(`${card.title} — ${card.body}`, { toastId: `termine-${card.key}` });
            }
        }
        if (!user || prefsOf(user).notificationsEnabled) {
            void notifyTermine(cards, t);
        }
    }, [data, watch]);
}
