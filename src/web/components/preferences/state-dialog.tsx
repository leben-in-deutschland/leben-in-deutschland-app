"use client";

import { Button, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import type { State } from "@/types/state";
import { useTranslations } from "@/utils/user-store";
import { StateList } from "./state-list";

type StateDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    /** Code of the learner's state, if any. */
    selectedCode?: string | null;
    /** The learner picked a state; the caller stores it and closes the dialog. */
    onSelect: (state: State) => void;
};

/**
 * The dialog in which a learner picks the state of the whole app: the list
 * of states and what the choice changes. The settings and the exam dates
 * open the same one.
 */
export function StateDialog({ isOpen, onOpenChange, selectedCode, onSelect }: StateDialogProps) {
    const t = useTranslations();
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} placement="auto" scrollBehavior="inside" size="lg" classNames={{ base: "max-h-[90dvh]", body: "pb-4" }}>
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="font-display text-lg">{t.settings_state_picker_title}</ModalHeader>
                        <ModalBody>
                            <StateList selectedCode={selectedCode} onSelect={onSelect} searchLabel={t.onboarding_state_search} emptyLabel={t.settings_state_empty} className="max-h-[65dvh]" />
                            <p className="text-xs text-default-500">{t.settings_state_hint}</p>
                            <Button variant="flat" onPress={onClose} className="min-h-[44px]">
                                {t.common_cancel}
                            </Button>
                        </ModalBody>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
}
