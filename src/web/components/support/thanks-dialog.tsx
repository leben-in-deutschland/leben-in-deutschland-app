"use client";

import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useEffect, useState } from "react";
import { useAppNavigate } from "@/components/ui/app-link";
import { IconBadge } from "@/components/ui/icon-badge";
import { HeartIcon } from "@/components/ui/icons";
import type { User } from "@/types/user";
import type { Translations } from "@/utils/i18n";
import { thanksAllowed, thanksReason } from "@/utils/support-nudge";
import { readAsk, readSupport, recordAsk } from "@/utils/support-store";
import { useTipJarAvailable } from "./use-tip-jar";

/** Home is on screen for a moment before the dialog opens. */
export const THANKS_DIALOG_DELAY_MS = 3000;

type ThanksDialogProps = {
    user: User;
    /** Days in the current streak (see `computeStreak`). */
    streakCurrent: number;
    t: Translations;
    delayMs?: number;
};

/**
 * One-time popup that invites a learner to the tip jar after a real success:
 * a passed mock exam or a seven-day streak (PLAN-012). Only in the Android
 * and iOS apps, only while the owner switch is on and the store knows the products,
 * never after a tip. Every way of closing it counts as "not now": the dialog
 * waits 30 days and gives up after the second time. It yields to any other
 * dialog that is already open.
 */
export function ThanksDialog({ user, streakCurrent, t, delayMs = THANKS_DIALOG_DELAY_MS }: ThanksDialogProps) {
    const navigate = useAppNavigate();
    const reason = thanksReason(user, streakCurrent);
    // Read once per mount so the dialog cannot reopen while the learner looks at Home.
    const [allowed] = useState(() => thanksAllowed(readSupport(), readAsk(), new Date()));
    const available = useTipJarAvailable(reason !== null && allowed);
    const [open, setOpen] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!available || done) {
            return;
        }
        const timer = window.setTimeout(() => {
            if (!document.querySelector('[role="dialog"]')) {
                setOpen(true);
            }
        }, delayMs);
        return () => window.clearTimeout(timer);
    }, [available, done, delayMs]);

    if (!available || done || reason === null) {
        return null;
    }

    const close = () => {
        recordAsk();
        setOpen(false);
        setDone(true);
    };

    const tip = () => {
        close();
        navigate("/settings#support");
    };

    return (
        <Modal isOpen={open} onClose={close} placement="center" hideCloseButton>
            <ModalContent>
                <ModalHeader className="flex items-start gap-3 font-display text-lg">
                    <IconBadge icon={HeartIcon} accent="danger" />
                    <span className="pt-1.5">{reason === "mock" ? t.home_thanks_title_mock : t.home_thanks_title_streak}</span>
                </ModalHeader>
                <ModalBody>
                    <p className="text-default-600">{t.home_thanks_body}</p>
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={close}>
                        {t.home_thanks_later}
                    </Button>
                    <Button color="primary" onPress={tip}>
                        {t.home_thanks_tip}
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
