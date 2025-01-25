import { deleteUserData } from "@/services/user";
import { deleteFromlocalStorage } from "./local-storage";

export const deleteData = async (isAuthenticated: boolean) => {
    if (isAuthenticated) {
        //delete from server
        deleteUserData(isAuthenticated);
    }

    deleteFromlocalStorage();
    window.dispatchEvent(new Event('user'));
};