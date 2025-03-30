import { saveUserData } from "@/services/user";
import { User, UserQuestionProgress } from "@/types/user";

export const createUserStats = (
    newProgress: UserQuestionProgress,
    oldProgress: UserQuestionProgress | undefined,
    user: User,
    action: "SKIP" | "FLAG" | "SUBMIT"
) => {
    const safeOld: UserQuestionProgress = oldProgress || {
        num: newProgress.num,
        answeredCorrectly: false,
        skipped: false,
        answerSelected: null,
        flagged: false,
    };

    user.dailyProgress ||= [];
    const today = new Date().toDateString();
    let dailyStats = user.dailyProgress.find(
        (dp) => new Date(dp.date).toDateString() === today
    );
    if (!dailyStats) {
        dailyStats = { date: today, attempted: 0, correct: 0, incorrect: 0, skipped: 0, flagged: 0 };
        user.dailyProgress.push(dailyStats);
    }

    let attemptedDelta = 0,
        correctDelta = 0,
        incorrectDelta = 0,
        skippedDelta = 0,
        flaggedDelta = 0;

    switch (action) {
        case "SKIP":
            attemptedDelta = 1;
            skippedDelta = 1;
            break;
        case "FLAG":
            attemptedDelta = 1;
            flaggedDelta = newProgress.flagged ? 1 : -1;
            if (!newProgress.flagged && newProgress.answeredCorrectly === null) {
                skippedDelta = 1;
            }
            break;
        case "SUBMIT":
            if (newProgress.answeredCorrectly !== null) {
                if (newProgress.answeredCorrectly) {
                    if (!safeOld.answeredCorrectly) {
                        correctDelta = 1;
                    }
                } else {
                    if (safeOld.answeredCorrectly) {
                        correctDelta = -1;
                        incorrectDelta = 1;
                    } else {
                        incorrectDelta = 1;
                    }
                }
                attemptedDelta = 1;
            }
            break;
    }

    dailyStats.attempted = Math.max(0, dailyStats.attempted + attemptedDelta);
    dailyStats.correct = Math.max(0, dailyStats.correct + correctDelta);
    dailyStats.incorrect = Math.max(0, dailyStats.incorrect + incorrectDelta);
    dailyStats.skipped = Math.max(0, dailyStats.skipped + skippedDelta);
    dailyStats.flagged = Math.max(0, dailyStats.flagged + flaggedDelta);
    saveUserData(user);
};