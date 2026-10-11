"use client";

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, useDisclosure } from "@heroui/react";
import { useState } from "react";
import { toast } from "react-toastify";
import type { User } from "@/types/user";
import { useAppNavigate } from "@/components/ui/app-link";
import { InlineNotice } from "@/components/ui/feedback";
import { DownloadIcon, RotateCcwIcon, UploadIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { IconBadge } from "@/components/ui/icon-badge";
import { exportData, importData, type FileMessages } from "@/services/file";
import type { Translations } from "@/utils/i18n";
import { resetProgress } from "@/utils/user-defaults";
import { updateUser, useIsNative, useTranslations } from "@/utils/user-store";
import { SettingsSection } from "./settings-shared";

/** Translated texts the file service shows in its own toasts. */
export function fileMessages(t: Translations): FileMessages {
    return {
        exported: t.settings_msg_exported,
        imported: t.settings_msg_imported,
        invalid: t.settings_msg_invalid,
        denied: t.settings_msg_denied,
        nothingToExport: t.settings_msg_nothing,
    };
}

type Busy = "export" | "import" | null;

export function DataSection({ user }: { user: User }) {
    const t = useTranslations();
    const isNative = useIsNative();
    const navigate = useAppNavigate();
    const confirm = useDisclosure();
    const [busy, setBusy] = useState<Busy>(null);
    const [storageDenied, setStorageDenied] = useState(false);
    const hasProgress = user.questionProgress.length > 0 || user.testProgress.length > 0 || user.dailyProgress.length > 0;

    const runExport = async () => {
        setBusy("export");
        try {
            const ok = await exportData(fileMessages(t));
            // The service toasts on Android itself; the browser download is silent.
            if (ok && !isNative) {
                toast.success(t.settings_msg_exported);
            }
        } catch {
            // The Android share sheet rejects when it is dismissed; nothing to report.
        } finally {
            setBusy(null);
        }
    };

    const runImport = async () => {
        setBusy("import");
        try {
            // The service validates, migrates, writes the record, and toasts the outcome.
            const result = await importData(fileMessages(t));
            setStorageDenied(result === "denied");
        } catch {
            toast.error(t.settings_msg_invalid);
        } finally {
            setBusy(null);
        }
    };

    const startOver = () => {
        updateUser((draft) => resetProgress(draft));
        confirm.onClose();
        toast.success(t.settings_start_over_done);
        navigate("/dashboard");
    };

    return (
        <SettingsSection
            id="data"
            title={t.settings_section_data}
            description={t.settings_section_data_hint}
            footer={
                storageDenied ? (
                    <InlineNotice tone="warning" title={t.settings_msg_denied}>
                        {t.settings_import_denied_help}
                    </InlineNotice>
                ) : null
            }
        >
            <ListRow
                leading={<IconBadge icon={DownloadIcon} accent="primary" />}
                title={t.settings_export}
                description={t.settings_export_hint}
                onPress={() => void runExport()}
                disabled={busy !== null}
            />
            <ListRow
                leading={<IconBadge icon={UploadIcon} />}
                title={t.settings_import}
                description={t.settings_import_hint}
                onPress={() => void runImport()}
                disabled={busy !== null}
            />
            <ListRow
                leading={<IconBadge icon={RotateCcwIcon} accent="danger" />}
                title={<span className="text-danger">{t.settings_start_over}</span>}
                description={t.settings_start_over_hint}
                onPress={confirm.onOpen}
                disabled={busy !== null}
            />

            <Modal isOpen={confirm.isOpen} onOpenChange={confirm.onOpenChange} placement="auto" size="md">
                <ModalContent>
                    {(onClose) => (
                        <>
                            <ModalHeader className="font-display text-lg">{t.settings_start_over_title}</ModalHeader>
                            <ModalBody className="space-y-3 text-[0.9375rem]">
                                <InlineNotice tone="danger">{t.settings_start_over_removes}</InlineNotice>
                                <InlineNotice tone="success">{t.settings_start_over_keeps}</InlineNotice>
                                {!hasProgress ? <p className="text-sm text-default-500">{t.settings_msg_nothing}</p> : null}
                            </ModalBody>
                            <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
                                <Button variant="flat" onPress={onClose} className="min-h-[44px] sm:flex-1">
                                    {t.common_cancel}
                                </Button>
                                <Button color="danger" onPress={startOver} className="min-h-[44px] sm:flex-1" startContent={<RotateCcwIcon size={18} />}>
                                    {t.settings_start_over_confirm}
                                </Button>
                            </ModalFooter>
                        </>
                    )}
                </ModalContent>
            </Modal>
        </SettingsSection>
    );
}
