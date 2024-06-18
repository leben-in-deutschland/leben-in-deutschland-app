import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image, Tooltip } from "@nextui-org/react";
import { Countdown } from "./countdown";
import { MockTestProgress, User } from "@/types/user";
import { Question } from "@/types/question";
import { useEffect, useState } from "react";
import { saveUserData } from "@/services/user";

export const Quiz = ({ user, questions, handleCancel, isAuthenticated }: { user: User, questions: Question[], handleCancel: any, isAuthenticated: boolean }) => {
    const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
    const [currentQuizQuestion, setCurrentQuizQuestion] = useState<Question>(quizQuestions[0]);
    const [optionSelected, setOptionSelected] = useState<string>("");
    const [currentMockData, setCurrentMockData] = useState<MockTestProgress>();
    const [startTime] = useState<Date>(new Date());

    useEffect(() => {
        let randomQuestions = generateRandomQuizQuestions(user, questions);
        setQuizQuestions(randomQuestions);
        setCurrentQuizQuestion(randomQuestions[0]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOptionSelected = (option: string) => {
        if (!currentQuizQuestion) {
            return;
        }
        if (!currentMockData) {
            let tempMockData: MockTestProgress = {
                datetime: new Date().toISOString(),
                timeTake: "",
                passed: false,
                cancelled: false,
                questions: []
            };
            tempMockData.questions.push({
                answeredCorrectly: currentQuizQuestion.solution === option,
                answerSelected: option,
                num: currentQuizQuestion.num,
                skipped: false,
                flagged: false
            });
            setCurrentMockData(tempMockData);
        }
        else {
            let index = currentMockData.questions.findIndex(x => x.num === currentQuizQuestion.num);
            if (index > -1) {
                let temp = currentMockData.questions[index];
                temp.answeredCorrectly = currentQuizQuestion.solution === option;
                temp.answerSelected = option;
                temp.num = currentQuizQuestion.num;
            }
            else {
                currentMockData.questions.push({
                    answeredCorrectly: currentQuizQuestion.solution === option,
                    answerSelected: option,
                    num: currentQuizQuestion.num,
                    skipped: false,
                    flagged: false
                });
            }
            setCurrentMockData(currentMockData);
        }
        setOptionSelected(option);
    };

    const handleNext = () => {
        let indexCurrentQuestion = quizQuestions.findIndex((e) => e.num === currentQuizQuestion.num);
        if (indexCurrentQuestion >= 0) {
            if (indexCurrentQuestion != quizQuestions.length - 1) {
                let nextIndex = indexCurrentQuestion + 1;
                setCurrentQuizQuestion(quizQuestions[nextIndex]);
                setOptionSelected("");
            }
        }
    };

    const handleTimeComplete = () => {
        handleSubmit();
    };

    const handleSubmit = async () => {
        if (currentMockData) {
            currentMockData.passed = currentMockData.questions.filter(x => x.answeredCorrectly).length >= 17;
            currentMockData.timeTake = Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "";
            user.testProgress.push(currentMockData);
            // let today = new Date().toLocaleDateString();
            // let todayProgressIndex = user.dailyProgress.findIndex(x => x.date === today);
            // if (todayProgressIndex >= 0) {
            //     let temp = user.dailyProgress[todayProgressIndex];
            //     user.dailyProgress[todayProgressIndex] = {
            //         attempted: temp.attempted + currentMockData.questions.length,
            //         date: temp.date,
            //         correct: temp.correct + currentMockData.questions.filter(x => x.answeredCorrectly).length,
            //         incorrect: temp.incorrect + currentMockData.questions.filter(x => !x.answeredCorrectly).length
            //     };
            // } else {
            //     user.dailyProgress.push({
            //         attempted: currentMockData.questions.length,
            //         date: today,
            //         correct: currentMockData.questions.filter(x => x.answeredCorrectly).length,
            //         incorrect: currentMockData.questions.filter(x => !x.answeredCorrectly).length
            //     });
            // }

            // user.overallProgress.attempted = user.overallProgress.attempted + currentMockData.questions.length;
            // user.overallProgress.incorrect = currentMockData.questions.filter(x => !x.answeredCorrectly).length;
            // user.overallProgress.correct = currentMockData.questions.filter(x => x.answeredCorrectly).length;

            await saveUserData(user, isAuthenticated);
        }

        handleCancel();
    };

    const handleQuizCancel = () => {
        handleCancel();
    };

    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const checkIfQuestionAlreadyPresentInArray = (questions: Question[], current: Question) => {
        return questions.findIndex(x => x.num === current.num) > -1;
    };

    const generateRandomQuizQuestions = (user: User, questions: Question[]) => {
        let allNonStateQuestions = questions.filter(x => isNumeric(x.num));
        let allStateQuestions = questions.filter(x => x.num.startsWith(user.state.stateCode));


        let tempQuestions: Question[] = [];

        for (let i = 0; i < 30;) {
            const allNonStateQuestionsRandomIndex = Math.floor(Math.random() * allNonStateQuestions.length);
            let currentRandom = allNonStateQuestions[allNonStateQuestionsRandomIndex];
            if (!checkIfQuestionAlreadyPresentInArray(tempQuestions, currentRandom)) {
                tempQuestions.push(currentRandom);
                i++;
            }
        }

        for (let i = 0; i < 3;) {
            const allStateQuestionsRandomIndex = Math.floor(Math.random() * allStateQuestions.length);
            let currentRandom = allStateQuestions[allStateQuestionsRandomIndex];
            if (!checkIfQuestionAlreadyPresentInArray(tempQuestions, currentRandom)) {
                tempQuestions.push(currentRandom);
                i++
            }
        }
        return tempQuestions;
    };

    return (
        <div className="flex gap-6">
            {
                currentQuizQuestion &&
                <>
                    <div>
                        <Card>
                            <CardHeader className="justify-between">
                                <p className="font-bold text-xl">{currentQuizQuestion.question}</p>
                            </CardHeader>
                            <CardBody>
                                <div className="grid gap-4">
                                    {currentQuizQuestion.image !== "-" && <div hidden={!(currentQuizQuestion.image !== "-")}>
                                        <Image src={`/question/${currentQuizQuestion.image}.png`} alt=""></Image>
                                    </div>
                                    }
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card isPressable onPress={() => handleOptionSelected("a")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "a" ? "bg-cyan-500" : ""}`}>A</Chip>
                                                    {currentQuizQuestion.a}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable onPress={() => handleOptionSelected("b")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "b" ? "bg-cyan-500" : ""}`}>B</Chip>
                                                    {currentQuizQuestion.b}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable onPress={() => handleOptionSelected("c")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "c" ? "bg-cyan-500" : ""}`}>C</Chip>
                                                    {currentQuizQuestion.c}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable onPress={() => handleOptionSelected("d")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "d" ? "bg-cyan-500" : ""}`}>D</Chip>
                                                    {currentQuizQuestion.d}
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </CardBody>
                            <CardFooter className="justify-end gap-4">
                                {quizQuestions.length}
                                <Tooltip content="Cancel Mock Test">
                                    <Button disableRipple variant="solid" color="danger" onPress={handleQuizCancel}>Cancel</Button>
                                </Tooltip>
                                {!(quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) === (quizQuestions.length - 1)) && <Button variant="solid" color="primary" onPress={handleNext}>Next</Button>}
                                {quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) === (quizQuestions.length - 1) && <Button variant="solid" color="success" onPress={handleSubmit}>Submit</Button>}
                            </CardFooter>
                        </Card>
                    </div>
                    <div>
                        <Countdown handleTimeComplete={handleTimeComplete} />
                    </div>
                </>
            }
        </div >
    );
};