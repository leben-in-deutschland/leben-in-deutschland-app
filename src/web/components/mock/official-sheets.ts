import type { ExamType } from "@/types/user";

/*
 * The BAMF publishes one sample test sheet (Musterfragebogen) per test type.
 * The mock exam mirrors their structure: a cover with instructions, questions
 * headed "Frage 1" to "Frage 33" with a box in front of each answer, and the
 * state questions mixed in among the general ones.
 */

export interface OfficialSheet {
    /** Title as the BAMF names the download; German in every language. */
    title: string;
    /** Landing page of the PDF, opened in a new tab. */
    href: string;
}

export const OFFICIAL_SHEETS: Record<ExamType, OfficialSheet> = {
    einbuergerung: {
        title: "Musterfragebogen Einbürgerungstest",
        href: "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/musterbogen_einbuergerungstest.html",
    },
    lid: {
        title: "Musterfragebogen Test „Leben in Deutschland“",
        href: "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/musterbogen_lebenindeutschland.html",
    },
};

/** Test names as printed on the cover of the official sheets; they stay German in every language. */
export const EXAM_SHEET_TITLES: Record<ExamType, string> = {
    einbuergerung: "Einbürgerungstest",
    lid: "Test „Leben in Deutschland“",
};

/** Subtitle printed under the test name on the official cover. */
export const EXAM_SHEET_SUBTITLE = "Testfragebogen";

/** The marking example from the official instructions ("Beispiel 1 – so kreuzt man an"). */
export const SAMPLE_QUESTION = {
    question: "Wie viele Tage hat die Woche?",
    options: ["2", "5", "7", "10"] as const,
    /** Index of the pre-marked answer ("7"). */
    solutionIndex: 2,
} as const;
