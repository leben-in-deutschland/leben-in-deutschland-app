import { Card, CardBody, CardHeader } from "@heroui/react";

export const NumberProgress = ({ title, count, numberColor = "", onPress, isPressable }: { title: string, count: number, numberColor: string, onPress: any, isPressable: boolean }) => {
    return (
        <div>
            <Card className="border-none md:h-[180px] w-[100%]"
                onPress={onPress}
                isPressable={isPressable}>

                <CardHeader className="justify-center">
                    <h2 className="font-bold text-uppercase text-muted">
                        {title}
                    </h2>
                </CardHeader>
                <CardBody>
                    <p className={`font-extrabold text-center h-20 text-6xl ${numberColor !== "" ? "text-" + numberColor : ""}`}>
                        {count}
                    </p>
                </CardBody>
            </Card>
        </div >
    );
};