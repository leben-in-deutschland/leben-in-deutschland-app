import { FlagIcon } from "@/icons/FlagIcon";
import { UserQuestionProgress } from "@/types/user";
import { Button, Card, CardHeader } from "@nextui-org/react";

export const QuizProgress = ({ questions, onChangeFromProgressBar, currentQuestionIndex }: { questions: UserQuestionProgress[], onChangeFromProgressBar: any, currentQuestionIndex: number }) => {
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
                        <Button isDisabled={x > questions.length} key={x} className={`${currentQuestionIndex === x ? "bg-blue-500" : ""} ${questions[x]?.answerSelected ? "bg-green-500" : ""}`} size="sm" variant="bordered" disableRipple onPress={() => onChangeFromProgressBar(x)}>
                            <div className="flex gap-1 items-center">
                                <p className="font-bold">{x + 1}</p>
                                {questions[x]?.flagged && <FlagIcon size={10} />}
                            </div>
                        </Button>
                    ))
                }
            </div>
        </Card>
    );
};