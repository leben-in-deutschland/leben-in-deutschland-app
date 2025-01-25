import { Image, Button, Link } from "@heroui/react";
import { UserStats } from "./statistic/user-stats";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { useState } from "react";
import { User } from "@/types/user";
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
                            onPress={() => signIn("auth0")}>
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
            }
        </>
    )
};