"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { AppLink } from "@/components/ui/app-link";
import { ChevronRightIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import type { User } from "@/types/user";
import { fmt, type Translations } from "@/utils/i18n";
import { getCategoryCounts } from "@/utils/question-bank";
import { modeHref } from "@/utils/study-modes";
import { topicStats } from "./session-logic";

type TopicPickerProps = {
    user: User;
    t: Translations;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Topics of the learner's catalogue with how many questions they know; each opens a topic session. */
export function TopicPicker({ user, t, isOpen, onOpenChange }: TopicPickerProps) {
    const topics = getCategoryCounts(user.state?.stateCode ?? "");
    const stats = topicStats(user);
    return (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} scrollBehavior="inside" size="lg" backdrop="blur">
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 pb-2">
                    <span className="font-display text-xl font-semibold">{t.practice_topic_picker_title}</span>
                    <span className="text-sm font-normal text-default-500">{t.practice_topic_picker_desc}</span>
                </ModalHeader>
                <ModalBody className="pb-6 pt-2">
                    <ul className="flex flex-col gap-2">
                        {topics.map(({ category, total }) => {
                            const stat = stats.get(category);
                            const known = stat?.known ?? 0;
                            const wrong = stat?.wrong ?? 0;
                            return (
                                <li key={category}>
                                    <AppLink
                                        href={modeHref("category", category)}
                                        className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-content1 px-3.5 py-3 shadow-card ring-1 ring-foreground/[0.06] transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-raised active:translate-y-0 active:bg-content2 dark:ring-white/[0.08]"
                                    >
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-semibold leading-snug text-foreground">{t[category] ?? category}</span>
                                            <span className="mt-0.5 block text-xs tabular text-default-500">
                                                {fmt(t.practice_topic_stats, { known, total, wrong })}
                                            </span>
                                            <ProgressBar
                                                value={total > 0 ? known / total : 0}
                                                size="sm"
                                                indicatorClassName="bg-success"
                                                className="mt-2"
                                                label={`${t[category] ?? category}: ${known}/${total}`}
                                            />
                                        </span>
                                        <ChevronRightIcon size={18} className="shrink-0 text-default-400" aria-hidden="true" />
                                    </AppLink>
                                </li>
                            );
                        })}
                    </ul>
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
