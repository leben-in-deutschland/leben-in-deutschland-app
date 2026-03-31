import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
import { ClipboardCheckIcon } from "@/icons/ClipboardCheckIcon";
import { Question } from "@/types/question";
import { MockTestProgress, UserQuestionProgress } from "@/types/user";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image, Tooltip } from "@heroui/react";
import { useEffect, useState } from "react";

export const QuizAnswer = ({ translation, mockExam, questions, handleQuizCancel }: { translation: any, mockExam: MockTestProgress, questions: Question[], handleQuizCancel: any }) => {
    const [currentQuestion, setCurrentQuestion] = useState<UserQuestionProgress>(mockExam.questions[0]);
    const [mockExamAnswers, setMockExamAnswer] = useState<UserQuestionProgress[]>(mockExam.questions);
    const [currentQuizQuestion, setCurrentQuizQuestion] = useState<Question>(questions[0]);
    const [quizQuestions, setQuizQuestions] = useState<Question[]>(questions);

    useEffect(() => {
        let mockExamQuestions: Question[] = [];
        let tempAnswers: UserQuestionProgress[] = [];
        for (let i = 0; i < mockExam.questions.length; i++) {
            let indexOfQuestion = questions.findIndex(x => x?.num === mockExam.questions[i]?.num);
            if (indexOfQuestion > -1) {
                mockExamQuestions.push(questions[indexOfQuestion]);
                tempAnswers.push(mockExam.questions[i]);
            }
        }
        setQuizQuestions([...mockExamQuestions]);
        setCurrentQuizQuestion(mockExamQuestions[0]);
        setMockExamAnswer([...tempAnswers]);
        setCurrentQuestion(tempAnswers[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleNext = () => {
        let index = mockExamAnswers.findIndex(x => x?.num === currentQuestion?.num);
        if (index > -1) {
            let newIndex = index + 1;
            setCurrentQuizQuestion(quizQuestions[newIndex]);
            setCurrentQuestion(mockExamAnswers[newIndex]);
        }


    };
    const handleBack = () => {
        let index = mockExamAnswers.findIndex(x => x?.num === currentQuestion?.num);
        if (index > 0) {
            let newIndex = index - 1;
            setCurrentQuizQuestion(quizQuestions[newIndex]);
            setCurrentQuestion(mockExamAnswers[newIndex]);
        }
    };
    return (
        <div>
            <Card className="h-[100%] shadow-sm">
                <CardHeader className="flex-col items-start gap-3 pb-2">
                    <div className="flex items-center gap-2 w-full">
                        <div className={`rounded-lg p-1.5 ${currentQuestion.answeredCorrectly ? "bg-success/10 dark:bg-success/20 text-success" : "bg-danger/10 dark:bg-danger/20 text-danger"}`}>
                            {currentQuestion.answeredCorrectly ? <TickIcon /> : <CrossIcon />}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="bg-secondary/10 dark:bg-secondary/20 rounded-lg p-1.5 text-secondary">
                                <ClipboardCheckIcon size={16} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Chip size="sm" variant="flat" color="warning" className="font-bold">{quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) + 1}</Chip>
                                <span className="text-foreground/40 text-sm">/</span>
                                <Chip size="sm" variant="flat" color="danger" className="font-bold">{quizQuestions.length}</Chip>
                            </div>
                        </div>
                    </div>
                    <p className="font-bold text-lg md:text-xl text-foreground leading-snug">{currentQuizQuestion.question}</p>
                </CardHeader>
                <CardBody className="justify-center pt-2">
                    <div className="grid gap-4">
                        {currentQuizQuestion.image !== "-" && <div hidden={!(currentQuizQuestion.image !== "-")}>
                            <Image src={currentQuizQuestion.image} alt="" className="rounded-xl"></Image>
                        </div>
                        }
                        <div className="grid gap-3 md:grid-cols-2">
                            {(["a", "b", "c", "d"] as const).map((option) => {
                                const isCorrect = currentQuizQuestion.solution === option;
                                const isSelected = currentQuestion.answerSelected === option;
                                return (
                                    <Card
                                        key={option}
                                        className={`transition-all duration-200 ${isCorrect
                                            ? "bg-success/10 dark:bg-success/20 ring-1 ring-success/30"
                                            : "bg-danger/10 dark:bg-danger/20 ring-1 ring-danger/30"
                                            }`}
                                    >
                                        <CardBody>
                                            <div className="flex gap-3 items-start">
                                                <Chip
                                                    variant={isSelected ? "solid" : "bordered"}
                                                    color="primary"
                                                    size="sm"
                                                    className="min-w-[28px]"
                                                >
                                                    {option.toUpperCase()}
                                                </Chip>
                                                <span className="text-foreground text-sm md:text-base">{currentQuizQuestion[option]}</span>
                                            </div>
                                        </CardBody>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                </CardBody>
                <CardFooter className="flex justify-between items-center gap-2 pt-2 border-t border-divider">
                    <Tooltip content={translation.cancel_mock_test ?? "Cancel Mock Test"}>
                        <Button disableRipple variant="flat" color="danger" size="sm" onPress={handleQuizCancel}>{translation.cancel}</Button>
                    </Tooltip>
                    <div className="flex items-center gap-1">
                        {!(quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === 0) && <Button variant="solid" color="primary" size="sm" onPress={handleBack}>{translation.back}</Button>}
                        {!(quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === (quizQuestions.length - 1)) && <Button variant="solid" color="primary" size="sm" onPress={handleNext}>{translation.next}</Button>}
                    </div>
                </CardFooter>
            </Card>
        </div >
    );
};