export interface User {
    id: string;
    state: UserState;
    dailyProgress: UserDailyProgress[];
    questionProgress: UserQuestionProgress[];
    testProgress: MockTestProgress[];
    appLanguage: string;
}

export interface MockTestProgress {
    datetime: string;
    timeTake: string;
    passed: boolean;
    cancelled: boolean;
    questions: UserQuestionProgress[];
}

export interface UserDailyProgress {
    date: string;
    correct: number;
    incorrect: number;
    attempted: number;
    skipped: number;
    flagged: number;
}

export interface UserQuestionProgress {
    num: string;
    answeredCorrectly: boolean | null;
    skipped: boolean;
    answerSelected: string | null;
    flagged: boolean;
}

export interface UserState {
    stateName: string;
    stateCode: string;
}