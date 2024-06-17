import { CardHeader, Card, CardBody } from "@nextui-org/react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";

export const Countdown = () => {
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
        <Card className="w-[100%] h-[100%]">
            <CardHeader>
                <h2 className="font-bold text-uppercase text-muted">
                    Time Remaining
                </h2>
            </CardHeader>
            <CardBody>
                <CountdownCircleTimer
                    {...timerProps}
                    colors="#A30000"
                    duration={hourSeconds}
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