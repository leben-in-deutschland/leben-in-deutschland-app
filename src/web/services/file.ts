import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { Capacitor } from "@capacitor/core";
import { toast } from "react-toastify";
import { User } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { migrateUser, normalizeUser } from "@/utils/user-defaults";
import { readUser, writeUser } from "@/utils/user-store";

/**
 * Backup and restore of the learner record as a JSON file.
 *
 * The file is the stored record as it is, so backups made with version 2.0
 * can be restored here and backups made here can be restored by 2.0 (which
 * ignores the fields it does not know). A restored record goes through the
 * same normalization and one-time upgrade as a record found in storage.
 */

export interface FileMessages {
    exported: string;
    imported: string;
    invalid: string;
    denied: string;
    nothingToExport: string;
}

const DEFAULT_MESSAGES: FileMessages = {
    exported: "Data exported successfully",
    imported: "Data imported successfully",
    invalid: "This file is not a valid backup",
    denied: "Permission denied",
    nothingToExport: "There is no data to export yet",
};

const EXPORT_FILE_NAME = "einbürgerungstest_export.json";

export type ImportResult = "imported" | "invalid" | "cancelled" | "denied";

/**
 * Turns the content of a backup file into a complete, upgraded learner
 * record. Returns null when the content is not a learner record.
 */
export function parseBackup(content: string, today: string = dayKey()): User | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return null;
    }
    const user = normalizeUser(parsed);
    if (!user || !user.state.stateCode) {
        return null;
    }
    return migrateUser(user, today);
}

/** Decodes the base64 content the file picker returns on Android. */
function decodeBase64(data: string): string {
    const binary = atob(data);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

function downloadInBrowser(jsonData: string): void {
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = EXPORT_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/** Resolves true when the app may read and write public storage on this platform. */
async function ensureStoragePermission(messages: FileMessages): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
        return true;
    }
    const existing = await Filesystem.checkPermissions();
    if (existing.publicStorage === "granted") {
        return true;
    }
    if (existing.publicStorage === "denied") {
        toast.error(messages.denied);
        return false;
    }
    const requested = await Filesystem.requestPermissions();
    if (requested.publicStorage === "granted") {
        return true;
    }
    toast.error(messages.denied);
    return false;
}

export const exportData = async (messages: Partial<FileMessages> = {}): Promise<boolean> => {
    const texts = { ...DEFAULT_MESSAGES, ...messages };
    const user = readUser();
    if (!user) {
        toast.info(texts.nothingToExport);
        return false;
    }
    const jsonData = JSON.stringify(user, null, 2);
    if (!Capacitor.isNativePlatform()) {
        downloadInBrowser(jsonData);
        return true;
    }
    if (!(await ensureStoragePermission(texts))) {
        return false;
    }
    const writeResponse = await Filesystem.writeFile({
        path: EXPORT_FILE_NAME,
        data: jsonData,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
    });
    await Share.share({
        title: "Export Einbürgerungstest data",
        files: [writeResponse.uri],
        dialogTitle: "Export Einbürgerungstest data",
    });
    toast.success(texts.exported);
    return true;
};

/** Reads one JSON file chosen by the learner. Null when nothing was chosen. */
async function pickBackupContent(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
        return new Promise((resolve) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "application/json,.json";
            input.onchange = () => {
                const file = input.files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }
                file.text().then(resolve, () => resolve(null));
            };
            input.oncancel = () => resolve(null);
            input.click();
        });
    }
    const picked = await FilePicker.pickFiles({ types: ["application/json"], limit: 1, readData: true });
    const data = picked.files[0]?.data;
    return data ? decodeBase64(data) : null;
}

export const importData = async (messages: Partial<FileMessages> = {}): Promise<ImportResult> => {
    const texts = { ...DEFAULT_MESSAGES, ...messages };
    if (!(await ensureStoragePermission(texts))) {
        return "denied";
    }
    const content = await pickBackupContent();
    if (content === null) {
        return "cancelled";
    }
    const user = parseBackup(content);
    if (!user) {
        toast.error(texts.invalid);
        return "invalid";
    }
    writeUser(user);
    toast.success(texts.imported);
    return "imported";
};
