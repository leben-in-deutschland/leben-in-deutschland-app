"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useNoticeFlags } from "@/components/home/use-notices";
import { loadTipProducts, tipJarSupported } from "@/services/tip-jar";

const noopSubscribe = () => () => {};

/**
 * Whether the tip jar may be offered right now: Android app with the TipJar
 * plugin, owner switch `flags.tipJar` on, and Google Play knows at least one
 * product. `when` lets a caller hold the Play query back until its own
 * conditions are met. The plugin keeps one billing connection, so the query
 * is cheap.
 */
export function useTipJarAvailable(when = true): boolean {
    const enabled = useNoticeFlags().tipJar;
    const supported = useSyncExternalStore(noopSubscribe, tipJarSupported, () => false);
    const ready = when && enabled && supported;
    const [hasProducts, setHasProducts] = useState(false);

    useEffect(() => {
        if (!ready) {
            return;
        }
        let active = true;
        void loadTipProducts().then((products) => {
            if (active) {
                setHasProducts(products.length > 0);
            }
        });
        return () => {
            active = false;
        };
    }, [ready]);

    return ready && hasProducts;
}
