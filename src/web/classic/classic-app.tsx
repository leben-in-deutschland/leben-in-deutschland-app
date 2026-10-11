"use client";

// Adapted from 2.0 (app/layout.tsx): the 2.0 page chrome (navigation bar,
// main column, footer) and the learner screens, rendered by the shared 2.1
// shell for learners who keep the classic design. The shell owns the outer
// safe-area column, the app-wide effects, and the native prompts.
import { Suspense } from "react";
import { normalizePath } from "@/utils/routes";
import { useIsNative } from "@/utils/user-store";
import { NavigationBar } from "./components/navigation-bar";
import { Footer } from "./components/footer";
import { DashboardScreen } from "./screens/dashboard-screen";
import { PrepareScreen } from "./screens/prepare-screen";
import { MockScreen } from "./screens/mock-screen";
import "./classic.css";

export type ClassicScreen = "dashboard" | "prepare" | "mock";

/** Which 2.0 screen a learner route shows. Unknown routes fall back to the dashboard. */
export function classicScreenFor(pathname: string | null | undefined): ClassicScreen {
    switch (normalizePath(pathname)) {
        case "/practice":
        case "/prepare":
            return "prepare";
        case "/mock":
            return "mock";
        default:
            return "dashboard";
    }
}

export function ClassicApp({ pathname }: { pathname: string }) {
    const isNative = useIsNative();
    const path = normalizePath(pathname);
    const screen = classicScreenFor(path);

    return (
        <div className="flex flex-grow flex-col">
            <NavigationBar key={path === "/settings" ? "settings" : "default"} openSettings={path === "/settings"} />
            <main id="main" className="container mx-auto flex flex-col flex-grow w-full px-4 sm:px-6 py-4">
                {screen === "prepare" ? (
                    <Suspense>
                        <PrepareScreen />
                    </Suspense>
                ) : screen === "mock" ? (
                    <MockScreen />
                ) : (
                    <DashboardScreen />
                )}
            </main>
            {!isNative && <Footer />}
        </div>
    );
}
