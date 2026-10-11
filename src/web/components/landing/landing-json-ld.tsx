import { siteConfig } from "@/config/site";
import type { EvaluationSummary } from "./evaluation-summary";

const SITE = siteConfig.links.website;

/** The static FAQ entries; they mirror the `faq_*` texts on the page. */
const FAQ_ENTRIES: [string, string][] = [
    [
        'What is "Leben in Deutschland"?',
        '"Leben in Deutschland" (Living in Germany) is an official knowledge test administered by the German Federal Office for Migration and Refugees (BAMF). It is designed for people who hold a permanent residence permit and want to demonstrate their knowledge of German society, politics, history, and legal system.',
    ],
    [
        "What is the Einbürgerungstest?",
        "The Einbürgerungstest (naturalization test) is the official citizenship test for people who want to become German citizens. It tests knowledge of Germany's legal and social system, values, and history. Passing this test is one of the requirements for obtaining German citizenship through naturalization.",
    ],
    [
        'What is the difference between "Leben in Deutschland" and the Einbürgerungstest?',
        "Both tests use the same pool of 300 general questions plus 10 state-specific questions per federal state. The key differences are: purpose (permanent residents vs. citizenship seekers), pass threshold (15/33 for LiD vs. 17/33 for Einbürgerungstest), and legal effect (integration requirements vs. naturalization requirement).",
    ],
    [
        "How many questions are on the test?",
        "The test consists of 33 multiple-choice questions. 30 questions are drawn from a general pool of 300 questions. The remaining 3 questions are specific to the federal state (Bundesland) where you take the test.",
    ],
    [
        "How many questions do I need to answer correctly to pass?",
        'For the Einbürgerungstest, you need at least 17 out of 33 correct answers. For the "Leben in Deutschland" test, you need at least 15 out of 33 correct answers.',
    ],
    ["How long do I have to complete the test?", "You have 60 minutes to complete all 33 questions."],
    [
        "What topics are covered in the test?",
        "The questions cover Democracy & Politics, Law & Governance, History & Geography, Economy & Employment, Education & Religion, Rights & Freedoms, and state-specific questions about your Bundesland.",
    ],
    [
        "Are there state-specific questions?",
        "Yes, 3 out of 33 questions are specific to the German federal state where you are registered to take the test. Each state has 10 state-specific questions, and 3 are randomly selected.",
    ],
    [
        "Where can I take the test?",
        "The test can only be taken at authorized examination centers (Prüfstellen) designated by the BAMF, typically at adult education centers (Volkshochschulen) or other certified institutions throughout all 16 German states.",
    ],
    ["How much does the test cost?", "The test fee is 25 euros, payable when you register at your local examination center."],
    [
        "Can I retake the test if I fail?",
        "Yes, you can retake the test as many times as needed. There is no limit on attempts, but you must pay the 25 euro fee each time.",
    ],
    ["Is this platform free?", "Yes, completely free. There are no ads, no paywalls, no subscriptions, and no hidden costs. The platform is open-source."],
    [
        "Do I need to create an account?",
        "No. You can start practicing immediately without signing up. All progress is saved locally on your device and never sent to any server.",
    ],
];

function evaluationFaq({ avgWait, examDate, lastSync, historyCount }: EvaluationSummary): [string, string][] {
    return [
        [
            "When will I get my Einbürgerungstest result?",
            `The BAMF typically evaluates exam results within approximately ${avgWait} days after the exam date. Currently, the exam from ${examDate} is being evaluated (as of ${lastSync}). Waiting times may vary depending on the volume of exams.`,
        ],
        [
            "Wann bekomme ich mein Ergebnis vom Einbürgerungstest?",
            `Das BAMF wertet die Prüfungen in der Regel innerhalb von ${avgWait} Tagen nach dem Prüfungstermin aus. Aktuell wird der Prüfungstermin vom ${examDate} ausgewertet (Stand: ${lastSync}). Die Wartezeit kann je nach Prüfungsaufkommen variieren.`,
        ],
        [
            "Which exam date is the BAMF currently evaluating?",
            `The BAMF is currently evaluating results from the exam date ${examDate}. This information is automatically synced daily from the BAMF portal (last sync: ${lastSync}).`,
        ],
        [
            "Welcher Prüfungstermin wird aktuell vom BAMF ausgewertet?",
            `Das BAMF wertet aktuell die Ergebnisse des Prüfungstermins vom ${examDate} aus. Diese Information wird täglich automatisch vom BAMF-Portal abgerufen und aktualisiert (Letzte Synchronisierung: ${lastSync}).`,
        ],
        [
            "How long does the BAMF take to evaluate the Einbürgerungstest?",
            `Based on the last ${historyCount} evaluation cycles, the average waiting time between the exam date and results publication is approximately ${avgWait} days. This duration can vary depending on exam volume and time of year.`,
        ],
        [
            "Wie lange dauert die Auswertung des Einbürgerungstests?",
            `Basierend auf den letzten ${historyCount} Auswertungszyklen beträgt die durchschnittliche Wartezeit zwischen Prüfungstermin und Ergebnisveröffentlichung etwa ${avgWait} Tage. Diese Dauer kann je nach Prüfungsaufkommen und Jahreszeit schwanken.`,
        ],
    ];
}

/** Structured data for search engines: app, FAQ, breadcrumbs and the BAMF evaluation dataset. */
export function LandingJsonLd({ evaluation }: { evaluation: EvaluationSummary }) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "WebApplication",
                name: "Leben in Deutschland - Einbürgerungstest Vorbereitung",
                url: SITE,
                applicationCategory: "EducationalApplication",
                operatingSystem: "Web, Android",
                offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
                description:
                    "Free, open-source platform to prepare for the German Einbürgerungstest (citizenship test). Practice 300+ questions, take mock exams, and track your progress.",
                inLanguage: ["de", "en"],
                featureList: [
                    "300+ practice questions",
                    "Realistic 33-question mock exams with 60-minute timer",
                    "Progress tracking with visual charts",
                    "Multi-language question translations",
                    "Exam center directory for all 16 German states",
                    "No ads, no signup required",
                    "Live BAMF evaluation status tracker",
                ],
            },
            {
                "@type": "FAQPage",
                mainEntity: [...FAQ_ENTRIES, ...evaluationFaq(evaluation)].map(([name, text]) => ({
                    "@type": "Question",
                    name,
                    acceptedAnswer: { "@type": "Answer", text },
                })),
            },
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
                    { "@type": "ListItem", position: 2, name: "Dashboard", item: `${SITE}/dashboard` },
                    { "@type": "ListItem", position: 3, name: "Mock Exam", item: `${SITE}/mock` },
                    { "@type": "ListItem", position: 4, name: "Prepare", item: `${SITE}/prepare` },
                ],
            },
            {
                "@type": "Dataset",
                name: "BAMF Einbürgerungstest Evaluation Timeline",
                alternateName: "BAMF Auswertungsverlauf Einbürgerungstest",
                description: `Timeline of BAMF exam evaluation dates for the Einbürgerungstest / Leben in Deutschland test. Currently evaluating exam date ${evaluation.examDate}. Average evaluation waiting time: ~${evaluation.avgWait} days. Last synced: ${evaluation.lastSync}.`,
                url: SITE,
                license: "https://opensource.org/licenses/MIT",
                isAccessibleForFree: true,
                creator: { "@type": "Organization", name: "Leben in Deutschland", url: SITE },
                temporalCoverage: evaluation.coverage ? `${evaluation.coverage[0]}/${evaluation.coverage[1]}` : undefined,
                variableMeasured: [
                    { "@type": "PropertyValue", name: "Current exam date being evaluated", value: evaluation.examDate },
                    { "@type": "PropertyValue", name: "Average evaluation waiting time (days)", value: evaluation.avgWait, unitText: "days" },
                    { "@type": "PropertyValue", name: "Total evaluation cycles tracked", value: evaluation.historyCount },
                ],
                dateModified: evaluation.lastSyncAt,
                keywords: [
                    "BAMF",
                    "Einbürgerungstest",
                    "Ergebnis",
                    "Auswertung",
                    "Wartezeit",
                    "Leben in Deutschland",
                    "result",
                    "evaluation",
                    "waiting time",
                    "Prüfungsergebnis",
                    "citizenship test Germany",
                ],
            },
        ],
    };

    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
