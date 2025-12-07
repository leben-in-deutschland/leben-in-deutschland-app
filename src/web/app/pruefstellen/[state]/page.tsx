import { statesData, pruefstellenData } from "@/data/data";
import { Prüfstellen } from "@/types/prüfstellen";
import { PruefstellenContent } from "@/components/pruefstellen-content";
import { Metadata, ResolvingMetadata } from "next";

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        ...stateData.map((state) => ({ state: state.code.toUpperCase() })),
        ...stateData.map((state) => ({ state: state.code.toLocaleLowerCase() })),
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
    const stateData = statesData();
    const stateRelatedData = stateData.find(x => x.code.toUpperCase() === state.toUpperCase());
    return {
        title: `Prüfstellen in ${state.toUpperCase()} - ${stateRelatedData?.name}`,
        description: `Einbürgerungstest oder Leben in Deutschland ${stateRelatedData ? `Prüfstellen in ${stateRelatedData.name}` : `Prüfstellen in ${state.toUpperCase()}`} `,
    }
}

export default async function Pruefstellen({
    params,
}: {
    params: Promise<{ state: string }>
}) {
    const { state } = await params
    const stateData = statesData();

    const stateRelatedData = stateData.find(x => x.code.toUpperCase() === state.toUpperCase());
    const stellen = pruefstellenData();
    let statePlaces: Prüfstellen[] = [];
    if (state) {
        statePlaces = stellen.filter(x => x.stateCode.toUpperCase() === state.toUpperCase()).flatMap(x => x.data);
    }

    return (
        <PruefstellenContent
            stateRelatedData={stateRelatedData}
            statePlaces={statePlaces}
            state={state}
        />
    );
}
