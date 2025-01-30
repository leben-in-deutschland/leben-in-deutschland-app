import { Image, Button, Link } from "@heroui/react";
import { UserStats } from "./statistic/user-stats";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { useState } from "react";
import { User } from "@/types/user";
import { Question } from "@/types/question";

export default function DashboardReports({ user, questions }: { user: User, questions: Question[] }) {
    const [showMoreReport, setShowMoreReport] = useState<boolean>(false);
    return (
        <div>
            <div>
                <UserStats showMore={showMoreReport} user={user} questions={questions} />
            </div>
            <div hidden={showMoreReport} className="text-end">
                <Button
                    onPress={() => setShowMoreReport(true)}
                    as={Link}
                    variant="light"
                    style={{ backgroundColor: 'transparent' }}
                    className="text-black"
                    endContent={
                        <ArrowRightIcon />
                    }>
                    Show More
                </Button>
            </div>
            <div hidden={!showMoreReport} className="text-end">
                <Button
                    onPress={() => setShowMoreReport(false)}
                    as={Link}
                    variant="light"
                    className="text-black"
                    style={{ backgroundColor: 'transparent' }}
                    endContent={
                        <ArrowRightIcon />
                    }>
                    Hide
                </Button>
            </div>
        </div>
    )
};