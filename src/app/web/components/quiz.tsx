import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image, Tooltip } from "@heroui/react";
import { Countdown } from "./countdown";
import { MockTestProgress, User } from "@/types/user";
import { Question } from "@/types/question";
import { useEffect, useState } from "react";
import { saveUserData } from "@/services/user";
import { QuizProgress } from "./quiz-progress";
import { FlagIcon } from "@/icons/FlagIcon";
import { SubmitWarning } from "./models/submit-warning";
import { useRouter } from "next/navigation";
import { MockResult } from "./models/mock-result";

export const Quiz = ({ user, questions }: { user: User, questions: Question[] }) => {
    const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
    const [currentQuizQuestion, setCurrentQuizQuestion] = useState<Question>(quizQuestions[0]);
    const [optionSelected, setOptionSelected] = useState<string>("");
    const [currentMockData, setCurrentMockData] = useState<MockTestProgress>();
    const [startTime] = useState<Date>(new Date());
    const [flagPressed, setFlagPressed] = useState<boolean>(false);
    const [submitModelWarning, setSubmitModelWarning] = useState<boolean>(false);

    const [resultOpen, setResultOpen] = useState<boolean>(false);
    const router = useRouter();
    const handleFlag = () => {
        let index = currentMockData?.questions.findIndex(x => x.num === currentQuizQuestion.num) ?? -1;
        if (index > -1 && currentMockData) {
            currentMockData.questions[index].flagged = !flagPressed;
            setCurrentMockData(currentMockData);
        } else {
            if (currentMockData) {
                currentMockData.questions.push({
                    answeredCorrectly: false,
                    answerSelected: "",
                    num: currentQuizQuestion.num,
                    skipped: false,
                    flagged: !flagPressed
                });
            }
        }
        setFlagPressed(!flagPressed);
    };

    useEffect(() => {
        let randomQuestions = generateRandomQuizQuestions(user, questions);
        console.log(randomQuestions);
        setQuizQuestions(randomQuestions);
        setCurrentQuizQuestion(randomQuestions[0]);
        if (!currentMockData) {
            let tempMockData: MockTestProgress = {
                datetime: new Date().toISOString(),
                timeTake: "",
                passed: false,
                cancelled: false,
                questions: []
            };
            tempMockData.questions.push({
                answeredCorrectly: false,
                answerSelected: "",
                num: randomQuestions[0].num,
                skipped: false,
                flagged: false
            });
            setCurrentMockData(tempMockData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOptionSelected = (option: string) => {
        if (!currentQuizQuestion) {
            return;
        }

        if (currentMockData) {
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

        if (currentMockData) {
            let index = currentMockData.questions.findIndex(x => x.num === currentQuizQuestion.num);
            if (index > -1) {
                let temp = currentMockData.questions[index];
                temp.answeredCorrectly = currentQuizQuestion.solution === optionSelected;
                temp.answerSelected = optionSelected;
                temp.skipped = optionSelected === "";
                temp.flagged = flagPressed;
            } else {
                currentMockData.questions.push({
                    answeredCorrectly: currentQuizQuestion.solution === optionSelected,
                    answerSelected: optionSelected,
                    num: currentQuizQuestion.num,
                    skipped: optionSelected === "",
                    flagged: flagPressed
                });
            }
            let indexCurrentQuestion = quizQuestions.findIndex((e) => e.num === currentQuizQuestion.num);
            if (indexCurrentQuestion >= 0) {
                if (indexCurrentQuestion != quizQuestions.length - 1) {
                    let nextIndex = indexCurrentQuestion + 1;
                    setCurrentQuizQuestion(quizQuestions[nextIndex]);
                    setOptionSelected("");
                }
            }
            setFlagPressed(false);
        }
    };

    const handleTimeComplete = () => {
        handleSubmit();
    };

    const handleSubmit = async () => {
        if (currentMockData) {
            if (currentMockData.questions.filter(x => x.flagged || x.skipped).length > 0) {
                setSubmitModelWarning(true)
            } else {
                handleWarningSubmit();
            }
        };


    };
    const handleWarningClose = () => {
        setSubmitModelWarning(false);
    };

    const handleResultCose = () => {
        setResultOpen(false);
        router.push("/dashboard");
    };

    const handleWarningSubmit = () => {
        if (currentMockData) {
            currentMockData.passed = currentMockData.questions.filter(x => x.answeredCorrectly).length >= 17;
            currentMockData.timeTake = Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "";
            user.testProgress.push(currentMockData);
            saveUserData(user);
            setResultOpen(true);
        }
    }

    const handleQuizCancel = () => {
        if (currentMockData) {
            currentMockData.cancelled = true;
            currentMockData.timeTake = Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "";
            user.testProgress.push(currentMockData);
            saveUserData(user);
            setResultOpen(true);
        }
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
    const onChangeFromProgressBar = (index: number) => {
        let temp = quizQuestions[index];
        if (currentMockData) {
            let tempIndex = currentMockData?.questions.findIndex(x => x.num === temp.num) ?? -1;
            if (tempIndex > -1) {
                setOptionSelected(currentMockData?.questions[tempIndex].answerSelected ?? "");
                setFlagPressed(currentMockData?.questions[tempIndex].flagged);
            }
        }
        setCurrentQuizQuestion(temp);
    };

    return (
        <>
            {resultOpen && currentMockData && <MockResult testProgress={currentMockData} isModelOpen={resultOpen} handleClose={() => handleResultCose()} />}
            <div className="flex gap-6 justify-center mt-10">

                {
                    currentQuizQuestion &&
                    <div className="grid md:grid-cols-2 gap-2">
                        <div>
                            <SubmitWarning isModelOpen={submitModelWarning} handleClose={handleWarningClose} handleSubmit={handleWarningSubmit} />
                            <Card className="h-[100%]">
                                <CardHeader className="justify-center">
                                    <p className="font-bold text-xl">{currentQuizQuestion.question}</p>
                                </CardHeader>
                                <CardBody className="justify-center">
                                    <div className="grid gap-4">
                                        {currentQuizQuestion.image !== "-" && <div hidden={!(currentQuizQuestion.image !== "-")}>
                                            <Image src={currentQuizQuestion.image} alt=""></Image>
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
                                <CardFooter className="flex gap-2">
                                    <div className="flex gap-1">
                                        <p className="bg-yellow-400 rounded-xl p-2 dark:text-white font-bold">{quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) + 1}</p>
                                        <p className="p-[5%] dark:text-white font-extrabold text-center">/</p>
                                        <p className="bg-red-400 rounded-xl p-2 dark:text-white font-bold">{quizQuestions.length}</p>
                                    </div>
                                    <div className="flex">
                                        <Tooltip content="Cancel Mock Test">
                                            <Button disableRipple variant="solid" color="danger" onPress={handleQuizCancel}>Cancel</Button>
                                        </Tooltip>
                                        <Tooltip content="Flag for review">
                                            <Button onPress={handleFlag} disableRipple variant="light" className={`dark:invert ${flagPressed ? "text-red-600" : "text-white"}`} style={{ backgroundColor: 'transparent' }} startContent={<FlagIcon />} />
                                        </Tooltip>
                                        {!(quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) === (quizQuestions.length - 1)) && <Button variant="solid" color="primary" onPress={handleNext}>Next</Button>}
                                        {quizQuestions.findIndex(x => x.num === currentQuizQuestion.num) === (quizQuestions.length - 1) && <Button variant="solid" color="success" onPress={handleSubmit}>Submit</Button>}
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                        <div className="grid">
                            <div className="">
                                <Countdown handleTimeComplete={handleTimeComplete} />
                            </div>
                            <div>
                                {currentMockData &&
                                    <QuizProgress
                                        questions={currentMockData.questions}
                                        onChangeFromProgressBar={onChangeFromProgressBar}
                                        currentQuestionIndex={quizQuestions.findIndex(x => x.num === currentQuizQuestion.num)}
                                    />}
                            </div>

                        </div>
                    </div>
                }
            </div >
        </>
    );
};