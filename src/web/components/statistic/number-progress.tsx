import { Card, CardBody, CardHeader } from "@heroui/react";

export const NumberProgress = ({ title, count, numberColor = "", onPress, isPressable }: { title: string, count: number, numberColor: string, onPress: any, isPressable: boolean }) => {
    const colorMap: Record<string, string> = {
        "green-400": "text-success",
        "red-400": "text-danger",
        "yellow-500": "text-warning",
        "blue-500": "text-primary",
        "orange-500": "text-warning",
        "purple-500": "text-secondary",
    };
    const resolvedColor = colorMap[numberColor] ?? (numberColor !== "" ? `text-${numberColor}` : "");
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
                    <p className={`font-extrabold text-center h-20 text-6xl ${resolvedColor}`}>
                        {count}
                    </p>
                </CardBody>
            </Card>
        </div >
    );
};