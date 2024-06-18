import { Image, Button, Link } from "@nextui-org/react";
import { UserStats } from "./statistic/user-stats";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { User } from "@/types/user";
import { PrepareQuestionType } from "@/types/prepare-question";
import { Question } from "@/types/question";

export default function DashboardReports({ isAuthenticated, user, handleStalePress, questions }: { isAuthenticated: boolean, user: User, handleStalePress: any, questions: Question[] }) {
    const [showMoreReport, setShowMoreReport] = useState<boolean>(false);
    return (
        <>
            {/* {!isAuthenticated &&
                <div className="relative">
                    <Image src="/dashboard/stats.png" alt="stats" className={isAuthenticated ? "blur-none" : "blur-sm"} />
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <Button
                            color="primary"
                            variant="solid"
                            onPress={() => signIn("google")}>
                            Sign In
                        </Button>
                    </div>
                </div>
            } */}
            {
                //isAuthenticated &&
                <div>
                    <div >
                        <UserStats showMore={showMoreReport} user={user} handleStalePress={handleStalePress} questions={questions} />
                    </div>
                    <div hidden={showMoreReport} className="text-end">
                        <Button
                            onPress={() => setShowMoreReport(true)}
                            as={Link}
                            variant="light"
                            style={{ backgroundColor: 'transparent' }}
                            endContent={
                                <ArrowRightIcon className="dark:invert" />
                            }>
                            Show More
                        </Button>
                    </div>
                    <div hidden={!showMoreReport} className="text-end">
                        <Button
                            onPress={() => setShowMoreReport(false)}
                            as={Link}
                            variant="light"
                            style={{ backgroundColor: 'transparent' }}
                            endContent={
                                <ArrowRightIcon className="dark:invert" />
                            }>
                            Hide
                        </Button>
                    </div>
                </div>
            }
        </>
    )
};