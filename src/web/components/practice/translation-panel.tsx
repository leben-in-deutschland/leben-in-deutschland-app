"use client";

import { Select, SelectItem, Spinner } from "@heroui/react";
import { useEffect, useId, useState } from "react";
import { IconBadge } from "@/components/ui/icon-badge";
import { ChevronDownIcon, ChevronUpIcon, TranslateIcon } from "@/components/ui/icons";
import { Surface } from "@/components/ui/surface";
import type { QuestionTranslation } from "@/types/question";
import type { Translations } from "@/utils/i18n";
import { ANSWER_OPTIONS } from "@/utils/question-bank";
import { loadQuestionTranslation } from "@/utils/question-loader";
import { normalizeTranslationLanguage, TRANSLATION_LANGUAGES, type TranslationLanguage } from "./session-logic";

type TranslationBodyProps = {
    num: string;
    language: TranslationLanguage;
    t: Translations;
};

/** The translated question and answers in one language. Mounted with a key per language. */
function TranslationBody({ num, language, t }: TranslationBodyProps) {
    // undefined: loading; null: no translation for this question.
    const [translated, setTranslated] = useState<QuestionTranslation | null | undefined>(undefined);
    const rtl = TRANSLATION_LANGUAGES.find((entry) => entry.code === language)?.rtl ?? false;

    useEffect(() => {
        let cancelled = false;
        loadQuestionTranslation(num, language)
            .then((result) => {
                if (!cancelled) {
                    setTranslated(result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTranslated(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [num, language]);

    if (translated === undefined) {
        return (
            <div className="flex justify-center py-4">
                <Spinner size="sm" color="primary" label={t.loading} />
            </div>
        );
    }
    if (translated === null) {
        return <p className="text-sm text-default-500">{t.practice_translation_empty}</p>;
    }
    return (
        <div lang={language} dir={rtl ? "rtl" : "ltr"} className="flex flex-col gap-3">
            <p className="text-[0.9375rem] font-semibold leading-snug text-foreground">{translated.question}</p>
            <ol className="flex flex-col gap-1.5 text-sm text-default-700">
                {ANSWER_OPTIONS.map((option) => (
                    <li key={option} className="flex gap-2">
                        <span className="w-5 shrink-0 font-semibold text-default-500">{option.toUpperCase()}</span>
                        <span>{translated[option]}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}

type TranslationPanelProps = {
    num: string;
    language: TranslationLanguage;
    onLanguageChange: (language: TranslationLanguage) => void;
    t: Translations;
};

/** Collapsible translation with a language choice. Mount it with a key per question. */
export function TranslationPanel({ num, language, onLanguageChange, t }: TranslationPanelProps) {
    const panelId = useId();
    const [open, setOpen] = useState(false);

    return (
        <Surface padding="none" className="overflow-hidden animate-rise-in">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-controls={panelId}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-content2"
            >
                <IconBadge icon={TranslateIcon} accent="secondary" size="sm" />
                <span className="flex-1 font-semibold text-foreground">{t.translate}</span>
                {open ? (
                    <ChevronUpIcon size={20} className="text-default-400" aria-hidden="true" />
                ) : (
                    <ChevronDownIcon size={20} className="text-default-400" aria-hidden="true" />
                )}
            </button>
            {open ? (
                <div id={panelId} className="flex flex-col gap-4 border-t border-divider px-4 py-4">
                    <Select
                        size="sm"
                        label={t.practice_translation_language}
                        selectedKeys={[language]}
                        disallowEmptySelection
                        onSelectionChange={(keys) => {
                            const key = keys === "all" ? null : Array.from(keys)[0];
                            if (typeof key === "string") {
                                onLanguageChange(normalizeTranslationLanguage(key));
                            }
                        }}
                        className="max-w-xs"
                    >
                        {TRANSLATION_LANGUAGES.map((entry) => (
                            <SelectItem key={entry.code} textValue={entry.label} lang={entry.code}>
                                {entry.label}
                            </SelectItem>
                        ))}
                    </Select>
                    <TranslationBody key={language} num={num} language={language} t={t} />
                </div>
            ) : null}
        </Surface>
    );
}
