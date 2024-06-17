import { User } from "@/types/user";

export const getUserData = async (isAuthenticated: boolean) => {
    if (isAuthenticated) {
        const response = await fetch('/api/user');
        if (response.status === 204) {
            return null;
        }
        const user = await response.json() as User;
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
    return user;
};