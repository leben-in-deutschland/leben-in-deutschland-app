import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { getUserData } from "./user";
import { Share } from "@capacitor/share";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { saveInlocalStorage } from "@/utils/local-storage";
import { toast } from "react-toastify";
import { Capacitor } from "@capacitor/core";

export const exportData = async () => {
    const existingPermission = await Filesystem.checkPermissions();
    if (existingPermission.publicStorage === "granted") {
        const user = getUserData();
        const jsonData = JSON.stringify(user, null, 2);
        if (!Capacitor.isNativePlatform()) {
            const blob = new Blob([jsonData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "einbürgerungstest_export.json";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            return;
        }

        const writeResponse = await Filesystem.writeFile({
            path: "einbürgerungstest_export.json",
            data: jsonData,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
        });

        await Share.share({
            title: 'Export Einbürgerungstest data',
            files: [writeResponse.uri],
            dialogTitle: 'Export Einbürgerungstest data',

        });
        toast.success("Data exported successfully");
        return;
    }
    else if (existingPermission.publicStorage === "prompt" || existingPermission.publicStorage === "prompt-with-rationale") {
        await Filesystem.requestPermissions();
    }
    else if (existingPermission.publicStorage === "denied") {
        toast.error("Permission denied");
    }
};

export const importData = async () => {
    const existingPermission = await Filesystem.checkPermissions();
    if (existingPermission.publicStorage === "granted") {
        const file = await FilePicker.pickFiles({
            types: ["application/json"],
            limit: 1,
            readData: true,
        });
        if (file.files.length > 0) {
            const fileData = file.files[0].data;
            if (!fileData) {
                return;
            }
            const user = JSON.parse(atob(fileData));
            saveInlocalStorage(user);
            toast.success("Data imported successfully");
        }
    }
    else if (existingPermission.publicStorage === "prompt" || existingPermission.publicStorage === "prompt-with-rationale") {
        const resp = await FilePicker.requestPermissions();
    }
    else if (existingPermission.publicStorage === "denied") {
        toast.error("Permission denied");
    }
};