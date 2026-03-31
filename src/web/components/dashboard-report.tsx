import { Button } from "@heroui/react";
import { UserStats } from "./statistic/user-stats";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { ChartBarIcon } from "@/icons/ChartBarIcon";
import { useState } from "react";
import { User } from "@/types/user";
import { Question } from "@/types/question";

export default function DashboardReports({ user, questions, translation }: { user: User, questions: Question[], translation: any }) {
    const [showMoreReport, setShowMoreReport] = useState<boolean>(false);
    return (
        <div className="dashboard-section-enter dashboard-section-enter-6">
            <div className="flex items-center gap-2 mb-3">
                <div className="bg-default-200 dark:bg-default-100 rounded-xl p-2 text-foreground/70">
                    <ChartBarIcon size={18} />
                </div>
                <h2 className="font-bold text-foreground/70 text-sm uppercase tracking-wide">
                    {translation.greeting_statistics ?? "Statistics"}
                </h2>
            </div>
            <div>
                <UserStats showMore={showMoreReport} user={user} questions={questions} translation={translation} />
            </div>

            <div className="text-end mt-3">
                <Button
                    variant="bordered"
                    size="sm"
                    onPress={() => setShowMoreReport(!showMoreReport)}
                    endContent={
                        <ArrowRightIcon />
                    }>
                    {showMoreReport ? translation.hide : translation.show_more}
                </Button>
            </div>
        </div>
    )
};
