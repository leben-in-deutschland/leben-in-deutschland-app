"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useBackButton } from "@/components/shell/use-back-button";
import { navigateTo } from "@/utils/navigation";
import { setUiMode } from "@/utils/ui-mode";
import { useTranslations } from "@/utils/user-store";

/**
 * One-time question for learners who upgraded from version 2.0: try the new
 * design or keep the classic one. Either answer stores the choice, which
 * closes the prompt for good; Settings can change it later.
 *
 * Dismissing without an answer (Escape on the web, the Android back button,
 * which the shell forwards into an open dialog as Escape) keeps classic,
 * so the question never traps anyone.
 */
export function UiModePrompt() {
    const t = useTranslations();
    const router = useRouter();

    const keepClassic = useCallback(() => {
        setUiMode("classic");
    }, []);
    useBackButton(keepClassic);

    const tryModern = () => {
        setUiMode("modern");
        navigateTo("/dashboard", router.push);
    };

    return (
        <Modal isOpen isDismissable={false} hideCloseButton placement="center" backdrop="blur" onClose={keepClassic}>
            <ModalContent>
                <ModalHeader className="font-display text-lg">{t.ui_mode_prompt_title}</ModalHeader>
                <ModalBody>
                    <p className="text-default-600">{t.ui_mode_prompt_body}</p>
                </ModalBody>
                <ModalFooter className="flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="flat" onPress={keepClassic} className="min-h-[44px] sm:flex-1">
                        {t.ui_mode_prompt_keep}
                    </Button>
                    <Button color="primary" onPress={tryModern} className="min-h-[44px] sm:flex-1">
                        {t.ui_mode_prompt_try}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
