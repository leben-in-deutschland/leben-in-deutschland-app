import { ArrowLeftIcon } from "@/icons/ArrowLeftIcon";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { FlagIcon } from "@/icons/FlagIcon";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { Question } from "@/types/question";
import { User, UserQuestionProgress } from "@/types/user";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Tooltip, Image } from "@heroui/react";
import { useEffect, useState } from "react";
import { createUserStats } from "@/utils/user-mapping";
import { TranslateIcon } from "@/icons/TranslateIcon";
import { Translation } from "./models/translation";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { QuestionContext } from "./models/question-context";
import { AssistantIcon } from "@/icons/AssistantIcon";


export default function PrepareQuiz({ originalQuestions, user, prepareQuestion }:
    {
        originalQuestions: Question[],
        user: User,
        prepareQuestion: PrepareQuestionType,
    }) {
    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    const [questions, setPrepareQuestions] = useState<Question[]>(originalQuestions.filter(x => x?.num.startsWith(user.state.stateCode) || isNumeric(x?.num)));
    const [currentQuestion, setCurrentQuestion] = useState<Question>();
    const [isPreviousEnabled, setPreviousEnable] = useState<boolean>(false);
    const [optionSelected, setOptionSelected] = useState<string | null>(null);
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [nextEnabled, setNextEnabled] = useState<boolean>(false);
    const [submitDisabled, setSubmitDisabled] = useState<boolean>(true);
    const [blockAnserChange, setBlockAnsweChange] = useState<boolean>(false);
    const [flagPressed, setFlagPressed] = useState<boolean>(false);
    const [disableSkip, setDisableSkip] = useState<boolean>(false);
    const [currentAction, setCurrentAction] = useState<PrepareQuestionActions>(prepareQuestion.action);
    const router = useRouter();
    useEffect(() => {
        if (currentAction === PrepareQuestionActions.Prepare) {
            let tempQuestion: Question[] = [];
            for (let i = 0; i < questions.length; i++) {
                if (user.questionProgress.findIndex(x => x?.num === questions[i]?.num) > -1) {
                    continue;
                }
                tempQuestion.push(questions[i]);
            }
            setCurrentQuestion(tempQuestion[0]);
            setPrepareQuestions(tempQuestion);
        }
        if (prepareQuestion.action === PrepareQuestionActions.State) {
            let stateQuestion: Question[] = [];
            let current: Question[] = questions.filter(x => x?.num.startsWith(user.state.stateCode));

            //Incorrect
            let incorrectStatesQuestion = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) && !x.answeredCorrectly);
            for (let i = 0; i < incorrectStatesQuestion.length; i++) {
                let incorrectQ = current.findIndex(x => x?.num === incorrectStatesQuestion[i]?.num);
                if (incorrectQ > -1) {
                    stateQuestion.push(current[incorrectQ]);
                    current.splice(incorrectQ, 1);
                }
            }
            //Skipped
            let skippedStateQuestion = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) && x.skipped);
            let otherSkipped = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) && x.answeredCorrectly === null && !x.flagged);
            skippedStateQuestion = [...skippedStateQuestion, ...otherSkipped];
            for (let i = 0; i < skippedStateQuestion.length; i++) {
                let skippedQ = current.findIndex(x => x?.num === skippedStateQuestion[i]?.num);
                if (skippedQ > -1) {
                    stateQuestion.push(current[skippedQ]);
                    current.splice(skippedQ, 1);
                }
            }
            //Flagged
            let flaggedStateQuestion = user.questionProgress.filter(x => x?.num.startsWith(user.state.stateCode) && x.flagged);
            for (let i = 0; i < flaggedStateQuestion.length; i++) {
                let flaggedQ = current.findIndex(x => x?.num === flaggedStateQuestion[i]?.num);
                if (flaggedQ > -1) {
                    stateQuestion.push(current[flaggedQ]);
                    current.splice(flaggedQ, 1);
                }
            }
            stateQuestion.push(...current);

            setPrepareQuestions(stateQuestion);
            setCurrentQuestion(stateQuestion[0]);
        }
        if (prepareQuestion.action === PrepareQuestionActions.Skipped) {
            let tempSkipped: Question[] = [];
            let otherSkipped = user.questionProgress.filter(x => x.answeredCorrectly === null && !x.flagged);
            let skipped = user.questionProgress.filter(x => x.skipped);
            skipped = [...otherSkipped, ...skipped];
            for (let i = 0; i < skipped.length; i++) {
                let indexSkipped = questions.findIndex(x => x?.num === skipped[i]?.num);
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
                let indexSkipped = questions.findIndex(x => x?.num === skipped[i]?.num);
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
                let indexSkipped = questions.findIndex(x => x?.num === skipped[i]?.num);
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
                let indexSkipped = questions.findIndex(x => x?.num === skipped[i]?.num);
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
            let currentQuestionIndex = user.questionProgress.findIndex(x => x?.num === currentQuestion?.num);
            if (currentQuestionIndex > -1) {
                if (!user.questionProgress[currentQuestionIndex].skipped
                    && user.questionProgress[currentQuestionIndex].answerSelected !== ""
                    && user.questionProgress[currentQuestionIndex].answeredCorrectly) {
                    setShowSolution(true);
                    setNextEnabled(true);
                }
                setOptionSelected(user.questionProgress[currentQuestionIndex].answerSelected);
                if (user.questionProgress[currentQuestionIndex].answeredCorrectly) {
                    setSubmitDisabled(true);
                    setNextEnabled(true);
                }
                setFlagPressed(user.questionProgress[currentQuestionIndex].flagged);
            }
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
        let indexCurrentQuestion = questions.findIndex((e) => e?.num === currentQuestion?.num);
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
                let quesIndex = user.questionProgress.findIndex(x => x?.num === currentQuestion?.num);
                if (quesIndex > -1) {
                    const oldProgress = user.questionProgress[quesIndex];
                    const newProgress = user.questionProgress[quesIndex];
                    newProgress.skipped = true;
                    createUserStats(newProgress, oldProgress, user, "SKIP");
                } else {
                    const newProgress: UserQuestionProgress = {
                        num: currentQuestion?.num ?? "",
                        skipped: true,
                        answerSelected: "",
                        flagged: false,
                        answeredCorrectly: false,

                    };
                    user.questionProgress.push(newProgress);
                    createUserStats(newProgress, newProgress, user, "SKIP");
                }
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
                setFlagPressed(false);
            }
        }
    };

    const handleFlag = () => {
        const tempFlagData = !flagPressed;
        setFlagPressed(tempFlagData);
        if (currentQuestion?.solution !== optionSelected) {
            setNextEnabled(tempFlagData);
        }
        setDisableSkip(tempFlagData);

        let currentQuesIndex = user.questionProgress.findIndex(x => x?.num === currentQuestion?.num);

        if (currentQuesIndex > -1) {
            const oldProgress = user.questionProgress[currentQuesIndex];
            const newProgress = user.questionProgress[currentQuesIndex];
            newProgress.flagged = tempFlagData;
            user.questionProgress[currentQuesIndex] = newProgress;
            createUserStats(newProgress, oldProgress, user, "FLAG");
        } else {
            let newProgress: UserQuestionProgress = {
                num: currentQuestion?.num ?? "",
                skipped: false,
                answerSelected: null,
                flagged: tempFlagData,
                answeredCorrectly: null
            };
            user.questionProgress.push(newProgress);
            createUserStats(newProgress, newProgress, user, "FLAG");
        }
    };

    const handlePrevious = () => {
        let indexCurrentQuestion = questions.findIndex((e) => e?.num === currentQuestion?.num);
        if (indexCurrentQuestion >= 0) {
            if (indexCurrentQuestion != 0) {
                let prevIndex = indexCurrentQuestion - 1;
                let prevQuestion = questions[prevIndex];
                setCurrentQuestion(prevQuestion);
                let historyIndex = user.questionProgress.findIndex((x) => x?.num === prevQuestion?.num);
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
            let currentQuesIndex = user.questionProgress.findIndex(x => x?.num === currentQuestion?.num);
            const oldProgress = user.questionProgress[currentQuesIndex];
            let newProgress: UserQuestionProgress = {
                num: currentQuestion?.num ?? "",
                skipped: false,
                answerSelected: optionSelected,
                flagged: flagPressed,
                answeredCorrectly: optionSelected === currentQuestion?.solution
            };
            if (currentQuesIndex > -1) {
                user.questionProgress[currentQuesIndex] = newProgress;

            } else {
                user.questionProgress.push(newProgress);
            }
            createUserStats(newProgress, oldProgress, user, "SUBMIT");
        }
        else {
            toast.error("Please select an answer before submitting");
        }
    };
    const handleNext = () => {
        if (flagPressed || (nextEnabled && submitDisabled && optionSelected !== "")) {
            setShowSolution(false);
            setBlockAnsweChange(false);
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
                toast.success("You have attempted all of the questions.", {
                    style: {
                        backgroundColor: '#A9FFD8'
                    }
                });
                router.push("/dashboard");
            }
        } else {
            toast.error("Please submit you answer.");
        }
    };
    const [translateOpen, setTranslateOpen] = useState<boolean>(false);
    const openTranslate = () => {
        setTranslateOpen(true);
    };
    const closeTranslation = () => {
        setTranslateOpen(false)
    };

    const [questionContextOpen, setQuestionContext] = useState<boolean>(false);
    const openQuestionContext = () => {
        setQuestionContext(true);
    };
    const closeQuestionContext = () => {
        setQuestionContext(false)
    };
    return (
        <>
            {questionContextOpen && currentQuestion && <QuestionContext handleClose={closeQuestionContext} isModelOpen={questionContextOpen} question={currentQuestion} />}
            {translateOpen && currentQuestion && <Translation handleClose={closeTranslation} isModelOpen={translateOpen} question={currentQuestion} />}
            <div className="flex flex-col items-center gap-4 p-4">
                <div className="flex gap-4 md:gap-6">
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

                <div className="flex gap-6">
                    {currentQuestion &&
                        <Card>
                            <CardHeader className="flex flex-col">
                                {currentQuestion.category && <Chip variant="dot" color="secondary">{currentQuestion.category}</Chip>}
                                <div className="flex gap-3">
                                    <p className="font-extrabold text-xl">{currentQuestion?.num}. </p>
                                    <p className="font-bold text-xl">{currentQuestion.question}</p>
                                </div>
                            </CardHeader>
                            <CardBody>
                                <div className="grid gap-4">
                                    {currentQuestion.image !== "-" && <div hidden={!(currentQuestion.image !== "-")}>
                                        <Image src={currentQuestion.image} alt=""></Image>
                                    </div>
                                    }
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "a") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("a")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "a" ? "bg-cyan-500" : ""}`}>A</Chip>
                                                    <span className={showSolution ? "text-black" : ""}>{currentQuestion.a}</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "b") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("b")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "b" ? "bg-cyan-500" : ""}`}>B</Chip>
                                                    <span className={showSolution ? "text-black" : ""}>{currentQuestion.b}</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "c") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("c")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "c" ? "bg-cyan-500" : ""}`}>C</Chip>
                                                    <span className={showSolution ? "text-black" : ""}>{currentQuestion.c}</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                        <Card isPressable className={`${showSolution ? (currentQuestion.solution === "d") ? "bg-green-200" : "bg-red-200" : ""}`} onPress={() => handleOptionSelected("d")}>
                                            <CardBody>
                                                <div className="flex gap-3">
                                                    <Chip variant="bordered" color="primary" className={`${optionSelected === "d" ? "bg-cyan-500" : ""}`}>D</Chip>
                                                    <span className={showSolution ? "text-black" : ""}>{currentQuestion.d}</span>
                                                </div>
                                            </CardBody>
                                        </Card>
                                    </div>
                                </div>
                            </CardBody>
                            <CardFooter className="flex justify-between gap-2 md:gap-4">
                                <Tooltip content="Translate">
                                    <Button
                                        onPress={openTranslate}
                                        className="dark:invert" color="primary" variant="light" startContent={<TranslateIcon size={44} />}></Button>
                                </Tooltip>
                                <Tooltip content="More Information - AI Generated">
                                    <Button
                                        onPress={openQuestionContext}
                                        className="dark:invert" color="primary" variant="light" startContent={<AssistantIcon size={44} />}></Button>
                                </Tooltip>
                                <div className="flex justify-end gap-1 md:gap-4">
                                    <Tooltip content="Flag for review">
                                        <Button onPress={handleFlag} disableRipple variant="light" className={`dark:invert ${flagPressed ? "text-red-600" : "text-white"}`} style={{ backgroundColor: 'transparent' }} startContent={<FlagIcon />} />
                                    </Tooltip>
                                    {!nextEnabled && <Button variant="solid" color="primary" onPress={handleSubmit} disabled={submitDisabled}>Submit</Button>}
                                    {nextEnabled && <Button disabled={!nextEnabled} variant="solid" color="primary" onPress={handleNext}>Next</Button>}
                                </div>
                            </CardFooter>
                        </Card>
                    }
                </div>
            </div >
        </>
    );
}