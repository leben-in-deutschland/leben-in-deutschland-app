import { saveUserData } from "@/services/user";
import { Question } from "@/types/question";
import { User } from "@/types/user";
import { attachReactRefresh } from "next/dist/build/webpack-config";

export const createUserStats = async (user: User, correctAnswer: boolean, optionSelected: string, isAuthenticated: boolean) => {
    let today = new Date().toLocaleDateString();
    if (user.dailyProgress === undefined) {
        user.dailyProgress = [];
    }

    let todayProgressIndex = user.dailyProgress.findIndex(x => x.date === today);
    if (todayProgressIndex >= 0) {
        let temp = user.dailyProgress[todayProgressIndex];
        user.dailyProgress[todayProgressIndex] = {
            attempted: optionSelected === "" ? temp.attempted : temp.attempted + 1,
            date: temp.date,
            correct: correctAnswer ? temp.correct + 1 : temp.correct,
            incorrect: correctAnswer ? temp.incorrect + 0 : temp.incorrect + 1
        };
    } else {
        user.dailyProgress.push({
            attempted: optionSelected === "" ? 0 : 1,
            date: today,
            correct: correctAnswer ? 1 : 0,
            incorrect: correctAnswer ? 0 : 1
        });
    }
    user.overallProgress = {
        attempted: 0,
        correct: 0,
        incorrect: 0,
        mockAttempted: 0,
        mockFailed: 0,
        flagged: 0,
        skipped: 0
    };
    for (let i = 0; i < user.questionProgress.length; i++) {
        let tempData = user.questionProgress[i];
        if (tempData.flagged) {
            user.overallProgress.flagged = user.overallProgress.flagged + 1;
        }
        if (tempData.skipped) {
            user.overallProgress.skipped = user.overallProgress.skipped + 1;
        }
        if (tempData.answerSelected && tempData.answeredCorrectly) {
            user.overallProgress.correct = user.overallProgress.correct + 1;
        }
        if (tempData.answerSelected && !tempData.answeredCorrectly) {
            user.overallProgress.incorrect = user.overallProgress.incorrect + 1;
        }
        if (tempData.answerSelected) {
            user.overallProgress.attempted = user.overallProgress.attempted + 1;
        }
    }
    await saveUserData(user, isAuthenticated);
    window.dispatchEvent(new Event('user'));
};