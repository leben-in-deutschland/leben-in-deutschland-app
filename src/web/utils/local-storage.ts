import { User } from "@/types/user";

const getLocalStorageInstance = () => {
    if (typeof window === 'undefined') {
        throw new Error('localStorage is not available in this environment');
    }
    return localStorage;
};

export const saveInlocalStorage = (user: User) => {
    let ls = getLocalStorageInstance();
    ls.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new StorageEvent('user'));
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
    ls.removeItem("user");
    window.dispatchEvent(new StorageEvent('user'));
};