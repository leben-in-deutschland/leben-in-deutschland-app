import { State } from "@/types/state";

export const getStates = async () => {
    const response = await fetch('/api/state');
    const states = await response.json() as State[];
    return states;
};

export const setUserState = async (state: State) => {
    const response = await fetch('/api/state');
    const states = await response.json() as State[];
    return states;
};