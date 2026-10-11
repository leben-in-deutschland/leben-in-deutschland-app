"use client";

import { Accordion, AccordionItem } from "@heroui/react";
import { IconBadge } from "@/components/ui/icon-badge";
import { BookOpenIcon, HelpIcon, HourglassIcon, MonitorIcon, type IconComponent } from "@/components/ui/icons";
import { fmt, type Translations } from "@/utils/i18n";
import type { EvaluationSummary } from "./evaluation-summary";
import { LandingSection } from "./landing-primitives";

type FaqGroup = { key: string; icon: IconComponent; title: string; from: number; to: number };

const GROUPS: FaqGroup[] = [
    { key: "general", icon: HelpIcon, title: "faq_section_general", from: 1, to: 3 },
    { key: "test", icon: BookOpenIcon, title: "faq_section_test", from: 4, to: 11 },
    { key: "platform", icon: MonitorIcon, title: "faq_section_platform", from: 12, to: 14 },
    { key: "results", icon: HourglassIcon, title: "faq_section_results", from: 15, to: 17 },
];

function range(from: number, to: number): number[] {
    return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

/** The questions people ask, grouped; the result answers carry live BAMF numbers. */
export function FaqSection({ t, evaluation }: { t: Translations; evaluation: EvaluationSummary }) {
    const params = {
        avgWait: evaluation.avgWait,
        examDate: evaluation.examDate,
        lastSync: evaluation.lastSync,
        historyCount: evaluation.historyCount,
    };

    return (
        <LandingSection id="faq" eyebrow={t.landing_faq_eyebrow} title={t.faq_title} description={t.landing_faq_subtitle} className="mx-auto w-full max-w-3xl">
            <div className="flex flex-col gap-8">
                {GROUPS.map((group) => (
                    <div key={group.key}>
                        <div className="mb-3 flex items-center gap-3">
                            <IconBadge icon={group.icon} accent="primary" size="sm" />
                            <h3 className="font-display text-base font-semibold text-foreground sm:text-lg">{t[group.title]}</h3>
                        </div>
                        <Accordion variant="splitted" selectionMode="multiple" className="px-0" itemClasses={{ base: "shadow-card rounded-card bg-content1 px-4 ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]", title: "font-semibold text-sm sm:text-base", content: "pb-4 text-sm sm:text-[0.9375rem] text-default-600 leading-relaxed" }}>
                            {range(group.from, group.to).map((index) => (
                                <AccordionItem key={`faq-${index}`} aria-label={t[`faq_q${index}`]} title={t[`faq_q${index}`]}>
                                    {fmt(t[`faq_a${index}`], params)}
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                ))}
            </div>
        </LandingSection>
    );
}
