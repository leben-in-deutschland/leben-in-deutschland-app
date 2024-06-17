export interface User {
    id: string;
    state: string;
    dailyProgress: UserDailyProgress[];
    questionProgress: UserQuestionProgress[];
    overallProgress: UserOverallProgress
}

export interface UserOverallProgress {
    attempted: number
    correct: number;
    incorrect: number;
    mockAttempted: number;
    mockFailed: number;
    flagged: number;
    skipped: number;
}

export interface UserDailyProgress {
    date: string;
    correct: number;
    incorrect: number;
    attempted: number
}

export interface UserQuestionProgress {
    num: string;
    answeredCorrectly: boolean;
    skipped: boolean;
    answerSelected: string;
    flagged: boolean;
}