import { Question } from "@/src/types/question";

export const getQuestions = async () => {
    const response = await fetch('/api/question');
    const questions = await response.json() as Question[];
    return questions;
};