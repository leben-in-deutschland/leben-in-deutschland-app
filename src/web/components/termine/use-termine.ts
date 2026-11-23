"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { refreshTermine } from "@/services/termine";
import type { TerminCentre, TermineData } from "@/types/termine";
import { dayKey } from "@/utils/date-utils";
import type { RemoteCache } from "@/utils/remote-cache";
import { termineStore } from "@/utils/termine-store";
import { EMPTY_WATCH, isWatched, readWatch, subscribeWatch, unwatchCentre, watchCentre, writeWatch, type TermineWatch } from "@/utils/termine-watch";

function serverCache(): RemoteCache<TermineData> {
    return termineStore.empty;
}

function serverWatch(): TermineWatch {
    return EMPTY_WATCH;
}

export type TermineView = {
    /** The exam dates, or null while they load or when they could not be loaded. */
    data: TermineData | null;
    loading: boolean;
    failed: boolean;
    /** Asks again at once, also right after a failure. */
    reload: () => void;
};

/** The exam dates from the cache, refreshed once per mount when they are an hour old. */
export function useTermine(): TermineView {
    const cache = useSyncExternalStore(termineStore.subscribe, termineStore.read, serverCache);
    const [settled, setSettled] = useState(false);
    useEffect(() => {
        void refreshTermine().finally(() => setSettled(true));
    }, []);
    const reload = useCallback(() => {
        setSettled(false);
        void refreshTermine({ force: true }).finally(() => setSettled(true));
    }, []);
    return { data: cache.data, loading: cache.data === null && !settled, failed: cache.data === null && settled, reload };
}

/** The watch list and a way to add or remove a centre. `toggle` returns false when the list is full. */
export function useTermineWatch(): { watch: TermineWatch; toggle: (centre: TerminCentre) => boolean } {
    const watch = useSyncExternalStore(subscribeWatch, readWatch, serverWatch);
    const toggle = useCallback((centre: TerminCentre) => {
        const current = readWatch();
        const next = isWatched(current, centre.id) ? unwatchCentre(current, centre.id) : watchCentre(current, centre, dayKey());
        if (next === current) {
            return false;
        }
        writeWatch(next);
        return true;
    }, []);
    return { watch, toggle };
}
