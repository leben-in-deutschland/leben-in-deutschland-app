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
}

export interface QuestionTranslation {
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
}