"use client";

import { Spinner } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PracticeSession } from "@/components/practice/practice-session";
import { parseSessionSize } from "@/components/practice/session-logic";
import type { User } from "@/types/user";
import { parseModeParam, parseStartParam } from "@/utils/study-modes";
import { useTranslations, useUser } from "@/utils/user-store";

/**
 * Reads the session from the URL: `?action=<mode>` (the values of version
 * 2.0 still work), `&category=<topic>` for the topic mode, an optional
 * `&size=<n>`, and an optional `&start=<num>` naming the question to open
 * with (the "question of the day" notification links here). A new URL
 * starts a new session.
 */
function PrepareScreen({ user }: { user: User }) {
    const searchParams = useSearchParams();
    const mode = parseModeParam(searchParams.get("action"));
    const category = searchParams.get("category") ?? undefined;
    const sessionSize = parseSessionSize(searchParams.get("size"));
    const startNum = parseStartParam(searchParams.get("start"));
    return (
        <PracticeSession
            key={`${mode}|${category ?? ""}|${sessionSize ?? ""}|${startNum ?? ""}`}
            user={user}
            mode={mode}
            category={category}
            sessionSize={sessionSize}
            startNum={startNum}
        />
    );
}

/** Practice session in the focus layout (the shell hides the header and tab bar here). */
export default function PreparePage() {
    const user = useUser();
    const t = useTranslations();

    if (user === undefined) {
        return (
            <div className="flex justify-center py-16">
                <Spinner label={t.loading} color="primary" />
            </div>
        );
    }
    if (!user) {
        return null;
    }
    return (
        <Suspense
            fallback={
                <div className="flex justify-center py-16">
                    <Spinner label={t.loading} color="primary" />
                </div>
            }
        >
            <PrepareScreen user={user} />
        </Suspense>
    );
}
