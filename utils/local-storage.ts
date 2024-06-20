import { User } from "@/types/user";

const getLocalStorageInstance = () => {
    while (true) {
        if (typeof window !== 'undefined') {
            break;
        }
    }
    return localStorage;
};

export const saveInlocalStorage = (user: User) => {
    let ls = getLocalStorageInstance();
    ls.setItem("user", JSON.stringify(user));
};

export const readFromlocalStorage = () => {
    let ls = getLocalStorageInstance();
    let user = ls.getItem("user");
    if (!user) {
        return null;
    }
    return JSON.parse(user) as User;
};

export const deleteFromlocalStorage = () => {
    let ls = getLocalStorageInstance();
    let user = ls.removeItem("user");
};