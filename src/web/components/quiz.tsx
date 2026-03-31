import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Image, Tooltip } from "@heroui/react";
import { Countdown } from "./countdown";
import { MockTestProgress, User } from "@/types/user";
import { Question } from "@/types/question";
import { useEffect, useState } from "react";
import { saveUserData } from "@/services/user";
import { QuizProgress } from "./quiz-progress";
import { FlagIcon } from "@/icons/FlagIcon";
import { SubmitWarning } from "./modals/submit-warning";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/utils/navigation";
import { MockResult } from "./modals/mock-result";
import { ClipboardCheckIcon } from "@/icons/ClipboardCheckIcon";

export const Quiz = ({ user, questions, translation }: { user: User, questions: Question[], translation: any }) => {
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
        let index = currentMockData?.questions.findIndex(x => x?.num === currentQuizQuestion?.num) ?? -1;
        if (index > -1 && currentMockData) {
            currentMockData.questions[index].flagged = !flagPressed;
            setCurrentMockData(currentMockData);
        } else {
            if (currentMockData) {
                currentMockData.questions.push({
                    answeredCorrectly: false,
                    answerSelected: "",
                    num: currentQuizQuestion?.num,
                    skipped: false,
                    flagged: !flagPressed
                });
            }
        }
        setFlagPressed(!flagPressed);
    };

    useEffect(() => {
        let randomQuestions = generateRandomQuizQuestions(user, questions);
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
                num: randomQuestions[0]?.num,
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
            let index = currentMockData.questions.findIndex(x => x?.num === currentQuizQuestion?.num);
            if (index > -1) {
                let temp = currentMockData.questions[index];
                temp.answeredCorrectly = currentQuizQuestion.solution === option;
                temp.answerSelected = option;
                temp.num = currentQuizQuestion?.num;
            }
            else {
                currentMockData.questions.push({
                    answeredCorrectly: currentQuizQuestion.solution === option,
                    answerSelected: option,
                    num: currentQuizQuestion?.num,
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
            let index = currentMockData.questions.findIndex(x => x?.num === currentQuizQuestion?.num);
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
                    num: currentQuizQuestion?.num,
                    skipped: optionSelected === "",
                    flagged: flagPressed
                });
            }
            let indexCurrentQuestion = quizQuestions.findIndex((e) => e?.num === currentQuizQuestion?.num);
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

    const syncUserCorrectIncorrectWithMock = (user: User, currentMockData: MockTestProgress) => {
        if (user) {
            if (currentMockData.questions && currentMockData.questions.length > 0) {
                for (let question of currentMockData.questions) {
                    let tempQuestionIndex = user.questionProgress.findIndex(x => x.num === question.num);
                    if (tempQuestionIndex > -1) {
                        if (question.answeredCorrectly !== null) {
                            user.questionProgress[tempQuestionIndex].answeredCorrectly = question.answeredCorrectly;
                        }
                    }
                    else {
                        user.questionProgress.push({
                            num: question.num,
                            answeredCorrectly: question.answeredCorrectly,
                            skipped: false,
                            answerSelected: question.answerSelected,
                            flagged: false
                        });
                    }
                }
            }
        }
        return user;
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
        navigateTo("/dashboard", router.push);
    };

    const changeQuestionState = (userData: User) => {
        const today = new Date().toDateString();
        let dailyStats = userData.dailyProgress.find(
            (dp) => new Date(dp.date).toDateString() === today
        );
        if (!dailyStats) {
            dailyStats = { date: today, attempted: 0, correct: 0, incorrect: 0, skipped: 0, flagged: 0 };
            userData.dailyProgress.push(dailyStats);
        }
        if (currentMockData?.questions) {
            for (let question of currentMockData?.questions) {
                dailyStats.attempted++;
                if (question.answerSelected) {
                    if (question.answeredCorrectly) {
                        dailyStats.correct++;
                    }
                    else {
                        dailyStats.incorrect++;
                    }
                }
            }
        }
        return userData;
    };

    const handleWarningSubmit = () => {
        if (currentMockData) {
            currentMockData.passed = currentMockData.questions.filter(x => x.answeredCorrectly).length >= 17;
            currentMockData.timeTake = Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "";
            user.testProgress.push(currentMockData);
            user = changeQuestionState(user);
            user = syncUserCorrectIncorrectWithMock(user, currentMockData);
            saveUserData(user);
            setResultOpen(true);
        }
    }

    const handleQuizCancel = () => {
        if (currentMockData) {
            currentMockData.cancelled = true;
            currentMockData.timeTake = Math.floor((new Date().getTime() - startTime.getTime()) / 1000) + "";
            user.testProgress.push(currentMockData);
            user = changeQuestionState(user);
            user = syncUserCorrectIncorrectWithMock(user, currentMockData);
            saveUserData(user);
            setResultOpen(true);
        }
    };

    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const checkIfQuestionAlreadyPresentInArray = (questions: Question[], current: Question) => {
        return questions.findIndex(x => x?.num === current?.num) > -1;
    };

    const generateRandomQuizQuestions = (user: User, questions: Question[]) => {
        let allNonStateQuestions = questions.filter(x => isNumeric(x?.num));
        let allStateQuestions = questions.filter(x => x?.num.startsWith(user.state.stateCode));


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
            let tempIndex = currentMockData?.questions.findIndex(x => x?.num === temp?.num) ?? -1;
            if (tempIndex > -1) {
                setOptionSelected(currentMockData?.questions[tempIndex].answerSelected ?? "");
                setFlagPressed(currentMockData?.questions[tempIndex].flagged);
            }
        }
        setCurrentQuizQuestion(temp);
    };

    return (
        <>
            {resultOpen && currentMockData && <MockResult translation={translation} testProgress={currentMockData} isModelOpen={resultOpen} handleClose={() => handleResultCose()} />}
            <div className="flex gap-4 md:gap-6 justify-center mt-6 md:mt-10 px-2 md:px-0 quiz-fade-in">

                {
                    currentQuizQuestion &&
                    <div className="grid md:grid-cols-2 gap-3 md:gap-4 w-full max-w-6xl">
                        <div>
                            <SubmitWarning translation={translation} isModelOpen={submitModelWarning} handleClose={handleWarningClose} handleSubmit={handleWarningSubmit} />
                            <Card className="h-[100%] shadow-sm">
                                <CardHeader className="flex-col items-start gap-3 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-secondary/10 dark:bg-secondary/20 rounded-lg p-1.5 text-secondary">
                                            <ClipboardCheckIcon size={16} />
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Chip size="sm" variant="flat" color="warning" className="font-bold">{quizQuestions.findIndex(x => x?.num === currentQuizQuestion.num) + 1}</Chip>
                                            <span className="text-foreground/40 text-sm">/</span>
                                            <Chip size="sm" variant="flat" color="danger" className="font-bold">{quizQuestions.length}</Chip>
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
                                            {(["a", "b", "c", "d"] as const).map((option) => (
                                                <Card
                                                    key={option}
                                                    isPressable
                                                    onPress={() => handleOptionSelected(option)}
                                                    className={`transition-all duration-200 ${optionSelected === option
                                                        ? "bg-primary/10 dark:bg-primary/20 ring-2 ring-primary shadow-sm"
                                                        : "hover:bg-default-100 dark:hover:bg-default-50"
                                                        }`}
                                                >
                                                    <CardBody>
                                                        <div className="flex gap-3 items-start">
                                                            <Chip
                                                                variant={optionSelected === option ? "solid" : "bordered"}
                                                                color="primary"
                                                                size="sm"
                                                                className={`min-w-[28px] ${optionSelected === option ? "" : ""}`}
                                                            >
                                                                {option.toUpperCase()}
                                                            </Chip>
                                                            <span className="text-foreground text-sm md:text-base">{currentQuizQuestion[option]}</span>
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                </CardBody>
                                <CardFooter className="flex justify-between items-center gap-2 pt-2 border-t border-divider">
                                    <Tooltip content={translation.cancel_mock_test ?? "Cancel Mock Test"}>
                                        <Button variant="flat" color="danger" size="sm" onPress={handleQuizCancel}>{translation.cancel}</Button>
                                    </Tooltip>
                                    <div className="flex items-center gap-1">
                                        <Tooltip content={translation.flag_for_review ?? "Flag for review"}>
                                            <Button
                                                onPress={handleFlag}
                                                disableRipple
                                                variant="light"
                                                size="sm"
                                                isIconOnly
                                                aria-label={translation.flag_for_review ?? "Flag for review"}
                                                className={`transition-colors ${flagPressed ? "text-danger" : "text-foreground/50 hover:text-foreground"}`}
                                                startContent={<FlagIcon />}
                                            />
                                        </Tooltip>
                                        {!(quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === (quizQuestions.length - 1)) && <Button variant="solid" color="primary" size="sm" onPress={handleNext}>{translation.next}</Button>}
                                        {quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num) === (quizQuestions.length - 1) && <Button variant="solid" color="success" size="sm" onPress={handleSubmit}>{translation.submit}</Button>}
                                    </div>
                                </CardFooter>
                            </Card>
                        </div>
                        <div className="flex flex-col gap-3">
                            <Countdown handleTimeComplete={handleTimeComplete} translation={translation} />
                            {currentMockData &&
                                <QuizProgress
                                    translation={translation}
                                    questions={currentMockData.questions}
                                    onChangeFromProgressBar={onChangeFromProgressBar}
                                    currentQuestionIndex={quizQuestions.findIndex(x => x?.num === currentQuizQuestion?.num)}
                                />}
                        </div>
                    </div>
                }
            </div >
        </>
    );
};