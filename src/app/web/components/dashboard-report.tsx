import { Image, Button, Link } from "@heroui/react";
import { UserStats } from "./statistic/user-stats";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { useState } from "react";
import { User } from "@/types/user";
import { Question } from "@/types/question";

export default function DashboardReports({ user, questions, translation }: { user: User, questions: Question[], translation: any }) {
    const [showMoreReport, setShowMoreReport] = useState<boolean>(false);
    return (
        <div>
            <div>
                <UserStats showMore={showMoreReport} user={user} questions={questions} translation={translation} />
            </div>

            <div className="text-end mt-2">
                <Button
                    variant="bordered"
                    onPress={() => setShowMoreReport(!showMoreReport)}
                    endContent={
                        <ArrowRightIcon />
                    }>
                    {showMoreReport ? "Hide" : "Show More"}
                </Button>
            </div>
        </div>
    )
};