import { saveUserData } from "@/services/user";
import { User } from "@/types/user";

export const saveStateChange = async (state: string, isAuthenticated: boolean) => {
    let data: User = {
        state: state,
        dailyProgress: [],
        questionProgress: [],
        id: "",
        overallProgress: {
            attempted: 0,
            correct: 0,
            incorrect: 0,
            mockAttempted: 0,
            mockFailed: 0,
            flagged: 0,
            skipped: 0
        }
    }
    let today = new Date().toLocaleDateString();
    data.dailyProgress.push({
        attempted: 0,
        date: today,
        correct: 0,
        incorrect: 0
    });
    return await saveUserData(data, isAuthenticated);
};