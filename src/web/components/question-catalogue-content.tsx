"use client";

import { Question } from "@/types/question";
import { Card, CardBody, CardHeader, Chip, Image } from "@heroui/react";

export const QuestionCatalogueContent = ({
    questions,
    stateName,
}: {
    questions: Question[];
    stateName: string;
}) => {
    return (
        <div className="content-center">
            <div className="mb-10 text-center">
                <p className="font-bold text-2xl text-black dark:text-white">Question Catalogue</p>
                {stateName && <p className="text-xl text-black dark:text-white">These questions are for <span className="font-bold">{stateName}</span></p>}
            </div>
            <div className="flex flex-col gap-4">
                {questions && questions.length > 0 &&
                    questions.map((question: Question) => <Card key={question.num}>
                        <CardHeader className="flex flex-col md:flex-row md:justify-between">
                            <div className="md:hidden">
                                {question.category && <Chip variant="dot" color="secondary">{question.category}</Chip>}
                            </div>
                            <p className="font-bold text-xl">{question.num}. {question.question}</p>
                            <div className="hidden md:flex">
                                {question.category && <Chip variant="dot" color="secondary">{question.category}</Chip>}
                            </div>
                        </CardHeader>
                        <CardBody className="justify-center">
                            <div className="grid gap-4">
                                {question.image !== "-" && <div hidden={!(question.image !== "-")}>
                                    <Image src={question.image} alt=""></Image>
                                </div>
                                }
                                <div className="grid gap-4 md:grid-cols-2">
                                    <Card className={question.solution === "a" ? "bg-green-200 text-black" : ""}>
                                        <CardBody>
                                            <div className="flex gap-3">
                                                <Chip variant="bordered" color="primary">A</Chip>
                                                {question.a}
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <Card className={question.solution === "b" ? "bg-green-200 text-black" : ""}>
                                        <CardBody>
                                            <div className="flex gap-3">
                                                <Chip variant="bordered" color="primary">B</Chip>
                                                {question.b}
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <Card className={question.solution === "c" ? "bg-green-200 text-black" : ""}>
                                        <CardBody>
                                            <div className="flex gap-3">
                                                <Chip variant="bordered" color="primary">C</Chip>
                                                {question.c}
                                            </div>
                                        </CardBody>
                                    </Card>
                                    <Card className={question.solution === "d" ? "bg-green-200 text-black" : ""}>
                                        <CardBody>
                                            <div className="flex gap-3">
                                                <Chip variant="bordered" color="primary">D</Chip>
                                                {question.d}
                                            </div>
                                        </CardBody>
                                    </Card>
                                </div>
                            </div>
                        </CardBody>
                    </Card>)
                }
            </div>
        </div>
    );
};
