export interface Question {
    num: string;
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    solution: string;
    image: string;
    translation: { [key: string]: QuestionTranslation } | null;
    category: undefined | null | "Rights & Freedoms" |
    "Education & Religion" | "Law & Governance" |
    "Democracy & Politics" | "Economy & Employment" |
    "History & Geography" | "Elections" |
    "Press Freedom" | "Assembly & Protests" |
    "Federal System" | "Constitution";
}
export interface QuestionTranslation {
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
}