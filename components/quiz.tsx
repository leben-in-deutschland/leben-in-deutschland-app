import { ArrowLeftIcon } from "@/icons/ArrowLeftIcon";
import { ArrowRightIcon } from "@/icons/ArrowRightIcon";
import { DashboardIcon } from "@/icons/DashboardIcon";
import { FlagIcon } from "@/icons/FlagIcon";
import { PrepareQuestionType } from "@/types/prepare-question";
import { Question } from "@/types/question";
import { User } from "@/types/user";
import { Button, Card, CardBody, CardFooter, CardHeader, Chip, Tooltip, Image } from "@nextui-org/react";
import { useEffect, useState } from "react";
import { Countdown } from "./countdown";
import { createUserStats } from "@/utils/user-mapping";

export default function Quiz({ questions, user, prepareQuestion, handleHomePress, isAuthenticated }:
    {
        questions: Question[],
        user: User,
        prepareQuestion: PrepareQuestionType,
        handleHomePress: any,
        isAuthenticated: boolean
    }) {
    const [currentQuestion, setCurrentQuestion] = useState<Question>(questions[0]);
    const [isPreviousEnabled, setPreviousEnable] = useState<boolean>(false);
    const [optionSelected, setOptionSelected] = useState<string>("");
    const [showSolution, setShowSolution] = useState<boolean>(false);
    const [nextEnabled, setNextEnabled] = useState<boolean>(false);
    const [submitDisabled, setSubmitDisabled] = useState<boolean>(true);
    const [blockAnserChange, setBlockAnsweChange] = useState<boolean>(false);
    const [flagPressed, setFlagPressed] = useState<boolean>(false);
    const [disableSkip, setDisableSkip] = useState<boolean>(false);
    const handleOptionSelected = (option: string) => {
        if (!blockAnserChange) {
            setSubmitDisabled(false);
            setOptionSelected(option);
        }
    };

    const nextQuestion = () => {
        let indexCurrentQuestion = questions.findIndex((e) => e.num === currentQuestion.num);
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
                    num: currentQuestion.num,
                    skipped: true,
                    answerSelected: "",
                    flagged: false,
                    answeredCorrectly: false,

                });
                createUserStats(user, optionSelected === currentQuestion.solution, optionSelected, isAuthenticated);
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
                setFlagPressed(false);
            }
        }
    };
    const handleFlag = () => {
        setFlagPressed(!flagPressed);
        setNextEnabled(!flagPressed);
        setDisableSkip(!flagPressed);
    };

    const handlePrevious = () => {
        let indexCurrentQuestion = questions.findIndex((e) => e.num === currentQuestion.num);
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
    };
    const handleNext = () => {
        if (flagPressed || (nextEnabled && submitDisabled && optionSelected !== "")) {
            user.questionProgress.push({
                num: currentQuestion.num,
                skipped: false,
                answerSelected: optionSelected,
                flagged: flagPressed,
                answeredCorrectly: optionSelected === currentQuestion.solution
            });
            setShowSolution(false);
            setBlockAnsweChange(false);
            createUserStats(user, optionSelected === currentQuestion.solution, optionSelected, isAuthenticated);
            setOptionSelected("");
            setNextEnabled(false);
            setSubmitDisabled(false);
            setFlagPressed(false);
            setDisableSkip(false);
            let newQuestion = nextQuestion();
            if (newQuestion !== null) {
                setCurrentQuestion(newQuestion);
                setPreviousEnable(true);
            }
        }
    };
    return (
        <div className="grid gap-5 w-[100%]">
            <div className="grid grid-cols-2">
                <div>
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
                            <CardFooter className="justify-end gap-4">
                                <Tooltip content="Flag for review">
                                    <Button onPress={handleFlag} disableRipple variant="light" className={`${flagPressed ? "text-red-600" : "text-white"}`} style={{ backgroundColor: 'transparent' }} startContent={<FlagIcon />} />
                                </Tooltip>
                                <Button variant="solid" color="primary" onPress={handleSubmit} disabled={submitDisabled}>Submit</Button>
                                <Button disabled={!nextEnabled} variant="solid" color="primary" onPress={handleNext}>Next</Button>
                            </CardFooter>
                        </Card>
                    </div>
                    <div>
                        <Countdown />
                    </div>
                </div>
            }
        </div >
    );
}