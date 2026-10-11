// Adapted from 2.0: changing the state no longer rebuilds the record (2.0
// wiped all progress here). An existing record keeps its progress and 2.1
// fields through `changeUserState`; without a record a complete 2.1 record is
// created with `createNewUser`.
import { saveUserData, getUserData } from "@/classic/services/user";
import { State } from "@/types/state";
import { User } from "@/types/user";
import { changeUserState, createNewUser } from "@/utils/user-defaults";

export const saveStateChange = (state: State): User => {
    const current = getUserData();
    const next = current ? changeUserState(current, state) : createNewUser({ state, language: "de" });
    return saveUserData(next);
};
