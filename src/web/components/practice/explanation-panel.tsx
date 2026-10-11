"use client";

import { Spinner } from "@heroui/react";
import { useEffect, useId, useState } from "react";
import { remark } from "remark";
import html from "remark-html";
import { InlineNotice } from "@/components/ui/feedback";
import { IconBadge } from "@/components/ui/icon-badge";
import { ChevronDownIcon, ChevronUpIcon, LightbulbIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { Translations } from "@/utils/i18n";
import { loadQuestionContext } from "@/utils/question-loader";

/** Explanation of a question as sanitized HTML, or null when there is none. */
export async function renderExplanation(num: string, language: string): Promise<string | null> {
    try {
        const markdown = await loadQuestionContext(num, language);
        if (!markdown) {
            return null;
        }
        const file = await remark().use(html).process(markdown);
        return String(file);
    } catch {
        return null;
    }
}

type ExplanationPanelProps = {
    num: string;
    language: string;
    /** Open right away (after a wrong answer). */
    defaultOpen: boolean;
    t: Translations;
};

/**
 * Collapsible explanation, loaded the first time it opens. Mount it with a
 * key per question and language so it starts fresh.
 */
export function ExplanationPanel({ num, language, defaultOpen, t }: ExplanationPanelProps) {
    const panelId = useId();
    const [open, setOpen] = useState(defaultOpen);
    // undefined: not loaded yet; null: no explanation for this question.
    const [content, setContent] = useState<string | null | undefined>(undefined);

    useEffect(() => {
        if (!open || content !== undefined) {
            return;
        }
        let cancelled = false;
        renderExplanation(num, language).then((result) => {
            if (!cancelled) {
                setContent(result);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [open, content, num, language]);

    return (
        <Surface padding="none" className="overflow-hidden animate-rise-in">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-content2"
            >
                <IconBadge icon={LightbulbIcon} accent="warning" size="sm" />
                <span className="flex-1 font-semibold text-foreground">{t.explanation}</span>
                {open ? (
                    <ChevronUpIcon size={20} className="text-default-400" aria-hidden="true" />
                ) : (
                    <ChevronDownIcon size={20} className="text-default-400" aria-hidden="true" />
                )}
            </button>
            {open ? (
                <div id={panelId} className="border-t border-divider px-4 py-4">
                    {content === undefined ? (
                        <div className="flex justify-center py-4">
                            <Spinner size="sm" color="primary" label={t.loading} />
                        </div>
                    ) : content === null ? (
                        <p className="text-sm text-default-500">{t.practice_explanation_empty}</p>
                    ) : (
                        <>
                            <div
                                className="rich-text text-[0.9375rem] text-foreground"
                                lang={language}
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                            <InlineNotice tone="warning" title={t.ai_warning_title} className="mt-4">
                                {t.ai_warning_description}
                            </InlineNotice>
                        </>
                    )}
                </div>
            ) : null}
        </Surface>
    );
}
