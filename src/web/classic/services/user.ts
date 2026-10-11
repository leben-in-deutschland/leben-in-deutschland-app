// Adapted from 2.0: reads and writes go through the shared 2.1 store
// (`@/utils/user-store`), so the record is always normalized and every
// subscriber is notified. Call sites keep the 2.0 names.
import { User } from "@/types/user";
import { readFromlocalStorage, saveInlocalStorage } from "@/classic/utils/local-storage";

export const getUserData = (): User | null => readFromlocalStorage();

export const saveUserData = (user: User): User => {
    saveInlocalStorage(user);
    return user;
};
