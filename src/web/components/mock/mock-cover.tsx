"use client";

import { Button } from "@heroui/react";
import type { ExamType } from "@/types/user";
import { fmt, formatDate, type Translations } from "@/utils/i18n";
import { ANSWER_OPTIONS } from "@/utils/question-bank";
import { passMarkFor } from "@/utils/user-defaults";
import { AnswerOption } from "@/components/question/answer-option";
import { useBackButton } from "@/components/shell/use-back-button";
import { ArrowLeftIcon, PlayIcon } from "@/components/ui/icons";
import { SectionHeading, Surface } from "@/components/ui/surface";
import { EXAM_SHEET_SUBTITLE, EXAM_SHEET_TITLES, SAMPLE_QUESTION } from "./official-sheets";

type MockCoverProps = {
    examType: ExamType;
    timed: boolean;
    stateName: string;
    /** Questions in this exam; 33 unless a pool is short. */
    total: number;
    /** State questions among them; 0 without a state. */
    stateCount: number;
    t: Translations;
    language: string;
    /** Starts the clock. */
    onBegin: () => void;
    onBack: () => void;
};

function CoverRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-sm text-default-500">{label}</dt>
            <dd className="text-right font-semibold tabular text-foreground">{value}</dd>
        </div>
    );
}

/**
 * Cover and instructions of the test booklet, shown between the intro and the
 * running exam. The clock starts only when the learner presses "Begin test".
 */
export function MockCover({ examType, timed, stateName, total, stateCount, t, language, onBegin, onBack }: MockCoverProps) {
    useBackButton(onBack);
    const passMark = passMarkFor(examType);
    const today = formatDate(new Date(), language, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    return (
        <div className="flex flex-col gap-6 stagger-in">
            <Surface as="section" padding="lg" tone="tinted" aria-labelledby="exam-cover-title" className="flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{t.exam_title}</p>
                    <h1 id="exam-cover-title" lang="de" className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">
                        {EXAM_SHEET_TITLES[examType]}
                    </h1>
                    <p className="font-display text-xl font-semibold text-default-700">
                        <span lang="de">{EXAM_SHEET_SUBTITLE}</span>
                        <span className="ml-2 text-sm font-medium text-default-500">· {t.exam_cover_caption}</span>
                    </p>
                </div>
                <dl className="divide-y divide-divider border-y border-divider">
                    <CoverRow label={t.exam_cover_label_state} value={stateName} />
                    <CoverRow label={t.exam_cover_label_questions} value={String(total)} />
                    <CoverRow label={t.exam_cover_label_time} value={timed ? t.exam_fact_time_title : t.exam_timer_off} />
                    <CoverRow label={t.exam_cover_label_pass} value={fmt(t.exam_cover_pass_value, { count: passMark })} />
                    <CoverRow label={t.exam_cover_label_date} value={today} />
                </dl>
            </Surface>

            <Surface as="section" padding="lg" aria-labelledby="exam-instructions-title" className="flex flex-col gap-5">
                <SectionHeading id="exam-instructions-title" title={t.exam_cover_instructions_title} />
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-[0.9375rem] leading-relaxed text-default-700 marker:font-semibold marker:text-primary">
                    <li>{fmt(t.exam_cover_rule_questions, { total })}</li>
                    <li>{t.exam_cover_rule_mark}</li>
                    <li>{timed ? t.exam_cover_rule_time : t.exam_cover_rule_time_off}</li>
                    {stateCount > 0 ? <li>{fmt(t.exam_cover_rule_state, { count: stateCount, state: stateName })}</li> : null}
                    <li>{t.exam_submit_hint}</li>
                </ol>

                <Surface tone="sunken" padding="md" className="flex flex-col gap-4">
                    <h3 className="font-display text-base font-semibold text-foreground">{t.exam_cover_example_title}</h3>
                    <p lang="de" className="question-text font-display font-bold tracking-[-0.01em] text-foreground">
                        {SAMPLE_QUESTION.question}
                    </p>
                    <div role="group" aria-label={t.exam_cover_example_aria} className="flex flex-col gap-3">
                        {SAMPLE_QUESTION.options.map((option, index) => {
                            const marked = index === SAMPLE_QUESTION.solutionIndex;
                            return (
                                <AnswerOption
                                    key={option}
                                    letter={ANSWER_OPTIONS[index]}
                                    marker="checkbox"
                                    state={marked ? "selected" : "idle"}
                                    disabled
                                    srStatus={marked ? t.answer_selected_sr : undefined}
                                >
                                    {option}
                                </AnswerOption>
                            );
                        })}
                    </div>
                    <p className="text-sm leading-relaxed text-default-500">{t.exam_cover_example_hint}</p>
                </Surface>
            </Surface>

            <div className="flex flex-col gap-3">
                <Button
                    color="primary"
                    size="lg"
                    className="h-14 w-full font-display text-base font-semibold"
                    startContent={<PlayIcon size={20} />}
                    onPress={onBegin}
                >
                    {t.exam_begin}
                </Button>
                <Button variant="flat" size="lg" className="h-12 w-full font-semibold" startContent={<ArrowLeftIcon size={18} />} onPress={onBack}>
                    {t.common_back}
                </Button>
            </div>
        </div>
    );
}
