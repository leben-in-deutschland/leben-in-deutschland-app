export interface Question {
    num: string;
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    solution: string;
    area_code: string;
    area: string;
    theme: string;
    image: string;
    tags: string[];
    translation: { [key: string]: QuestionTranslation } | null;
}

export interface QuestionTranslation{
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
}