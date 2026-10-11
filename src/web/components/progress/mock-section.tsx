"use client";

import { Button, Chip } from "@heroui/react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/feedback";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import { CheckCircleIcon, ClockIcon, MinusIcon, PlusIcon, XCircleIcon, type IconComponent } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { SectionHeading, Surface } from "@/components/ui/surface";
import type { User } from "@/types/user";
import { fmt, formatClock, formatDate, formatNumber } from "@/utils/i18n";
import { useAppLanguage, useTranslations } from "@/utils/user-store";
import { LinkButton } from "./link-button";
import { MOCK_TREND_LIMIT, mockHistory, mockTrend, type MockStatus } from "./progress-stats";
import { TrendChart } from "./trend-chart";

const HISTORY_PREVIEW = 10;

const STATUS_STYLE: Record<MockStatus, { icon: IconComponent; accent: Accent; chip: "success" | "danger" | "default"; key: string }> = {
    passed: { icon: CheckCircleIcon, accent: "success", chip: "success", key: "passed" },
    failed: { icon: XCircleIcon, accent: "danger", chip: "danger", key: "failed" },
    cancelled: { icon: MinusIcon, accent: "default", chip: "default", key: "cancelled" },
};

const DATE_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

type MockSectionProps = {
    user: User;
};

/** Mock exams: how the scores developed, and every exam taken. */
export function MockSection({ user }: MockSectionProps) {
    const t = useTranslations();
    const language = useAppLanguage();
    const [showAll, setShowAll] = useState(false);
    const history = useMemo(() => mockHistory(user), [user]);
    const trend = useMemo(() => mockTrend(user, MOCK_TREND_LIMIT), [user]);
    const visible = showAll ? history : history.slice(0, HISTORY_PREVIEW);
    const latest = trend.points[trend.points.length - 1];
    const questionCount = trend.points.reduce((max, point) => Math.max(max, point.total), 0) || 33;
    const dateOf = (datetime: string, options: Intl.DateTimeFormatOptions) => formatDate(datetime, language, options) || datetime;

    return (
        <Surface as="section" className="animate-rise-in" aria-labelledby="progress-mock-heading">
            <SectionHeading
                id="progress-mock-heading"
                title={t.progress_mock_title}
                description={trend.finished > 0 ? fmt(t.progress_mock_passed_of, { passed: trend.passed, count: trend.finished }) : undefined}
                action={
                    history.length > 0 ? (
                        <LinkButton href="/mock" size="sm" variant="flat">
                            {t.progress_mock_start}
                        </LinkButton>
                    ) : undefined
                }
            />
            {history.length === 0 ? (
                <EmptyState
                    icon="clipboard-check"
                    accent="primary"
                    title={t.progress_mock_empty_title}
                    description={t.progress_mock_empty_desc}
                    action={
                        <LinkButton href="/mock" variant="solid">
                            {t.progress_mock_start}
                        </LinkButton>
                    }
                />
            ) : (
                <>
                    {trend.finished > 0 && latest ? (
                        <>
                            <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                                <div className="rounded-xl bg-content2 px-3 py-2.5">
                                    <dt className="text-xs text-default-500">{t.passed}</dt>
                                    <dd className="font-display text-xl font-semibold tabular text-foreground">
                                        {trend.passed}
                                        <span className="text-sm font-medium text-default-500">/{trend.finished}</span>
                                    </dd>
                                </div>
                                <div className="rounded-xl bg-content2 px-3 py-2.5">
                                    <dt className="text-xs text-default-500">{t.progress_mock_best}</dt>
                                    <dd className="font-display text-xl font-semibold tabular text-foreground">
                                        {trend.best}
                                        <span className="text-sm font-medium text-default-500">/{questionCount}</span>
                                    </dd>
                                </div>
                                <div className="rounded-xl bg-content2 px-3 py-2.5">
                                    <dt className="text-xs text-default-500">{t.progress_mock_average}</dt>
                                    <dd className="font-display text-xl font-semibold tabular text-foreground">
                                        {trend.average === null ? "–" : formatNumber(trend.average, language, { maximumFractionDigits: 1 })}
                                        <span className="text-sm font-medium text-default-500">/{questionCount}</span>
                                    </dd>
                                </div>
                            </dl>
                            <TrendChart
                                className="mt-4"
                                points={trend.points.map((point) => ({
                                    value: point.correct,
                                    passed: point.passed,
                                    title: `${dateOf(point.datetime, DATE_TIME)}: ${fmt(t.progress_mock_score, { correct: point.correct, total: point.total })}`,
                                }))}
                                max={questionCount}
                                passMark={latest.passMark}
                                passMarkLabel={fmt(t.progress_mock_pass_mark, { count: latest.passMark })}
                                label={fmt(t.progress_mock_trend_aria, { count: trend.points.length })}
                                startLabel={dateOf(trend.points[0].datetime, DAY_MONTH)}
                                endLabel={trend.points.length > 1 ? dateOf(latest.datetime, DAY_MONTH) : undefined}
                            />
                        </>
                    ) : null}
                    <h3 className="mt-5 font-display text-base font-semibold text-foreground">{t.progress_mock_history}</h3>
                    <ul className="-mx-4 mt-1 divide-y divide-divider sm:-mx-5">
                        {visible.map(({ test, score, status, seconds }, index) => {
                            const style = STATUS_STYLE[status];
                            const date = dateOf(test.datetime, DATE_TIME);
                            return (
                                <li key={`${test.datetime}-${index}`}>
                                    <ListRow
                                        href={`/mock?review=${encodeURIComponent(test.datetime)}`}
                                        leading={<IconBadge icon={style.icon} accent={style.accent} size="sm" />}
                                        title={date}
                                        description={
                                            <>
                                                {fmt(t.progress_mock_score, { correct: score.correct, total: score.total })}
                                                {seconds > 0 ? (
                                                    <>
                                                        {" · "}
                                                        <ClockIcon size={12} className="inline-block align-[-1px]" /> {formatClock(seconds)}
                                                    </>
                                                ) : null}
                                            </>
                                        }
                                        trailing={
                                            <Chip size="sm" variant="flat" color={style.chip} className="shrink-0">
                                                {t[style.key]}
                                            </Chip>
                                        }
                                        className="sm:px-5"
                                    />
                                </li>
                            );
                        })}
                    </ul>
                    {history.length > HISTORY_PREVIEW ? (
                        <Button
                            variant="light"
                            size="sm"
                            className="mt-2 text-primary"
                            onPress={() => setShowAll((value) => !value)}
                            startContent={showAll ? <MinusIcon size={16} /> : <PlusIcon size={16} />}
                        >
                            {showAll ? t.progress_mock_show_less : fmt(t.progress_mock_show_all, { count: history.length })}
                        </Button>
                    ) : null}
                </>
            )}
        </Surface>
    );
}
