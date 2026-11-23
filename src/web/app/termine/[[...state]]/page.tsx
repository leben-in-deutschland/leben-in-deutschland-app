import type { Metadata } from "next";
import { statesData } from "@/data/data";
import { TermineScreen } from "@/components/termine/termine-screen";

type Params = Promise<{ state?: string[] }>;

/** Static export: the overview and one page per state, nothing else under /termine/. */
export const dynamicParams = false;

export function generateStaticParams() {
    const codes = statesData().map((state) => state.code);
    return [{ state: [] }, ...codes.map((code) => ({ state: [code.toUpperCase()] })), ...codes.map((code) => ({ state: [code.toLowerCase()] }))];
}

function stateOf(segments: string[] | undefined) {
    const code = (segments?.[0] ?? "").toUpperCase();
    return statesData().find((state) => state.code.toUpperCase() === code);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const state = stateOf((await params).state);
    const where = state ? ` in ${state.name}` : "";
    return {
        title: `Einbürgerungstest Termine${where}: freie Plätze bei Prüfstellen`,
        description: `Termine für den Einbürgerungstest und den Test „Leben in Deutschland“${where}: direkt von den Seiten der Prüfstellen, mehrmals am Tag gelesen. Kostenlos, ohne Anmeldung.`,
        alternates: { canonical: state ? `/termine/${state.code.toUpperCase()}` : "/termine" },
    };
}

export default async function TerminePage({ params }: { params: Params }) {
    const state = stateOf((await params).state);
    return <TermineScreen initialState={state?.code.toUpperCase() ?? ""} states={statesData()} />;
}
