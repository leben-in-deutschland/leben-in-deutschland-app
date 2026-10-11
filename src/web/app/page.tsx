import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { evaluationData, statesData } from "@/data/data";
import { summarizeEvaluation } from "@/components/landing/evaluation-summary";
import { LandingJsonLd } from "@/components/landing/landing-json-ld";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
    description: siteConfig.description,
    alternates: {
        canonical: "/",
        languages: { de: "/", en: "/" },
    },
};

/**
 * Inside the Android app the exported start page must hand over to the
 * dashboard before anything renders. The Capacitor bridge defines
 * `window.Capacitor` before the page scripts run, so this check is immediate;
 * the client component repeats it once React is ready.
 */
const NATIVE_REDIRECT = `(function(){try{var c=window.Capacitor;if(c&&typeof c.isNativePlatform==="function"&&c.isNativePlatform()){window.location.replace("/dashboard.html");}}catch(e){}})();`;

export default function Home() {
    const evaluation = summarizeEvaluation(evaluationData());
    const states = statesData();

    return (
        <>
            <script dangerouslySetInnerHTML={{ __html: NATIVE_REDIRECT }} />
            <LandingJsonLd evaluation={evaluation} />
            <LandingPage evaluation={evaluation} states={states} />
        </>
    );
}
