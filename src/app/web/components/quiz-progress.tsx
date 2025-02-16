import { FlagIcon } from "@/icons/FlagIcon";
import { UserQuestionProgress } from "@/types/user";
import { Button, Card, CardHeader } from "@heroui/react";

export const QuizProgress = ({ questions, onChangeFromProgressBar, currentQuestionIndex, translation }:
    { questions: UserQuestionProgress[], onChangeFromProgressBar: any, currentQuestionIndex: number, translation: any }) => {
    return (
        <Card className="p-4 md:p-2 mt-2">
            <CardHeader>
                <h2 className="font-bold text-uppercase text-muted">
                    {translation.progress}
                </h2>
            </CardHeader>
            <div className="grid grid-cols-4 md:grid-cols-7">
                {
                    Array.from(Array(33).keys()).map((x) => (
                        <Button isDisabled={x > questions.length} key={x} className={`m-1 ${currentQuestionIndex === x ? "bg-blue-500" : ""} ${questions[x]?.answerSelected ? "bg-green-500" : ""}`} size="sm" variant="bordered" disableRipple onPress={() => onChangeFromProgressBar(x)}>
                            <div className="flex items-center">
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