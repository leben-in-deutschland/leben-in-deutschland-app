"use client";

import { Button, Chip, Switch } from "@heroui/react";
import type { ExamType, MockTestProgress, User } from "@/types/user";
import { fmt, formatClock, formatDate, type Translations } from "@/utils/i18n";
import { mockScore } from "@/utils/practice-logic";
import { PASS_MARKS, passMarkFor, prefsOf } from "@/utils/user-defaults";
import { updateUser } from "@/utils/user-store";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { EmptyState } from "@/components/ui/feedback";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import {
    CheckCircleIcon,
    ClipboardCheckIcon,
    LayersIcon,
    PlayIcon,
    ShieldCheckIcon,
    TimerIcon,
    XCircleIcon,
    type IconComponent,
} from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { PageHeader, SectionHeading, Surface } from "@/components/ui/surface";
import { AppLink } from "@/components/ui/app-link";
import { durationOf, examHistorySummary, recentExams } from "./exam-logic";

type MockIntroProps = {
    user: User;
    t: Translations;
    language: string;
    onStart: (options: { examType: ExamType; timed: boolean }) => void;
};

const EXAM_TYPES: ExamType[] = ["einbuergerung", "lid"];

type FactProps = { icon: IconComponent; accent: Accent; title: string; description: string };

function Fact({ icon, accent, title, description }: FactProps) {
    return (
        <li className="flex items-start gap-3">
            <IconBadge icon={icon} accent={accent} />
            <div className="min-w-0">
                <p className="font-display text-base font-semibold leading-tight text-foreground">{title}</p>
                <p className="mt-0.5 text-sm text-default-500">{description}</p>
            </div>
        </li>
    );
}

function RecentExamRow({ test, t, language }: { test: MockTestProgress; t: Translations; language: string }) {
    const score = mockScore(test);
    return (
        <ListRow
            href={`/mock?review=${encodeURIComponent(test.datetime)}`}
            leading={<IconBadge icon={test.passed ? CheckCircleIcon : XCircleIcon} accent={test.passed ? "success" : "danger"} />}
            title={formatDate(test.datetime, language, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            description={fmt(t.exam_recent_row_desc, { score: `${score.correct} / ${score.total}`, time: formatClock(durationOf(test)) })}
            trailing={
                <Chip size="sm" variant="flat" color={test.passed ? "success" : "danger"} className="shrink-0 font-semibold">
                    {test.passed ? t.passed : t.failed}
                </Chip>
            }
        />
    );
}

/** First screen of /mock: what the exam is, the two settings, the start button, and recent results. */
export function MockIntro({ user, t, language, onStart }: MockIntroProps) {
    const prefs = prefsOf(user);
    const examType = prefs.examType;
    const timed = prefs.mockTimer;
    const passMark = passMarkFor(examType);
    const recent = recentExams(user, 5);
    const summary = examHistorySummary(user);

    const setExamType = (next: ExamType) => {
        updateUser((draft) => {
            draft.preferences = { ...prefsOf(draft), examType: next };
        });
    };

    const setTimed = (next: boolean) => {
        updateUser((draft) => {
            draft.preferences = { ...prefsOf(draft), mockTimer: next };
        });
    };

    return (
        <div className="flex flex-col gap-6 stagger-in">
            <PageHeader title={t.exam_title} description={t.exam_intro_desc} />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
                <Surface padding="lg" className="flex flex-col gap-5">
                    <ul className="flex flex-col gap-4">
                        <Fact
                            icon={LayersIcon}
                            accent="primary"
                            title={t.exam_fact_questions_title}
                            description={fmt(t.exam_fact_questions_desc, { state: user.state.stateName })}
                        />
                        <Fact icon={TimerIcon} accent="warning" title={t.exam_fact_time_title} description={t.exam_fact_time_desc} />
                        <Fact
                            icon={ShieldCheckIcon}
                            accent="success"
                            title={fmt(t.exam_fact_pass_title, { count: passMark })}
                            description={t.exam_fact_pass_desc}
                        />
                    </ul>
                </Surface>

                <Surface padding="lg" className="flex flex-col gap-5">
                    <SectionHeading as="h2" title={t.exam_settings_title} />
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium text-default-600">{t.exam_type_label}</p>
                        <ChoiceChips<ExamType>
                            label={t.exam_type_label}
                            value={examType}
                            onChange={setExamType}
                            fill
                            options={EXAM_TYPES.map((type) => ({
                                value: type,
                                label: t[`exam_type_${type}`] ?? type,
                                hint: t[`exam_type_${type}_hint`] ?? fmt(t.exam_fact_pass_title, { count: PASS_MARKS[type] }),
                            }))}
                        />
                    </div>
                    <Switch
                        isSelected={timed}
                        onValueChange={setTimed}
                        classNames={{ base: "m-0 w-full max-w-full flex-row-reverse justify-between gap-3", wrapper: "me-0", label: "ms-0 min-w-0" }}
                    >
                        <span className="block font-medium text-foreground">{t.exam_timer_label}</span>
                        <span className="block text-sm text-default-500">{timed ? t.exam_timer_desc_on : t.exam_timer_desc}</span>
                    </Switch>
                    <Button
                        color="primary"
                        size="lg"
                        className="h-14 w-full font-display text-base font-semibold"
                        startContent={<PlayIcon size={20} />}
                        onPress={() => onStart({ examType, timed })}
                    >
                        {t.exam_start}
                    </Button>
                </Surface>
            </div>

            <section className="flex flex-col gap-3" aria-labelledby="recent-exams-heading">
                <SectionHeading
                    id="recent-exams-heading"
                    title={t.exam_recent_title}
                    description={summary.total > 0 ? fmt(t.exam_recent_summary, { passed: summary.passed, total: summary.total }) : undefined}
                    action={
                        summary.total > 0 ? (
                            <AppLink href="/progress" className="text-sm font-semibold text-primary hover:underline">
                                {t.common_see_all}
                            </AppLink>
                        ) : undefined
                    }
                />
                <Surface padding="none" className="overflow-hidden">
                    {recent.length === 0 ? (
                        <EmptyState icon={ClipboardCheckIcon} accent="primary" title={t.exam_recent_empty_title} description={t.exam_recent_empty_desc} />
                    ) : (
                        <ul className="divide-y divide-divider">
                            {recent.map((test) => (
                                <li key={test.datetime}>
                                    <RecentExamRow test={test} t={t} language={language} />
                                </li>
                            ))}
                        </ul>
                    )}
                </Surface>
            </section>
        </div>
    );
}
