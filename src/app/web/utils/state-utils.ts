import { saveUserData } from "@/services/user";
import { State } from "@/types/state";
import { User } from "@/types/user";

export const saveStateChange = (state: State) => {
    let data: User = {
        state: {
            stateCode: state.code,
            stateName: state.name,
        },
        dailyProgress: [],
        questionProgress: [],
        id: "",
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(Date.now()),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false
    }
    let today = new Date().toDateString();
    data.dailyProgress.push({
        attempted: 0,
        date: today,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        flagged: 0
    });

    return saveUserData(data);
};