export interface User {
    id: string;
    state: UserState;
    dailyProgress: UserDailyProgress[];
    questionProgress: UserQuestionProgress[];
    testProgress: MockTestProgress[];
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
}

export interface UserQuestionProgress {
    num: string;
    answeredCorrectly: boolean;
    skipped: boolean;
    answerSelected: string;
    flagged: boolean;
}

export interface UserState {
    stateName: string;
    stateCode: string;
    attempted: number;
    incorrect: number;
    correct: number;
}