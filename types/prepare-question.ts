export interface PrepareQuestionType {
    selected: boolean,
    action: PrepareQuestionActions
}
export enum PrepareQuestionActions {
    Skipped,
    Prepare,
    Random,
    Mock,
    Failed,
    Flagged
}