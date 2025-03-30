import { User } from "@/types/user";
import { readFromlocalStorage, saveInlocalStorage } from "@/utils/local-storage";

export const getUserData = () => {
    let user = readFromlocalStorage();
    if (user) {
        return user;
    }
    return null;
};

export const saveUserData = (user: User) => {
    saveInlocalStorage(user)
    return user;
};