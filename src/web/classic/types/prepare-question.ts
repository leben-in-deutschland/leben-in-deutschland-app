export interface PrepareQuestionType {
    selected: boolean,
    action: PrepareQuestionActions
}
export enum PrepareQuestionActions {
    Correct,
    Incorrect,
    Skipped,
    Prepare,
    Random,
    Mock,
    Failed,
    Flagged,
    State
}