import type { Metadata } from "next";
import landingDe from "@/data/translations/areas/landing.de.json";

// German entry point to the privacy policy. A static export cannot redirect,
// so this route renders the /privacy-policy page, but with its own German
// title and description and a self-canonical, so search engines can index
// /datenschutz for German queries. /datenschutzrichtlinie reuses this metadata.
export const metadata: Metadata = {
    title: landingDe.privacy_title,
    description: landingDe.privacy_desc,
    alternates: { canonical: "/datenschutz" },
};

export { default } from "../privacy-policy/page";
