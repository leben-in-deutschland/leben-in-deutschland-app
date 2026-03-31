import { CardHeader, Card, CardBody } from "@heroui/react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import { ClockIcon } from "@/icons/ClockIcon";

export const Countdown = ({ handleTimeComplete, translation }: { handleTimeComplete: any, translation: any }) => {
    const hourSeconds = 3600;

    const renderTime = ({ remainingTime }: { remainingTime: number }) => {

        const minutes = Math.floor(remainingTime / 60)
        const seconds = remainingTime % 60
        return (
            <div className="text-center">
                <div className="text-sm font-mono font-bold text-foreground">
                    {`${minutes} ${translation.min ?? "Min"} ${seconds} ${translation.sec ?? "Sec"}`}
                </div>
            </div>
        );

    };

    const timerProps = {
        isPlaying: true
    };

    return (
        <Card className="shadow-sm">
            <CardHeader className="justify-center gap-2">
                <div className="bg-danger/10 dark:bg-danger/20 rounded-lg p-1.5 text-danger">
                    <ClockIcon size={16} />
                </div>
                <h2 className="font-bold text-sm text-foreground/70">
                    {translation.time_remaining}
                </h2>
            </CardHeader>
            <CardBody className="items-center pb-4">
                <CountdownCircleTimer
                    {...timerProps}
                    colors={["#17C964", "#F5A524", "#F31260"] as any}
                    colorsTime={[3600, 1800, 0] as any}
                    duration={hourSeconds}
                    onComplete={handleTimeComplete}
                    size={140}
                    strokeWidth={8}
                    trailColor={"hsl(var(--heroui-default-200))" as any}
                >
                    {({ remainingTime, color }) => (
                        <span style={{ color }}>
                            {renderTime({ remainingTime })}
                        </span>
                    )}
                </CountdownCircleTimer>
            </CardBody>
        </Card>
    );
};
