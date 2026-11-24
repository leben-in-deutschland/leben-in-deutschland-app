import type { Metadata } from "next";
import { sharePreview } from "@/config/site";
import { statesData } from "@/data/data";
import { termineRegistry } from "@/data/termine-registry";
import { TermineJsonLd } from "@/components/termine/termine-json-ld";
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
    const title = state ? `Einbürgerungstest Termine in ${state.name}: freie Plätze` : "Einbürgerungstest Termine: freie Plätze bei Prüfstellen";
    const description = `Termine für den Einbürgerungstest und den Test „Leben in Deutschland“${where}: direkt von den Seiten der Prüfstellen, mehrmals am Tag gelesen. Kostenlos, ohne Anmeldung.`;
    const path = state ? `/termine/${state.code.toUpperCase()}` : "/termine";
    return {
        // Not the layout's template: it appends the site name, which starts with "Einbürgerungstest" again.
        title: { absolute: `${title} | Leben in Deutschland` },
        description,
        alternates: { canonical: path },
        ...sharePreview({ title, description, path }),
    };
}

export default async function TerminePage({ params }: { params: Params }) {
    const state = stateOf((await params).state);
    const code = state?.code.toUpperCase() ?? "";
    const registry = termineRegistry();
    return (
        <>
            <TermineJsonLd state={state} />
            <TermineScreen initialState={code} states={statesData()} registry={code ? registry.filter((centre) => centre.state === code) : registry} registrySize={registry.length} />
        </>
    );
}
