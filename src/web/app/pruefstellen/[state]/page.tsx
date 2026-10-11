import type { Metadata } from "next";
import { pruefstellenData, statesData } from "@/data/data";
import type { Prüfstellen } from "@/types/prüfstellen";
import { CentersList } from "@/components/landing/centers-list";

type Params = Promise<{ state: string }>;

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        ...stateData.map((state) => ({ state: state.code.toUpperCase() })),
        ...stateData.map((state) => ({ state: state.code.toLocaleLowerCase() })),
    ];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { state } = await params;
    const code = state.toUpperCase();
    const stateRelatedData = statesData().find((entry) => entry.code.toUpperCase() === code);
    return {
        title: `Prüfstellen in ${code} - ${stateRelatedData?.name}`,
        description: `Einbürgerungstest oder Leben in Deutschland ${stateRelatedData ? `Prüfstellen in ${stateRelatedData.name}` : `Prüfstellen in ${code}`} `,
    };
}

export default async function Pruefstellen({ params }: { params: Params }) {
    const { state } = await params;
    const code = state.toUpperCase();
    const states = statesData();
    const current = states.find((entry) => entry.code.toUpperCase() === code);
    const centers: Prüfstellen[] = pruefstellenData()
        .filter((entry) => entry.stateCode.toUpperCase() === code)
        .flatMap((entry) => entry.data);

    return <CentersList stateCode={code} stateName={current?.name ?? code} centers={centers} states={states} />;
}
