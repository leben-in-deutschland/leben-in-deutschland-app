import { ArrowLeftIcon } from "@/icons/ArrowLeftIcon";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { FlagIcon } from "@/icons/FlagIcon";
import { BookOpenIcon } from "@/icons/BookOpenIcon";
import { PrepareQuestionActions, PrepareQuestionType } from "@/types/prepare-question";
import { Question } from "@/types/question";
import { User, UserQuestionProgress } from "@/types/user";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Tooltip, Image, Alert } from "@heroui/react";
import { useEffect, useState } from "react";
import { createUserStats } from "@/utils/user-mapping";
import { TranslateIcon } from "@/icons/TranslateIcon";
import { Translation } from "./modals/translation";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { navigateTo } from "@/utils/navigation";
import { QuestionContext } from "./modals/question-context";
import { AssistantIcon } from "@/icons/AssistantIcon";
import { remark } from 'remark';
import html from 'remark-html';
import { loadQuestionContext } from "@/utils/question-loader";


export default function PrepareQuiz({ originalQuestions, user, prepareQuestion, translations }:
    {
        originalQuestions: Question[],
        user: User,
        prepareQuestion: PrepareQuestionType,
        translations: any
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
    const [contextHtml, setContextHtml] = useState<string | null>(null);
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
            let incorrect = user.questionProgress.filter(x => x.answeredCorrectly !== null && !x.answeredCorrectly);
            for (let i = 0; i < incorrect.length; i++) {
                let indexIncorrect = questions.findIndex(x => x?.num === incorrect[i]?.num);
                if (indexIncorrect > -1) {
                    tempIncorrect.push(questions[indexIncorrect]);
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

    useEffect(() => {
        if (showSolution && currentQuestion) {
            const lang = user.appLanguage ?? "de";
            (async () => {
                const rawContext = await loadQuestionContext(currentQuestion.num, lang);
                if (rawContext) {
                    const processed = await remark().use(html).process(rawContext);
                    setContextHtml(processed.toString());
                } else {
                    setContextHtml(null);
                }
            })();
        } else {
            setContextHtml(null);
        }
    }, [showSolution, currentQuestion, user.appLanguage]);

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
                        answerSelected: null,
                        flagged: false,
                        answeredCorrectly: null,

                    };
                    user.questionProgress.push(newProgress);
                    createUserStats(newProgress, newProgress, user, "SKIP");
                }
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
            }
        }
    };

    const handleFlag = () => {
        const tempFlagData = !flagPressed;
        setFlagPressed(tempFlagData);
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
                        if (user.questionProgress[historyIndex].answerSelected !== "" &&
                            user.questionProgress[historyIndex].answerSelected !== null) {
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
            toast.error(translations.prepare_alert_answer_submit);
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
                toast.success(translations.prepare_alert_attempted_all);
                navigateTo("/dashboard", router.push);
            }
        } else {
            toast.error(translations.prepare_alert_submit);
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
            {questionContextOpen && currentQuestion && <QuestionContext translation={translations} handleClose={closeQuestionContext} isModelOpen={questionContextOpen} question={currentQuestion} />}
            {translateOpen && currentQuestion && <Translation handleClose={closeTranslation} isModelOpen={translateOpen} question={currentQuestion} />}
            <div className="flex flex-col items-center gap-4 p-4">
                <div className="flex gap-4 md:gap-6">
                    <Button startContent={<ArrowLeftIcon />}
                        disabled={!isPreviousEnabled}
                        variant="solid"
                        onPress={handlePrevious}
                        className="font-bold"
                        color="secondary"
                    > {translations.previous}</Button>


                    <Button endContent={<ArrowRightIcon />}
                        disabled={!disableSkip}
                        variant="solid"
                        onPress={handleSkip}
                        className="font-bold"
                        color="secondary"
                    > {translations.skip}</Button>
                </div>

                <div className="flex gap-6">
                    {currentQuestion ?
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
                                        <Image src={currentQuestion.image} alt="" className="rounded-xl"></Image>
                                    </div>
                                    }
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {(["a", "b", "c", "d"] as const).map((option) => {
                                            const isCorrect = currentQuestion.solution === option;
                                            const isSelected = optionSelected === option;
                                            return (
                                                <Card
                                                    key={option}
                                                    isPressable
                                                    onPress={() => handleOptionSelected(option)}
                                                    className={`transition-all duration-200 ${showSolution
                                                        ? isCorrect
                                                            ? "bg-success/10 dark:bg-success/20 ring-1 ring-success/30"
                                                            : "bg-danger/10 dark:bg-danger/20 ring-1 ring-danger/30"
                                                        : ""
                                                        } ${!showSolution && isSelected ? "bg-primary/20 dark:bg-primary/30 ring-2 ring-primary" : ""}`}
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
                                                            <span className="text-foreground text-sm md:text-base">{currentQuestion[option]}</span>
                                                        </div>
                                                    </CardBody>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                    {showSolution && contextHtml && (
                                        <div className="explanation-reveal mt-2">
                                            <Card className="bg-primary/5 dark:bg-primary/10 shadow-none border border-divider">
                                                <CardBody className="gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-primary/10 dark:bg-primary/20 rounded-lg p-1.5 text-primary">
                                                            <BookOpenIcon size={16} />
                                                        </div>
                                                        <span className="font-semibold text-sm text-foreground">{translations.explanation ?? "Explanation"}</span>
                                                    </div>
                                                    <div
                                                        className="text-foreground/80 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                                        dangerouslySetInnerHTML={{ __html: contextHtml }}
                                                    />
                                                    <Alert
                                                        description={translations.ai_warning_description}
                                                        title={translations.ai_warning_title}
                                                        color="warning"
                                                        variant="bordered"
                                                        className="text-xs"
                                                    />
                                                </CardBody>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            </CardBody>
                            <CardFooter className="flex justify-between gap-2 md:gap-4">
                                <Tooltip content={translations.translate ?? "Translate"}>
                                    <Button
                                        onPress={openTranslate}
                                        aria-label={translations.translate ?? "Translate"}
                                        className="text-foreground" color="primary" variant="light" startContent={<TranslateIcon size={44} />}></Button>
                                </Tooltip>
                                <Tooltip content={translations.more_info_ai ?? "More Information - AI Generated"}>
                                    <Button
                                        onPress={openQuestionContext}
                                        aria-label={translations.more_info_ai ?? "More Information - AI Generated"}
                                        className="text-foreground" color="primary" variant="light" startContent={<AssistantIcon size={44} />}></Button>
                                </Tooltip>
                                <div className="flex justify-end gap-1 md:gap-4">
                                    <Tooltip content={translations.flag_for_review ?? "Flag for review"}>
                                        <Button onPress={handleFlag} disableRipple variant="light" aria-label={translations.flag_for_review ?? "Flag for review"} className={`${flagPressed ? "text-danger" : "text-foreground"}`} startContent={<FlagIcon />} />
                                    </Tooltip>
                                    {!nextEnabled && <Button variant="solid" color="primary" onPress={handleSubmit} disabled={submitDisabled}>{translations.submit}</Button>}
                                    {nextEnabled && <Button disabled={!nextEnabled} variant="solid" color="primary" onPress={handleNext}>{translations.next}</Button>}
                                </div>
                            </CardFooter>
                        </Card> :
                        <div className="flex flex-col gap-4">
                            <p> {translations.prepare_alert_attempted_all}</p>
                            <p> {translations.prepare_alert_attempted_all_next_step_1}</p>
                            <p> {translations.prepare_alert_attempted_all_next_step_2}</p>
                        </div>
                    }
                </div>
            </div >
        </>
    );
}