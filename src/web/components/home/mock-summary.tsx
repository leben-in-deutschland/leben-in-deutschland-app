"use client";

import { Button, Chip } from "@heroui/react";
import type { CSSProperties } from "react";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/feedback";
import { IconBadge } from "@/components/ui/icon-badge";
import { CheckCircleIcon, ChevronRightIcon, ClipboardCheckIcon, XCircleIcon } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { MockTestProgress } from "@/types/user";
import { fmt, formatDate, type Translations } from "@/utils/i18n";
import { mockScore } from "@/utils/practice-logic";
import { EXAM_QUESTION_COUNT } from "@/utils/question-bank";
import { mockSummary, recentMocks } from "./home-logic";

type MockSummaryProps = {
    tests: MockTestProgress[];
    language: "de" | "en";
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

const SHOWN = 3;

/** The last mock exams with a link into each review, or a nudge to take the first one. */
export function MockSummary({ tests, language, t, className, style }: MockSummaryProps) {
    const recent = recentMocks(tests, SHOWN);
    const summary = mockSummary(tests);

    return (
        <Surface as="section" aria-labelledby="home-mocks-title" padding="none" className={className} style={style}>
            <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <SectionHeading
                    id="home-mocks-title"
                    title={t.home_mocks_title}
                    description={summary.total > 0 ? fmt(t.home_mocks_summary, { passed: summary.passed, total: summary.total }) : undefined}
                    action={
                        summary.total > SHOWN ? (
                            <AppLink href="/mock" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary">
                                {t.common_see_all}
                                <ChevronRightIcon size={16} aria-hidden="true" />
                            </AppLink>
                        ) : undefined
                    }
                />
            </div>

            {recent.length === 0 ? (
                <EmptyState
                    icon={ClipboardCheckIcon}
                    accent="primary"
                    title={t.home_mocks_empty_title}
                    description={fmt(t.home_mocks_empty_body, { count: EXAM_QUESTION_COUNT })}
                    action={
                        <Button as={AppLink} href="/mock" color="primary" className="h-11 px-5 font-semibold">
                            {t.home_mock_start}
                        </Button>
                    }
                    className="pb-6"
                />
            ) : (
                <>
                    <ul className="mt-2 divide-y divide-divider border-t border-divider">
                        {recent.map((test) => {
                            const score = mockScore(test);
                            const date = formatDate(test.datetime, language, { dateStyle: "medium", timeStyle: "short" });
                            return (
                                <li key={test.datetime}>
                                    <ListRow
                                        href={`/mock?review=${encodeURIComponent(test.datetime)}`}
                                        leading={<IconBadge icon={test.passed ? CheckCircleIcon : XCircleIcon} accent={test.passed ? "success" : "danger"} />}
                                        title={
                                            <>
                                                <span className="sr-only">{fmt(t.home_mock_review_aria, { date })}. </span>
                                                <span className="tabular">{fmt(t.home_mock_score, { correct: score.correct, total: score.total })}</span>
                                            </>
                                        }
                                        description={date}
                                        trailing={
                                            <span className="flex shrink-0 items-center gap-1">
                                                <Chip size="sm" variant="flat" color={test.passed ? "success" : "danger"} className="font-medium">
                                                    {test.passed ? t.passed : t.failed}
                                                </Chip>
                                                <ChevronRightIcon size={18} className="text-default-400" aria-hidden="true" />
                                            </span>
                                        }
                                    />
                                </li>
                            );
                        })}
                    </ul>
                    <div className="border-t border-divider p-4 sm:p-5">
                        <Button as={AppLink} href="/mock" color="primary" variant="flat" fullWidth className="h-12 font-semibold">
                            {t.home_mock_start}
                        </Button>
                    </div>
                </>
            )}
        </Surface>
    );
}
