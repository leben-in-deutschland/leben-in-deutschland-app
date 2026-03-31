import { FlagIcon } from "@/icons/FlagIcon";
import { GridIcon } from "@/icons/GridIcon";
import { UserQuestionProgress } from "@/types/user";
import { Button, Card, CardHeader } from "@heroui/react";

export const QuizProgress = ({ questions, onChangeFromProgressBar, currentQuestionIndex, translation }:
    { questions: UserQuestionProgress[], onChangeFromProgressBar: any, currentQuestionIndex: number, translation: any }) => {
    return (
        <Card className="shadow-sm">
            <CardHeader className="gap-2">
                <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-1.5 text-primary">
                    <GridIcon size={16} />
                </div>
                <h2 className="font-bold text-sm text-foreground/70">
                    {translation.progress}
                </h2>
            </CardHeader>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-1 p-3 pt-0">
                {
                    Array.from(Array(33).keys()).map((x) => (
                        <Button
                            isDisabled={x > questions.length}
                            key={x}
                            className={`transition-all duration-200 ${currentQuestionIndex === x
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : questions[x]?.answerSelected
                                    ? "bg-success/20 text-success border-success/30"
                                    : ""
                                }`}
                            size="sm"
                            variant={currentQuestionIndex === x || questions[x]?.answerSelected ? "flat" : "bordered"}
                            disableRipple
                            onPress={() => onChangeFromProgressBar(x)}
                        >
                            <div className="flex items-center gap-0.5">
                                <p className="font-bold text-xs">{x + 1}</p>
                                {questions[x]?.flagged && <FlagIcon size={8} />}
                            </div>
                        </Button>
                    ))
                }
            </div>
        </Card>
    );
};
