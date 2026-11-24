import { siteConfig } from "@/config/site";
import type { State } from "@/types/state";

const SITE = siteConfig.links.website;

/** Structured data for search engines: the way from the start page to this page, as breadcrumbs. */
export function TermineJsonLd({ state }: { state?: State }) {
    const trail = [
        { name: "Startseite", item: SITE },
        { name: "Prüfungstermine", item: `${SITE}/termine` },
        ...(state ? [{ name: state.name, item: `${SITE}/termine/${state.code.toUpperCase()}` }] : []),
    ];
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((entry, index) => ({ "@type": "ListItem", position: index + 1, ...entry })),
    };
    // "<" as \u003c: a name can never close the script element.
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />;
}
