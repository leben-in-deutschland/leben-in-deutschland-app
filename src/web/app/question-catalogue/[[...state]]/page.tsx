import type { Metadata } from "next";
import { statesData } from "@/data/data";
import { CatalogueBrowser } from "@/components/landing/catalogue-browser";

type Params = Promise<{ state?: string[] }>;

export async function generateStaticParams() {
    const stateData = statesData();
    return [
        { state: [] },
        ...stateData.map((state) => ({ state: [state.code.toUpperCase()] })),
        ...stateData.map((state) => ({ state: [state.code.toLocaleLowerCase()] })),
    ];
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { state } = await params;
    if (!state || state.length === 0) {
        return {
            title: "Fragenkatalog Einbürgerungstest oder Leben in Deutschland",
            description: "Fragenkatalog Einbürgerungstest oder Leben in Deutschland, Alle 300 fragen mit antworten kostenlos",
        };
    }
    const code = state[0].toUpperCase();
    const stateRelatedData = statesData().find((entry) => entry.code.toUpperCase() === code);
    return {
        title: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland für  ${code} - ${stateRelatedData?.name}`,
        description: `Fragenkatalog Einbürgerungstest oder Leben in Deutschland, Alle 10 fragen mit antworten kostenlos für ${stateRelatedData ? stateRelatedData.name : code} `,
    };
}

export default async function QuestionCatalogue({ params }: { params: Params }) {
    const { state } = await params;
    const states = statesData();
    const requested = state?.[0]?.toUpperCase() ?? "";
    const current = states.find((entry) => entry.code.toUpperCase() === requested);

    return <CatalogueBrowser stateCode={current ? current.code.toUpperCase() : ""} states={states} />;
}
