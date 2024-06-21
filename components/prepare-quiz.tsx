import { ArrowLeftIcon } from "@/icons/ArrowLeftIcon";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { DashboardIcon } from "@/icons/DashboardIcon";
import { FlagIcon } from "@/icons/FlagIcon";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { Question } from "@/types/question";
import { User } from "@/types/user";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Tooltip, Image } from "@nextui-org/react";
import { useEffect, useState } from "react";
import { createUserStats } from "@/utils/user-mapping";
import toast from "react-hot-toast";
import { TranslateIcon } from "@/icons/TranslateIcon";


export default function PrepareQuiz({ originalQuestions, user, prepareQuestion, handleHomePress, isAuthenticated }:
    {
        originalQuestions: Question[],
        user: User,
        prepareQuestion: PrepareQuestionType,
        handleHomePress: any,
        isAuthenticated: boolean
    }) {
    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const [questions, setPrepareQuestions] = useState<Question[]>(originalQuestions.filter(x => x.num.startsWith(user.state.stateCode) || isNumeric(x.num)));
    const [currentQuestion, setCurrentQuestion] = useState<Question>();
    const [isPreviousEnabled, setPreviousEnable] = useState<boolean>(false);
    const [optionSelected, setOptionSelected] = useState<string>("");
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [nextEnabled, setNextEnabled] = useState<boolean>(false);
    const [submitDisabled, setSubmitDisabled] = useState<boolean>(true);
    const [blockAnserChange, setBlockAnsweChange] = useState<boolean>(false);
    const [flagPressed, setFlagPressed] = useState<boolean>(false);
    const [disableSkip, setDisableSkip] = useState<boolean>(false);
    const [currentAction, setCurrentAction] = useState<PrepareQuestionActions>(prepareQuestion.action);

    useEffect(() => {
        if (currentAction === PrepareQuestionActions.Prepare) {
            let tempQuestion: Question[] = [];
            for (let i = 0; i < questions.length; i++) {
                if (user.questionProgress.findIndex(x => x.num === questions[i].num) > -1) {
                    continue;
                }
                tempQuestion.push(questions[i]);
            }
            setCurrentQuestion(tempQuestion[0]);
            setPrepareQuestions(tempQuestion);
        }
        if (prepareQuestion.action === PrepareQuestionActions.State) {
            let current: Question[] = questions.filter(x => x.num.startsWith(user.state.stateCode));
            setPrepareQuestions(current);
            setCurrentQuestion(current[0]);
        }
        if (prepareQuestion.action === PrepareQuestionActions.Skipped) {
            let tempSkipped: Question[] = [];
            let skipped = user.questionProgress.filter(x => x.skipped);
            for (let i = 0; i < skipped.length; i++) {
                let indexSkipped = questions.findIndex(x => x.num === skipped[i].num);
                if (indexSkipped > -1) {
                    tempSkipped.push(questions[indexSkipped]);
                }
            }
            setPrepareQuestions(tempSkipped);
            setCurrentQuestion(tempSkipped[0]);
        }
        if (prepareQuestion.action === PrepareQuestionActions.Flagged) {
            let tempFlagged: Question[] = [];
            let skipped = user.questionProgress.filter(x => x.flagged);
            for (let i = 0; i < skipped.length; i++) {
                let indexSkipped = questions.findIndex(x => x.num === skipped[i].num);
                if (indexSkipped > -1) {
                    tempFlagged.push(questions[indexSkipped]);
                }
            }
            setPrepareQuestions(tempFlagged);
            setCurrentQuestion(tempFlagged[0]);
        }
        if (prepareQuestion.action === PrepareQuestionActions.Correct) {
            let tempCorrect: Question[] = [];
            let skipped = user.questionProgress.filter(x => x.answeredCorrectly);
            for (let i = 0; i < skipped.length; i++) {
                let indexSkipped = questions.findIndex(x => x.num === skipped[i].num);
                if (indexSkipped > -1) {
                    tempCorrect.push(questions[indexSkipped]);
                }
            }
            setPrepareQuestions(tempCorrect);
            setCurrentQuestion(tempCorrect[0]);
        }
        if (prepareQuestion.action === PrepareQuestionActions.Incorrect) {
            let tempIncorrect: Question[] = [];
            let skipped = user.questionProgress.filter(x => !x.answeredCorrectly && x.answerSelected !== "");
            for (let i = 0; i < skipped.length; i++) {
                let indexSkipped = questions.findIndex(x => x.num === skipped[i].num);
                if (indexSkipped > -1) {
                    tempIncorrect.push(questions[indexSkipped]);
                }
            }
            setPrepareQuestions(tempIncorrect);
            setCurrentQuestion(tempIncorrect[0]);
        }
        setCurrentAction(prepareQuestion.action);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prepareQuestion.action, user.state.stateCode]);

    useEffect(() => {
        if (currentAction !== PrepareQuestionActions.Prepare && currentAction !== PrepareQuestionActions.Incorrect) {
            let currentQuestionIndex = user.questionProgress.findIndex(x => x.num === currentQuestion?.num);
            if (currentQuestionIndex > -1) {
                if (!user.questionProgress[currentQuestionIndex].skipped && user.questionProgress[currentQuestionIndex].answerSelected !== "") {
                    setShowSolution(true);
                }
                setOptionSelected(user.questionProgress[currentQuestionIndex].answerSelected);
                if (user.questionProgress[currentQuestionIndex].answeredCorrectly) {
                    setSubmitDisabled(true);
                }
                setFlagPressed(user.questionProgress[currentQuestionIndex].flagged);
            }
            setNextEnabled(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentAction, currentQuestion]);

    const handleOptionSelected = (option: string) => {
        if (!blockAnserChange) {
            setSubmitDisabled(false);
            setOptionSelected(option);
        }
    };

    const nextQuestion = () => {
        let indexCurrentQuestion = questions.findIndex((e) => e.num === currentQuestion?.num);
        if (indexCurrentQuestion >= 0) {
            if (indexCurrentQuestion != questions.length - 1) {
                let nextIndex = indexCurrentQuestion + 1;
                return questions[nextIndex];
            }
        }
        return null;
    };

    const handleSkip = () => {
        if (!disableSkip) {
            let newQuestion = nextQuestion();
            if (newQuestion !== null) {
                user.questionProgress.push({
                    num: currentQuestion?.num ?? "",
                    skipped: true,
                    answerSelected: "",
                    flagged: false,
                    answeredCorrectly: false,

                });
                createUserStats(user, optionSelected === currentQuestion?.solution, false, true, isAuthenticated, currentQuestion?.num ?? "");
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
                setFlagPressed(false);
            }
        }
    };
    const handleFlag = () => {
        if (!flagPressed) {
            toast.success("Question flagged successfully, you can either submit the answer or move to next question", { icon: '🚩' });
        }
        setFlagPressed(!flagPressed);
        if (currentQuestion?.solution !== optionSelected) {
            setNextEnabled(!flagPressed);
        }
        setDisableSkip(!flagPressed);
    };

    const handlePrevious = () => {
        let indexCurrentQuestion = questions.findIndex((e) => e.num === currentQuestion?.num);
        if (indexCurrentQuestion >= 0) {
            if (indexCurrentQuestion != 0) {
                let prevIndex = indexCurrentQuestion - 1;
                let prevQuestion = questions[prevIndex];
                setCurrentQuestion(prevQuestion);
                let historyIndex = user.questionProgress.findIndex((x) => x.num === prevQuestion.num);
                if (historyIndex > -1) {
                    if (!user.questionProgress[historyIndex].skipped) {
                        if (user.questionProgress[historyIndex].answerSelected !== "") {
                            setOptionSelected(user.questionProgress[historyIndex].answerSelected);
                            setShowSolution(true);
                            setNextEnabled(true);
                            setBlockAnsweChange(true);
                            setSubmitDisabled(true);
                        }
                    }
                    setFlagPressed(user.questionProgress[historyIndex].flagged);
                    setDisableSkip(user.questionProgress[historyIndex].answerSelected !== "");
                }
                if (prevIndex == 0) {
                    setPreviousEnable(false);
                }
            }
        }
    }
    const handleSubmit = () => {
        if (!submitDisabled && optionSelected !== "") {
            setShowSolution(true);
            setNextEnabled(true);
            setBlockAnsweChange(true);
            setSubmitDisabled(true);
            setDisableSkip(true);
        }
        else {
            toast.error("Please select an answer before submitting");
        }
    };
    const handleNext = () => {
        if (flagPressed || (nextEnabled && submitDisabled && optionSelected !== "")) {
            toast("Syncing your response", { icon: '⌛' });
            let currentQuesIndex = user.questionProgress.findIndex(x => x.num === currentQuestion?.num);
            let temp = {
                num: currentQuestion?.num ?? "",
                skipped: false,
                answerSelected: optionSelected,
                flagged: flagPressed,
                answeredCorrectly: optionSelected === currentQuestion?.solution
            };
            if (currentQuesIndex > -1) {
                user.questionProgress[currentQuesIndex] = temp;

            } else {
                user.questionProgress.push(temp);
            }
            setShowSolution(false);
            setBlockAnsweChange(false);
            createUserStats(user, optionSelected === currentQuestion?.solution, flagPressed, false, isAuthenticated, currentQuestion?.num ?? "");
            toast.success("Successfully synced your data");
            setOptionSelected("");
            setNextEnabled(false);
            setSubmitDisabled(false);
            setFlagPressed(false);
            setDisableSkip(false);
            let newQuestion = nextQuestion();
            if (newQuestion !== null) {
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
            } else {
                toast("You have attempted all of the questions.", {
                    icon: '👏',
                    style: {
                        backgroundColor: '#A9FFD8'
                    }
                });
                handleHomePress();
            }
        } else {
            toast.error("Please submit you answer.");
        }
    };
    const openGoogleTranslate = () => {
        let text = encodeURIComponent(`${currentQuestion?.question} \n\n${currentQuestion?.a}\n${currentQuestion?.b}\n${currentQuestion?.c}\n${currentQuestion?.d}`);
        let url = `https://translate.google.com/?sl=de&tl=en&text=${text}&op=translate&u=BLANK`;
        window.open(url, '_blank');
    };
    return (
        <div className="grid gap-5 w-[100%]  justify-center mt-10">
            <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-2">
                    <Button startContent={<DashboardIcon size={44} />}
                        variant="solid"
                        onPress={handleHomePress}
                        className="font-bold"
                        color="primary"
                    > Dashboard</Button>

                </div>
                <div className="flex gap-6 justify-between">

                    <Button startContent={<ArrowLeftIcon />}
                        disabled={!isPreviousEnabled}
                        variant="solid"
                        onPress={handlePrevious}
                        className="font-bold"
                        color="secondary"
                    > Previous</Button>


                    <Button endContent={<ArrowRightIcon />}
                        disabled={!disableSkip}
                        variant="solid"
                        onPress={handleSkip}
                        className="font-bold"
                        color="secondary"
                    > Skip</Button>

                </div>
            </div>


            {currentQuestion &&
                <div className="flex gap-6">
                    <div>
                        <Card>
                            <CardHeader className="justify-between">
                                <div className="flex gap-3">
                                    <p className="font-extrabold text-xl text-gray-700">{currentQuestion.num}. </p>
                                    <p className="font-bold text-xl">{currentQuestion.question}</p>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <div className="grid gap-4">
                                    {currentQuestion.image !== "-" && <div hidden={!(currentQuestion.image !== "-")}>
                                        <Image src={`/question/${currentQuestion.image}.png`} alt=""></Image>
                                    </div>
                                    }
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "a") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("a")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "a" ? "bg-cyan-500" : ""}`}>A</Chip>
                                                    {currentQuestion.a}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "b") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("b")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "b" ? "bg-cyan-500" : ""}`}>B</Chip>
                                                    {currentQuestion.b}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "c") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("c")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "c" ? "bg-cyan-500" : ""}`}>C</Chip>
                                                    {currentQuestion.c}
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "d") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("d")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "d" ? "bg-cyan-500" : ""}`}>D</Chip>
                                                    {currentQuestion.d}
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </CardBody>
                            <CardFooter className="justify-between gap-4">
                                <Tooltip content="Translate">
                                    <Button
                                        onPress={openGoogleTranslate}
                                        className="dark:invert" color="primary" variant="light" startContent={<TranslateIcon size={44} />}></Button>
                                </Tooltip>
                                <div className="justify-end gap-4">
                                    <Tooltip content="Flag for review">
                                        <Button onPress={handleFlag} disableRipple variant="light" className={`dark:invert ${flagPressed ? "text-red-600" : "text-white"}`} style={{ backgroundColor: 'transparent' }} startContent={<FlagIcon />} />
                                    </Tooltip>
                                    <Button variant="solid" color="primary" onPress={handleSubmit} disabled={submitDisabled}>Submit</Button>
                                    {nextEnabled && <Button disabled={!nextEnabled} variant="solid" color="primary" onPress={handleNext}>Next</Button>}
                                </div>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            }
        </div >

    );
}