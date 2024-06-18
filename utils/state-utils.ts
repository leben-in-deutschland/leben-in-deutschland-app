import { saveUserData } from "@/services/user";
import { PrepareQuestionActions } from "@/types/prepare-question";
import { State } from "@/types/state";
import { User } from "@/types/user";

export const saveStateChange = async (state: State, isAuthenticated: boolean) => {
    let data: User = {
        state: {
            stateCode: state.code,
            stateName: state.name,
            attempted: 0,
            incorrect: 0,
            correct: 0
        },
        dailyProgress: [],
        questionProgress: [],
        id: "",
        testProgress: [],
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