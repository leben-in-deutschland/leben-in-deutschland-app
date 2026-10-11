"use client";

import { Button, Input } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Question } from "@/types/question";
import { categories } from "@/types/question";
import type { State } from "@/types/state";
import { AnswerOption } from "@/components/question/answer-option";
import { AppLink } from "@/components/ui/app-link";
import { ChoiceChips, type ChoiceOption } from "@/components/ui/choice-chips";
import { EmptyState } from "@/components/ui/feedback";
import { ArrowRightIcon, SearchIcon } from "@/components/ui/icons";
import { PageHeader, Surface } from "@/components/ui/surface";
import { fmt, plural, type Translations } from "@/utils/i18n";
import { ANSWER_OPTIONS, getQuestionBank, getStateQuestions, isGeneralQuestion, normalizeCategory } from "@/utils/question-bank";
import { useTranslations } from "@/utils/user-store";
import { StatePicker } from "./state-picker";

const PAGE_SIZE = 50;
const SEARCH_DELAY_MS = 250;
const ALL_TOPICS = "all";

type CatalogueBrowserProps = {
    /** Upper-case state code, or "" for the 300 general questions. */
    stateCode: string;
    states: State[];
};

function countByCategory(questions: Question[]): { category: string; total: number }[] {
    const counts = new Map<string, number>();
    for (const question of questions) {
        const category = normalizeCategory(question.category);
        counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return categories.filter((category) => counts.has(category)).map((category) => ({ category, total: counts.get(category) ?? 0 }));
}

function matches(question: Question, needle: string): boolean {
    if (!needle) {
        return true;
    }
    const haystack = [question.num, question.question, question.a, question.b, question.c, question.d].join(" ").toLowerCase();
    return haystack.includes(needle);
}

/** Search, topic filter and the paged list of questions with their right answers. */
export function CatalogueBrowser({ stateCode, states }: CatalogueBrowserProps) {
    const t = useTranslations();
    const state = states.find((entry) => entry.code.toUpperCase() === stateCode);
    const questions = useMemo(
        () => (stateCode ? getStateQuestions(stateCode) : getQuestionBank().filter((question) => isGeneralQuestion(question.num))),
        [stateCode],
    );
    const topics = useMemo(() => countByCategory(questions), [questions]);

    const [query, setQuery] = useState("");
    const [needle, setNeedle] = useState("");
    const [topic, setTopic] = useState(ALL_TOPICS);
    const [limit, setLimit] = useState(PAGE_SIZE);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timer.current) {
                clearTimeout(timer.current);
            }
        };
    }, []);

    const changeQuery = (value: string) => {
        setQuery(value);
        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
            setNeedle(value.trim().toLowerCase());
            setLimit(PAGE_SIZE);
        }, SEARCH_DELAY_MS);
    };

    const changeTopic = (value: string) => {
        setTopic(value);
        setLimit(PAGE_SIZE);
    };

    const clearFilters = () => {
        changeQuery("");
        changeTopic(ALL_TOPICS);
    };

    const filtered = useMemo(
        () => questions.filter((question) => (topic === ALL_TOPICS || normalizeCategory(question.category) === topic) && matches(question, needle)),
        [questions, topic, needle],
    );
    const visible = filtered.slice(0, limit);
    const remaining = filtered.length - visible.length;

    const topicOptions: ChoiceOption<string>[] = [
        { value: ALL_TOPICS, label: t.catalogue_all_topics, hint: questions.length },
        ...topics.map((entry) => ({ value: entry.category, label: t[entry.category] ?? entry.category, hint: entry.total })),
    ];

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={state ? fmt(t.catalogue_title_state, { state: state.name }) : t.catalogue_title}
                description={state ? fmt(t.catalogue_desc_state, { state: state.name, count: questions.length }) : fmt(t.catalogue_desc_general, { count: questions.length })}
                actions={
                    <Button as={AppLink} href="/dashboard" color="primary" className="h-11 font-semibold" endContent={<ArrowRightIcon size={16} aria-hidden="true" />}>
                        {t.catalogue_cta_button}
                    </Button>
                }
            />

            <StatePicker
                label={t.catalogue_state_picker_label}
                states={states}
                current={stateCode}
                hrefFor={(code) => (code ? `/question-catalogue/${code}` : "/question-catalogue")}
                allLabel={t.catalogue_state_general}
            />

            <Surface className="flex flex-col gap-4">
                <Input
                    type="search"
                    value={query}
                    onValueChange={changeQuery}
                    isClearable
                    onClear={() => changeQuery("")}
                    variant="bordered"
                    size="lg"
                    placeholder={t.catalogue_search_placeholder}
                    aria-label={t.catalogue_search_label}
                    startContent={<SearchIcon size={18} className="text-default-400" aria-hidden="true" />}
                    classNames={{ inputWrapper: "bg-content1" }}
                />
                <ChoiceChips options={topicOptions} value={topic} onChange={changeTopic} label={t.catalogue_topic_label} size="sm" />
                <p className="text-sm text-default-500" role="status" aria-live="polite">
                    {filtered.length === questions.length
                        ? plural(t, "common_questions", filtered.length)
                        : fmt(t.catalogue_results_of, { count: filtered.length, total: questions.length })}
                </p>
            </Surface>

            {visible.length === 0 ? (
                <EmptyState
                    icon={SearchIcon}
                    title={t.catalogue_empty_title}
                    description={t.catalogue_empty_desc}
                    action={
                        <Button variant="flat" onPress={clearFilters}>
                            {t.catalogue_clear_filters}
                        </Button>
                    }
                />
            ) : (
                <ol className="flex flex-col gap-4">
                    {visible.map((question) => (
                        <QuestionCard key={question.num} question={question} t={t} />
                    ))}
                </ol>
            )}

            {remaining > 0 ? (
                <div className="flex justify-center">
                    <Button variant="flat" color="primary" className="h-12 px-6 font-semibold" onPress={() => setLimit((value) => value + PAGE_SIZE)}>
                        {fmt(t.catalogue_show_more, { count: Math.min(PAGE_SIZE, remaining) })}
                    </Button>
                </div>
            ) : null}

            <Surface tone="sunken" padding="lg" className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="font-display text-lg font-semibold text-foreground">{t.catalogue_cta_title}</h2>
                    <p className="mt-0.5 text-sm text-default-500">{t.catalogue_cta_desc}</p>
                </div>
                <Button as={AppLink} href="/dashboard" color="primary" className="h-12 w-full shrink-0 font-semibold sm:w-auto" endContent={<ArrowRightIcon size={16} aria-hidden="true" />}>
                    {t.catalogue_cta_button}
                </Button>
            </Surface>
        </div>
    );
}

function QuestionCard({ question, t }: { question: Question; t: Translations }) {
    const category = normalizeCategory(question.category);
    return (
        <Surface as="li" id={`q-${question.num}`} className="scroll-mt-24">
            <article aria-labelledby={`q-${question.num}-text`}>
                <header className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold tabular text-primary">
                        {t.question_number_label} {question.num}
                    </span>
                    <span className="rounded-full bg-content2 px-2.5 py-1 text-xs font-medium text-default-600">{t[category] ?? category}</span>
                </header>
                <p id={`q-${question.num}-text`} className="question-text mt-2 font-display text-lg font-semibold leading-snug text-foreground">
                    {question.question}
                </p>
                {question.image && question.image !== "-" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={question.image} alt={t.question_image_alt} loading="lazy" className="mt-3 max-h-72 w-full rounded-xl bg-content2 object-contain" />
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {ANSWER_OPTIONS.map((letter) => {
                        const correct = letter === question.solution;
                        return (
                            <AnswerOption key={letter} letter={letter} state={correct ? "correct" : "dimmed"} disabled srStatus={correct ? t.answer_correct_sr : undefined}>
                                {question[letter]}
                            </AnswerOption>
                        );
                    })}
                </div>
            </article>
        </Surface>
    );
}
