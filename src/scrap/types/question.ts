export interface Question {
    num: string;
    id: string;
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    solution: string;
    image: string;
    translation: { [key: string]: QuestionTranslation } | null;
    context: string;
    category: undefined | null | "Rights & Freedoms" |
    "Education & Religion" | "Law & Governance" |
    "Democracy & Politics" | "Economy & Employment" |
    "History & Geography" | "Elections" |
    "Press Freedom" | "Assembly & Protests" |
    "Federal System" | "Constitution" |
    "General";
}
export interface QuestionTranslation {
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    context: string;
}