import clsx from "clsx";
import type { ReactNode } from "react";

type LandingSectionProps = {
    id?: string;
    /** Small gold line above the title, e.g. "Step by step". */
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    children: ReactNode;
    className?: string;
};

/** A landing block: centred title, one short sentence, then the content. */
export function LandingSection({ id, eyebrow, title, description, children, className }: LandingSectionProps) {
    const headingId = id ? `${id}-title` : undefined;
    return (
        <section id={id} aria-labelledby={headingId} className={clsx("scroll-mt-24", className)}>
            <div className="mx-auto max-w-2xl text-center">
                {eyebrow ? <p className="pass-foil text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</p> : null}
                <h2 id={headingId} className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-foreground text-balance sm:text-3xl">
                    {title}
                </h2>
                {description ? <p className="mt-3 text-[0.9375rem] text-default-500 text-balance sm:text-base">{description}</p> : null}
            </div>
            <div className="mt-8 sm:mt-10">{children}</div>
        </section>
    );
}

/** The Google Play logo (brand mark, four coloured segments drawn in current colour). */
function PlayLogo({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.803-2.302 2.803-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302-8.635-8.635z" />
        </svg>
    );
}

const playStoreVariants = {
    /** Dark badge on a light page. */
    solid: "bg-foreground text-background hover:opacity-90",
    /** Light badge on the passport cover. */
    paper: "bg-white text-pass-deep hover:opacity-95",
    /** Translucent badge on the passport cover. */
    ghost: "bg-white/10 text-current hover:bg-white/15",
} as const;

type PlayStoreButtonProps = {
    href: string;
    /** Short line above the label, e.g. "Get it on". */
    eyebrow?: string;
    label: string;
    variant?: keyof typeof playStoreVariants;
    className?: string;
};

/** External link to the Android app, styled like a store badge. */
export function PlayStoreButton({ href, eyebrow, label, variant = "solid", className }: PlayStoreButtonProps) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
                "inline-flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2 shadow-card transition-[opacity,background-color]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                playStoreVariants[variant],
                className,
            )}
        >
            <PlayLogo className="shrink-0" />
            <span className="flex flex-col items-start leading-tight">
                {eyebrow ? <span className="text-[0.65rem] font-medium uppercase tracking-wide opacity-80">{eyebrow}</span> : null}
                <span className="text-sm font-semibold sm:text-[0.9375rem]">{label}</span>
            </span>
        </a>
    );
}

/** Five stars, the first `filled` in warning colour. */
export function StarRow({ filled, label }: { filled: number; label: string }) {
    return (
        <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
            {Array.from({ length: 5 }, (_, index) => (
                <svg
                    key={index}
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className={index < filled ? "text-warning" : "text-warning/30"}
                >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
        </span>
    );
}
