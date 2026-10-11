// Adapted from 2.0: thin aliases over the shared 2.1 store. `readUser()`
// returns the normalized record (every 2.1 field filled), so the classic
// "mutate then save" pattern keeps `schemaVersion`, `preferences`, `streak`,
// `reviewSchedule`, and the other new fields. Deleting the record also forgets
// the interface choice, so a new learner starts with the modern design.
import { User } from "@/types/user";
import { clearUiMode } from "@/utils/ui-mode";
import { readUser, writeUser } from "@/utils/user-store";

export const saveInlocalStorage = (user: User): void => {
    writeUser(user);
};

export const readFromlocalStorage = (): User | null => readUser();

export const deleteFromlocalStorage = (): void => {
    localStorage.removeItem("user");
    clearUiMode();
    window.dispatchEvent(new StorageEvent("user"));
};
