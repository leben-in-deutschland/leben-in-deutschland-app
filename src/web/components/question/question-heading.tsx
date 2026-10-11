import clsx from "clsx";
import type { Question } from "@/types/question";
import type { Translations } from "@/utils/i18n";
import { normalizeCategory } from "@/utils/question-bank";

type QuestionHeadingProps = {
    question: Question;
    t: Translations;
    /** Text shown before the question number, e.g. "Question 4 of 33". */
    position?: string;
    /** id for aria-labelledby on the answer group. */
    id?: string;
    className?: string;
};

/** Question number, topic, text, and image (if the question has one). */
export function QuestionHeading({ question, t, position, id, className }: QuestionHeadingProps) {
    const category = normalizeCategory(question.category);
    const hasImage = Boolean(question.image) && question.image !== "-";
    return (
        <div className={clsx("flex flex-col gap-3", className)}>
            <div className="flex flex-wrap items-center gap-2 text-sm text-default-500">
                {position ? <span className="font-medium text-default-600">{position}</span> : null}
                <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold tabular text-primary-700">
                    {t.question_number_label ? `${t.question_number_label} ${question.num}` : question.num}
                </span>
                <span className="rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-default-600 ring-1 ring-inset ring-foreground/[0.05]">{t[category] ?? category}</span>
            </div>
            <h2 id={id} className="question-text font-display font-bold tracking-[-0.01em] text-foreground" lang="de">
                {question.question}
            </h2>
            {hasImage ? (
                // Images come from the question source and are not bundled.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={question.image}
                    alt={t.question_image_alt ?? ""}
                    loading="lazy"
                    className="max-h-72 w-auto self-start rounded-2xl bg-white object-contain p-1 shadow-card ring-1 ring-foreground/[0.06]"
                />
            ) : null}
        </div>
    );
}
