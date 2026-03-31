import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { TargetIcon } from "@/icons/TargetIcon";
import { User } from "@/types/user";
import { Card, CardBody, CardFooter, CardHeader, Tooltip } from "@heroui/react";

export const ExamReadiness = ({ user, translation }: { user: User, translation: any }) => {
    let passed = user.testProgress.filter(x => x.passed).length;
    let totalSubmitted = user.testProgress.filter(x => !x.cancelled).length;
    let percentage = totalSubmitted > 0 ? (passed / totalSubmitted) * 100 : 0;
    if (user.testProgress.filter(x => !x.cancelled).length <= 8) {
        percentage = 0;
    }
    const isReady = percentage >= 75;
    return (
        <Card className="h-[100%] dashboard-section-enter dashboard-section-enter-4">
            <CardHeader className="justify-center gap-2">
                <div className={`${isReady ? "bg-success/10 text-success" : "bg-danger/10 text-danger"} rounded-xl p-2`}>
                    <TargetIcon size={20} />
                </div>
                <h2 className="font-bold text-uppercase text-muted">
                    {translation.exam_readines_title}
                </h2>
            </CardHeader>
            <CardBody className="items-center">
                <Tooltip content={isReady ? translation.exam_readines_tooltip_read : translation.exam_readines_tooltip_notread}>
                    {
                        isReady ?
                            <div className="text-success">
                                <TickIcon size={90} />
                            </div> :
                            <div className="text-danger">
                                <CrossIcon size={90} />
                            </div>
                    }
                </Tooltip>
            </CardBody>
            <CardFooter className="justify-center">
                <p className="text-muted text-foreground/60 text-xs">
                    {translation.exam_readines_subtext}
                </p>
            </CardFooter>
        </Card >
    );
};
