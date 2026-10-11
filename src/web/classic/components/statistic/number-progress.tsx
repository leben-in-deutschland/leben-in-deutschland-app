import { Card, CardBody, CardHeader } from "@heroui/react";
import { ReactNode } from "react";

export const NumberProgress = ({ title, count, numberColor = "", onPress, isPressable, icon }: { title: string, count: number, numberColor: string, onPress: any, isPressable: boolean, icon?: ReactNode }) => {
    const colorMap: Record<string, string> = {
        "green-500": "text-success",
        "green-400": "text-success",
        "red-700": "text-danger",
        "red-400": "text-danger",
        "yellow-500": "text-warning",
        "blue-500": "text-primary",
        "orange-500": "text-warning",
        "purple-500": "text-secondary",
    };
    const bgMap: Record<string, string> = {
        "green-500": "bg-success/10",
        "green-400": "bg-success/10",
        "red-700": "bg-danger/10",
        "red-400": "bg-danger/10",
        "yellow-500": "bg-warning/10",
        "blue-500": "bg-primary/10",
        "orange-500": "bg-warning/10",
        "purple-500": "bg-secondary/10",
    };
    const iconColorMap: Record<string, string> = {
        "green-500": "text-success",
        "green-400": "text-success",
        "red-700": "text-danger",
        "red-400": "text-danger",
        "yellow-500": "text-warning",
        "blue-500": "text-primary",
        "orange-500": "text-warning",
        "purple-500": "text-secondary",
    };
    const resolvedColor = colorMap[numberColor] ?? (numberColor !== "" ? `text-${numberColor}` : "text-foreground");
    const resolvedBg = bgMap[numberColor] ?? "";
    const resolvedIconColor = iconColorMap[numberColor] ?? "text-foreground/50";
    return (
        <div>
            <Card className={`group border-none md:h-[180px] w-[100%] hover:shadow-md transition-shadow ${resolvedBg}`}
                onPress={onPress}
                isPressable={isPressable}>

                <CardHeader className="justify-center pb-0 gap-1.5">
                    {icon && (
                        <span className={resolvedIconColor}>
                            {icon}
                        </span>
                    )}
                    <h2 className="font-semibold text-uppercase text-foreground/60 text-xs tracking-wide">
                        {title}
                    </h2>
                </CardHeader>
                <CardBody className="justify-center">
                    <p className={`font-extrabold text-center text-5xl md:text-6xl ${resolvedColor} transition-transform group-hover:scale-105`}>
                        {count}
                    </p>
                </CardBody>
            </Card>
        </div >
    );
};
