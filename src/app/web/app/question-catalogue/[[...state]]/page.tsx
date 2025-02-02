import { questionsData, statesData } from '@/data/data';
import { Question } from '@/types/question';
import { Card, CardBody, CardHeader, Chip, Image } from '@heroui/react';

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        { state: [] },
        ...stateData.map((state) => ({ state: [state.code.toUpperCase()] })),
    ];
}

export default async function QuestionCatalogue({
    params,
}: {
    params: Promise<{ state: string }>
}) {
    const { state } = await params
    const isNumeric = (val: string): boolean => !isNaN(Number(val));

    let questions = questionsData();
    const stateData = statesData();
    let stateName = "";
    if (!state) {
        questions = questions.filter(x => isNumeric(x.num));
    }
    else {
        questions = questions.filter(x => x.num.startsWith(state[0].toUpperCase()));
        const index = stateData.findIndex(x => x.code.toUpperCase() === state[0].toUpperCase());

        if (index > -1) {
            stateName = stateData[index].name;
        }
    }


    return (
        <div className="content-center">
            <div className="mb-10 text-center">
                <p className="font-bold text-2xl text-black dark:text-white">Question Catalogue</p>
                {stateName && <p className="text-xl text-black dark:text-white">These questions are for <span className="font-bold">{stateName}</span></p>}
            </div>
            <div className="flex flex-col gap-4">
                {questions && questions.length > 0 &&
                    questions.map((question: Question) => <Card key={question.num}>
                        <CardHeader>
                            <p className="font-bold text-xl">{question.num}. {question.question}</p>
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
}