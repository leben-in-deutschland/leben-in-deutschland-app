"use client";

import { Spinner } from "@heroui/react";
import { HomeScreen } from "@/components/home/home-screen";
import { useTranslations, useUser } from "@/utils/user-store";

/** Home: the learner's pass, the next step, this week, and recent mock exams. */
export default function DashboardPage() {
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
    return <HomeScreen user={user} />;
}
