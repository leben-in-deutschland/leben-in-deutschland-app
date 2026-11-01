"use client";

import { Button } from "@heroui/react";
import { useCallback, useSyncExternalStore } from "react";
import { XIcon } from "@/components/ui/icons";
import { detectNudgePlatform, dismissAppNudge, nudgeLinks, shouldShowAppNudge, type NudgePlatform } from "@/utils/app-nudge";
import { useHydrated, useIsNative, useTranslations } from "@/utils/user-store";
import { BrandMark } from "./brand";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};
const notify = () => listeners.forEach((listener) => listener());

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function useNudgeVisible(): boolean {
    return useSyncExternalStore(subscribe, () => shouldShowAppNudge(storage()), () => false);
}

function usePlatform(): NudgePlatform | null {
    return useSyncExternalStore(
        () => () => {},
        () => detectNudgePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0),
        () => null,
    );
}

/**
 * One slim card above the learner screens in a browser: "the app exists for
 * your phone" (Android -> Google Play, iPhone/iPad -> App Store) or, on a
 * desktop, "the app is the better place to learn" with both stores. Never
 * shown inside the native apps, and dismissable for a month.
 */
export function GetTheAppBanner() {
    const t = useTranslations();
    const hydrated = useHydrated();
    const isNative = useIsNative();
    const visible = useNudgeVisible();
    const platform = usePlatform();

    const dismiss = useCallback(() => {
        dismissAppNudge(storage());
        notify();
    }, []);

    if (!hydrated || isNative || !visible || !platform) {
        return null;
    }
    const links = nudgeLinks(platform);
    if (!links.play && !links.appStore) {
        return null;
    }

    const title = platform === "android" ? t.app_nudge_android_title : platform === "ios" ? t.app_nudge_ios_title : t.app_nudge_desktop_title;
    const body = platform === "android" ? t.app_nudge_android_body : platform === "ios" ? t.app_nudge_ios_body : t.app_nudge_desktop_body;

    return (
        <section
            aria-label={t.app_nudge_region}
            data-platform={platform}
            className="mb-5 flex flex-col gap-3 rounded-2xl border border-divider bg-content1 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-4"
        >
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <BrandMark size={32} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-foreground">{title}</p>
                    <p className="mt-0.5 text-sm leading-snug text-default-500">{body}</p>
                </div>
                <Button isIconOnly size="sm" variant="light" aria-label={t.app_nudge_dismiss} className="-mr-2 -mt-1 h-11 w-11 shrink-0 sm:hidden" onPress={dismiss}>
                    <XIcon size={18} />
                </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                {links.play ? (
                    <Button as="a" href={links.play} target="_blank" rel="noopener noreferrer" size="sm" variant="flat" color="primary" className="h-10 font-medium">
                        {platform === "desktop" ? t.app_nudge_cta_play : t.app_nudge_android_cta}
                    </Button>
                ) : null}
                {links.appStore ? (
                    <Button as="a" href={links.appStore} target="_blank" rel="noopener noreferrer" size="sm" variant="flat" color="primary" className="h-10 font-medium">
                        {platform === "desktop" ? t.app_nudge_cta_appstore : t.app_nudge_ios_cta}
                    </Button>
                ) : null}
                <Button isIconOnly size="sm" variant="light" aria-label={t.app_nudge_dismiss} className="hidden h-10 w-10 sm:inline-flex" onPress={dismiss}>
                    <XIcon size={18} />
                </Button>
            </div>
        </section>
    );
}
