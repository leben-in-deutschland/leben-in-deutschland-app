import { questionsData, statesData } from '@/data/data';
import { Metadata, ResolvingMetadata } from 'next';
import QuestionCatalogueContent from './question-catalogue-content';

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

    return <QuestionCatalogueContent questions={questions} stateName={stateName} />;
}
