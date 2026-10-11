import { Surface } from "@/components/ui/surface";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import { CalendarIcon, ClockIcon, HourglassIcon, type IconComponent } from "@/components/ui/icons";
import { fmt, type Translations } from "@/utils/i18n";
import type { EvaluationSummary } from "./evaluation-summary";
import { LandingSection } from "./landing-primitives";

const BAMF_URL = "https://www.bamf.de";

type Stat = { icon: IconComponent; accent: Accent; label: string; value: string; hint: string };

/** Which exam date the BAMF is grading right now, plus the recent waiting times. */
export function BamfEvaluation({ t, evaluation }: { t: Translations; evaluation: EvaluationSummary }) {
    const stats: Stat[] = [
        { icon: CalendarIcon, accent: "primary", label: t.eval_current_exam, value: evaluation.examDate, hint: t.eval_current_exam_desc },
        { icon: ClockIcon, accent: "secondary", label: t.eval_last_checked, value: evaluation.lastSync, hint: t.eval_last_checked_desc },
        { icon: HourglassIcon, accent: "warning", label: t.eval_avg_wait, value: `~${evaluation.avgWait} ${t.eval_days}`, hint: t.eval_avg_wait_desc },
    ];
    const longest = Math.max(1, ...evaluation.recent.map((cycle) => cycle.waitDays));

    return (
        <LandingSection id="bamf-evaluation" eyebrow={t.landing_eval_eyebrow} title={t.eval_section_title} description={t.eval_section_subtitle}>
            <dl className="grid gap-3 sm:grid-cols-3">
                {stats.map((stat) => (
                    <Surface key={stat.label} className="flex items-start gap-3">
                        <IconBadge icon={stat.icon} accent={stat.accent} />
                        <div className="min-w-0">
                            <dt className="text-sm text-default-500">{stat.label}</dt>
                            <dd className="mt-0.5 font-display text-xl font-bold tabular leading-tight text-foreground sm:text-2xl">{stat.value}</dd>
                            <dd className="mt-1 text-xs text-default-500">{stat.hint}</dd>
                        </div>
                    </Surface>
                ))}
            </dl>

            {evaluation.recent.length > 0 ? (
                <Surface className="mt-4" padding="lg">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                            <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{t.eval_timeline_title}</h3>
                            <p className="mt-0.5 text-sm text-default-500">{fmt(t.landing_eval_timeline_hint, { count: evaluation.recent.length })}</p>
                        </div>
                        <p className="text-xs text-default-500">
                            <span className="text-default-700">{t.eval_timeline_exam}</span> → <span className="text-default-700">{t.eval_timeline_result}</span>
                        </p>
                    </div>
                    <ol className="mt-4 divide-y divide-divider">
                        {evaluation.recent.map((cycle) => (
                            <li
                                key={`${cycle.examDate}-${cycle.checkedAt}`}
                                className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 py-2.5 text-sm"
                                aria-label={fmt(t.landing_eval_cycle_aria, { exam: cycle.examDate, result: cycle.checkedAt, count: cycle.waitDays })}
                            >
                                <span className="tabular font-semibold text-foreground" aria-hidden="true">
                                    {cycle.examDate}
                                </span>
                                <span className="h-2 overflow-hidden rounded-full bg-content3" aria-hidden="true">
                                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((cycle.waitDays / longest) * 100)}%` }} />
                                </span>
                                <span className="tabular text-right text-xs font-semibold text-default-600" aria-hidden="true">
                                    {cycle.checkedAt}
                                    <span className="ml-2 rounded-full bg-content2 px-2 py-0.5">{fmt(t.landing_eval_days_short, { count: cycle.waitDays })}</span>
                                </span>
                            </li>
                        ))}
                    </ol>
                    <p className="mt-4 text-xs text-default-500">
                        {t.landing_eval_source}{" "}
                        <a href={BAMF_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2">
                            bamf.de
                        </a>
                    </p>
                </Surface>
            ) : null}
        </LandingSection>
    );
}
