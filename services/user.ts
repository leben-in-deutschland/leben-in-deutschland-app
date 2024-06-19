import { User } from "@/types/user";
import { readFromlocalStorage, saveInlocalStorage } from "@/utils/local-storage";

export const getUserData = async (isAuthenticated: boolean, skipLocal: boolean = false) => {
    if (!skipLocal) {
        let user = readFromlocalStorage();
        if (user) {
            return user;
        }
    }
    if (isAuthenticated) {
        const response = await fetch('/api/user');
        if (response.status === 204) {
            return null;
        }
        const user = await response.json() as User;
        saveInlocalStorage(user)
        return user;
    }
    return null;
};

export const saveUserData = async (user: User, isAuthenticated: boolean) => {
    if (isAuthenticated) {
        const response = await fetch('/api/user', {
            method: 'POST',
            headers: {
                'content-type': 'application/json;',
            },
            body: JSON.stringify(user),
        });
        user = await response.json() as User;
    }
    saveInlocalStorage(user)
    window.dispatchEvent(new Event('user'));
    return user;
};