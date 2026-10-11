"use client";

import { Spinner } from "@heroui/react";
import { Suspense } from "react";
import { PracticeHub } from "@/components/practice/practice-hub";
import { useTranslations, useUser } from "@/utils/user-store";

/** Practice hub: today's goal, the session size, and every study mode. */
export default function PracticePage() {
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
        <Suspense fallback={null}>
            <PracticeHub user={user} />
        </Suspense>
    );
}
