import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { User } from "@/types/user";
import { Card, CardBody, CardFooter, CardHeader, Tooltip } from "@nextui-org/react";

export const ExamReadiness = ({ user }: { user: User }) => {
    let passed = user.testProgress.filter(x => x.passed).length;
    let totalSubmitted = user.testProgress.filter(x => !x.cancelled).length;
    let percentage = (passed / totalSubmitted);
    if (user.testProgress.filter(x => !x.cancelled).length <= 8) {
        percentage = 0;
    }
    return (
        <Card className="h-[100%] ">
            <CardHeader className="justify-center">
                <h2 className="font-bold text-uppercase text-muted">
                    Exam Readiness
                </h2>
            </CardHeader>
            <CardBody className="items-center">
                <Tooltip content={`${percentage >= 75 ? "You are ready for the exam, Good Luck" : "You are not ready for the exam, please practice more."}`}>
                    {
                        percentage >= 75 ?

                            <div className="text-green-600">
                                <TickIcon size={90} />
                            </div> :
                            <div className="text-red-600">
                                <CrossIcon size={90} />
                            </div>
                    }
                </Tooltip>
            </CardBody>
            <CardFooter>
                <p className="text-muted text-gray-500 text-xs">
                    Readiness is determined by your mock test scores. To be considered ready, you must have passed more than <span className="font-bold">75%</span> of the submitted mock exams and have submitted at least <span className="font-bold">8</span> exams.
                </p>
            </CardFooter>
        </Card >
    );
};