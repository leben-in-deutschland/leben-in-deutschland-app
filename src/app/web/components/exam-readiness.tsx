import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { User } from "@/types/user";
import { Card, CardBody, CardFooter, CardHeader, Tooltip } from "@heroui/react";

export const ExamReadiness = ({ user, translation }: { user: User, translation: any }) => {
    let passed = user.testProgress.filter(x => x.passed).length;
    let totalSubmitted = user.testProgress.filter(x => !x.cancelled).length;
    let percentage = totalSubmitted > 0 ? (passed / totalSubmitted) * 100 : 0;
    if (user.testProgress.filter(x => !x.cancelled).length <= 8) {
        percentage = 0;
    }
    return (
        <Card className="h-[100%]">
            <CardHeader className="justify-center">
                <h2 className="font-bold text-uppercase text-muted">
                    {translation.exam_readines_title}
                </h2>
            </CardHeader>
            <CardBody className="items-center">
                <Tooltip content={percentage >= 75 ? translation.exam_readines_tooltip_read : translation.exam_readines_tooltip_notread}>
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
            <CardFooter className="justify-center">
                <p className="text-muted text-gray-500 text-xs">
                    {translation.exam_readines_subtext}
                </p>
            </CardFooter>
        </Card >
    );
};