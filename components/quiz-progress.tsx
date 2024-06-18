import { FlagIcon } from "@/icons/FlagIcon";
import { Question } from "@/types/question";
import { MockTestProgress } from "@/types/user";
import { Button, Card, CardHeader } from "@nextui-org/react";

export const QuizProgress = ({ onChangeFromProgressBar }: { onChangeFromProgressBar: any }) => {
    return (
        <Card className="mt-3 p-2">
            <CardHeader>
                <h2 className="font-bold text-uppercase text-muted ">
                    Progress
                </h2>
            </CardHeader>
            <div className="grid grid-cols-7 gap-1">
                {
                    Array.from(Array(33).keys()).map((x) => (
                        <Button key={x} size="sm" variant="bordered" disableRipple onPress={() => onChangeFromProgressBar(x)}>
                            <div className="flex gap-1 items-center">
                                <p className="font-bold">{x + 1}</p>
                                <FlagIcon size={10} />
                            </div>
                        </Button>
                    ))
                }
            </div>
        </Card>
    );
};