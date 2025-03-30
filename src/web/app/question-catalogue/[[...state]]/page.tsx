import { questionsData, statesData } from '@/data/data';
import { Question } from '@/types/question';
import { Card, CardBody, CardHeader, Chip, Image } from '@heroui/react';
import { Metadata, ResolvingMetadata } from 'next';

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        { state: [] },
        ...stateData.map((state) => ({ state: [state.code.toUpperCase()] })),
        ...stateData.map((state) => ({ state: [state.code.toLocaleLowerCase()] })),
    ];
}

export async function generateMetadata(
    {
        params,
    }: {
        params: Promise<{ state: string }>
    },
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { state } = await params
    if (!state) {
        return {
            title: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland`,
            description: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland, Alle 300 fragen mit antworten kostenlos`,
        }
    }
    const stateData = statesData();
    const stateRelatedData = stateData.find(x => x.code.toUpperCase() === state[0].toUpperCase());
    return {
        title: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland für  ${state[0].toUpperCase()} - ${stateRelatedData?.name}`,
        description: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland, Alle 10 fragen mit antworten kostenlos für ${stateRelatedData ? `${stateRelatedData.name}` : `${state[0].toUpperCase()}`} `,
    }
}

export default async function QuestionCatalogue({
    params,
}: {
    params: Promise<{ state: string }>,
}) {
    const { state } = await params;
    const isNumeric = (val: string): boolean => !isNaN(Number(val));
    let questions = questionsData();
    const stateData = statesData();
    let stateName = "";
    if (!state) {
        questions = questions.filter(x => isNumeric(x?.num));
    }
    else {
        questions = questions.filter(x => x?.num.startsWith(state[0].toUpperCase()));
        const index = stateData.findIndex(x => x?.code.toUpperCase() === state[0].toUpperCase());

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
}