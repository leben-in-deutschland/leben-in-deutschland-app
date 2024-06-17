import { Card, CardBody, CardHeader } from "@nextui-org/react";

export const NumberProgress = ({ title, count, numberColor = "", onPress, isPressable }: { title: string, count: number, numberColor: string, onPress: any, isPressable: boolean }) => {
    return (
        <div style={{ width: "18rem" }}>
            <Card className="card-stats border-none  h-[180px] w-[100%]"
                onPress={onPress}
                isPressable={isPressable}>

                <CardHeader className="justify-between">
                    <h2 className="font-bold text-uppercase text-muted">
                        {title}
                    </h2>
                </CardHeader>
                <CardBody>
                    <p className={`text-8xl font-extrabold text-center ${numberColor !== "" ? "text-" + numberColor : ""}`}>
                        {count}
                    </p>
                </CardBody>
            </Card>
        </div >
    );
};