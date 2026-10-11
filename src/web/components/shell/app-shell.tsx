"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@heroui/react";
import { isAppRoute, isFocusRoute } from "@/utils/routes";
import { useUiMode } from "@/utils/ui-mode";
import { useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { ClassicApp } from "@/classic/classic-app";
import { Footer } from "@/components/footer";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { AppHeader } from "./app-header";
import { BottomNav } from "./bottom-nav";
import { useIsFocusMode } from "./focus-mode";
import { NativePrompts } from "./native-prompts";
import { UiModePrompt } from "./ui-mode-prompt";
import { useAppEffects } from "./use-app-effects";

/** Learner pages need a learner record with a state; otherwise onboarding runs first. */
function OnboardingGate({ children }: { children: ReactNode }) {
    const user = useUser();
    const t = useTranslations();
    if (user === undefined) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <Spinner size="lg" label={t.loading} />
            </div>
        );
    }
    if (!user || !user.state?.stateCode || !user.onboardingCompleted) {
        return <OnboardingFlow />;
    }
    return <>{children}</>;
}

function SkipLink() {
    const t = useTranslations();
    return (
        <a
            href="#main"
            className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
            {t.skip_to_content}
        </a>
    );
}

/**
 * Learner pages come in two designs (see `utils/ui-mode.ts`). The app-wide
 * effects run in both; only the chrome and the screens differ. Public pages
 * always use the modern shell.
 */
export function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isNative = useIsNative();
    const t = useTranslations();
    const focusFlag = useIsFocusMode();
    const ui = useUiMode();
    useAppEffects();

    const appRoute = isAppRoute(pathname);
    const focus = focusFlag || isFocusRoute(pathname);

    // Unknown until hydration: a neutral spinner, so a classic learner never
    // sees the modern chrome flash by (a modern learner sees it for one frame).
    if (appRoute && ui === undefined) {
        return (
            <div className="flex min-h-dvh flex-col safe-area-padding">
                <SkipLink />
                <main id="main" className="flex flex-grow items-center justify-center">
                    <Spinner size="lg" label={t.loading} />
                </main>
            </div>
        );
    }

    // The classic design brings its own navigation and screens. It is only
    // chosen for a finished record or by an explicit choice, so onboarding is
    // never needed here.
    if (appRoute && ui?.mode === "classic") {
        return (
            <div className="flex min-h-dvh flex-col safe-area-padding">
                <SkipLink />
                <ClassicApp pathname={pathname ?? "/dashboard"} />
                <NativePrompts />
                {ui.promptPending ? <UiModePrompt /> : null}
            </div>
        );
    }

    return (
        <div className="flex min-h-dvh flex-col safe-area-padding">
            <SkipLink />
            {!focus ? <AppHeader variant={appRoute ? "app" : "public"} /> : null}
            <main
                id="main"
                className={clsx(
                    "mx-auto flex w-full max-w-6xl flex-grow flex-col px-4 sm:px-6",
                    focus ? "pt-0" : "pt-5 sm:pt-8",
                    appRoute && !focus ? "pb-tabbar md:pb-12" : "pb-10",
                )}
            >
                {appRoute ? (
                    <OnboardingGate>
                        {children}
                        {!focus ? <NativePrompts /> : null}
                    </OnboardingGate>
                ) : children}
            </main>
            {appRoute && !focus ? <BottomNav /> : null}
            {!appRoute && !isNative ? <Footer /> : null}
        </div>
    );
}
