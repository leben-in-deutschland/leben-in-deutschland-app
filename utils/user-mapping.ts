import { saveUserData } from "@/services/user";
import { User } from "@/types/user";

export const createUserStats = async (user: User, correctAnswer: boolean, flagged: boolean, skipped: boolean, isAuthenticated: boolean, lastQuestionNum: string) => {
    let today = new Date().toLocaleDateString();
    if (user.dailyProgress === undefined) {
        user.dailyProgress = [];
    }

    let todayProgressIndex = user.dailyProgress.findIndex(x => x.date === today);
    if (todayProgressIndex >= 0) {
        let temp = user.dailyProgress[todayProgressIndex];
        user.dailyProgress[todayProgressIndex] = {
            attempted: temp.attempted + 1,
            date: temp.date,
            correct: (!skipped && !flagged) ? (correctAnswer ? temp.correct + 1 : temp.correct) : temp.correct,
            incorrect: (!skipped && !flagged) ? (correctAnswer ? temp.incorrect + 0 : temp.incorrect + 1) : temp.incorrect,
            skipped: skipped ? temp.skipped + 1 : temp.skipped,
            flagged: flagged ? temp.flagged + 1 : temp.flagged
        };
    } else {
        user.dailyProgress.push({
            attempted: 1,
            date: today,
            correct: !flagged ? (correctAnswer ? 1 : 0) : 0,
            incorrect: !flagged ? (correctAnswer ? 0 : 1) : 0,
            skipped: skipped ? 1 : 0,
            flagged: flagged ? 1 : 0
        });
    }

    let indexOfUserProgress = user.questionProgress.findIndex(x => x.num === lastQuestionNum);
    if (indexOfUserProgress > -1) {
        let tempData = user.questionProgress[indexOfUserProgress];
        if (tempData.num.startsWith(user.state.stateCode)) {
            user.state.attempted = user.state.attempted + 1;
            if (tempData.answerSelected && tempData.answeredCorrectly) {
                user.state.correct = user.state.correct + 1;
            }
            if (tempData.answerSelected && !tempData.answeredCorrectly) {
                user.state.incorrect = user.state.incorrect + 1;
            }
        }

    }

    await saveUserData(user, isAuthenticated);
};