import { deleteFromlocalStorage } from "./local-storage";

export const deleteData = () => {
    deleteFromlocalStorage();
    window.dispatchEvent(new Event('storage'));
};