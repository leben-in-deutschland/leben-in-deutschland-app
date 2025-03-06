import { CrossIcon } from "@/icons/CrossIcon";
import { TickIcon } from "@/icons/TickIcon";
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
            <Card className="h-[100%]">
                <CardHeader className="justify-center">
                    <div className="flex gap-2">
                        <div>
                            {currentQuestion.answeredCorrectly ? <TickIcon className="text-green-500" /> : <CrossIcon className="text-red-500" />}
                        </div>
                        <p className="font-bold text-xl">{currentQuizQuestion.question}</p>
                    </div>
                </CardHeader>
                <CardBody className="justify-center">
                    <div className="grid gap-4">
                        {currentQuizQuestion.image !== "-" && <div hidden={!(currentQuizQuestion.image !== "-")}>
                            <Image src={currentQuizQuestion.image} alt=""></Image>
                        </div>
                        }
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card className={`${currentQuizQuestion.solution === "a" ? "bg-green-200" : "bg-red-200"}`}>
                                <CardBody>
                                    <div className="flex gap-3">
                                        <Chip variant="bordered" color="primary" className={`${currentQuestion.answerSelected === "a" ? "bg-cyan-500" : ""}`}>A</Chip>
                                        <span className="text-black">{currentQuizQuestion.a}</span>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className={`${currentQuizQuestion.solution === "b" ? "bg-green-200" : "bg-red-200"}`}>
                                <CardBody>
                                    <div className="flex gap-3">
                                        <Chip variant="bordered" color="primary" className={`${currentQuestion.answerSelected === "b" ? "bg-cyan-500" : ""}`}>B</Chip>
                                        <span className="text-black">{currentQuizQuestion.b}</span>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className={`${currentQuizQuestion.solution === "c" ? "bg-green-200" : "bg-red-200"}`}>
                                <CardBody>
                                    <div className="flex gap-3">
                                        <Chip variant="bordered" color="primary" className={`${currentQuestion.answerSelected === "c" ? "bg-cyan-500" : ""}`}>C</Chip>
                                        <span className="text-black">{currentQuizQuestion.c}</span>
                                    </div>
                                </CardBody>
                            </Card>
                            <Card className={`${currentQuizQuestion.solution === "d" ? "bg-green-200" : "bg-red-200"}`}>
                                <CardBody>
                                    <div className="flex gap-3">
                                        <Chip variant="bordered" color="primary" className={`${currentQuestion.answerSelected === "d" ? "bg-cyan-500" : ""}`}>D</Chip>
                                        <span className="text-black">{currentQuizQuestion.d}</span>
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    </div>
                </CardBody>
                <CardFooter className="justify-between">
                    <div className="flex gap-3">
                        <p className="bg-yellow-400 rounded-xl p-2 dark:text-white font-bold">{quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) + 1}</p>
                        <p className="bg-red-400 rounded-xl p-2 dark:text-white font-bold">{quizQuestions.length}</p>

                    </div>
                    <div className="flex">
                        <Tooltip content="Cancel Mock Test">
                            <Button disableRipple variant="solid" color="danger" onPress={handleQuizCancel}>{translation.cancel}</Button>
                        </Tooltip>
                        {!(quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === 0) && <Button variant="solid" color="primary" onPress={handleBack}>{translation.back}</Button>}
                        {!(quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === (quizQuestions.length - 1)) && <Button variant="solid" color="primary" onPress={handleNext}>{translation.next}</Button>}
                    </div>
                </CardFooter>
            </Card>
        </div >
    );
};