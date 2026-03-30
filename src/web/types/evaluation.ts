export interface EvaluationEntry {
    examDate: string;
    checkedAt: string;
}

export interface EvaluationData {
    examDate: string;
    lastSyncAt: string;
    history: EvaluationEntry[];
}
