import { CardHeader, Card, CardBody } from "@heroui/react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";

export const Countdown = ({ handleTimeComplete }: { handleTimeComplete: any }) => {
    const hourSeconds = 3600;

    const renderTime = ({ remainingTime }) => {

        const minutes = Math.floor(remainingTime / 60)
        const seconds = remainingTime % 60
        return (
            <div className="text-center">
                <div>{`${minutes} Min ${seconds} Sec`}</div>
            </div>
        );

    };

    const timerProps = {
        isPlaying: true
    };

    return (
        <Card>
            <CardHeader className="justify-center">
                <h2 className="font-bold text-uppercase text-muted">
                    Time Remaining
                </h2>
            </CardHeader>
            <CardBody className="items-center">
                <CountdownCircleTimer
                    {...timerProps}
                    colors="#A30000"
                    duration={hourSeconds}
                    onComplete={handleTimeComplete}
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