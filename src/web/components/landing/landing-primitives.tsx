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

/** The Apple logo (brand mark drawn in current colour). */
function AppleLogo({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
            <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
    );
}

const storeBadgeVariants = {
    /** Dark badge on a light page. */
    solid: "bg-foreground text-background hover:opacity-90",
    /** Light badge on the passport cover. */
    paper: "bg-white text-pass-deep hover:opacity-95",
    /** Translucent badge on the passport cover. */
    ghost: "bg-white/10 text-current hover:bg-white/15",
} as const;

type StoreBadgeVariant = keyof typeof storeBadgeVariants;

type StoreBadgeProps = {
    /** Store page; without it the badge is a static "coming soon" marker. */
    href?: string;
    logo: ReactNode;
    /** Short line above the label, e.g. "Get it on". */
    eyebrow?: string;
    label: string;
    variant?: StoreBadgeVariant;
    className?: string;
};

/** A store badge: an external link when the store page exists, otherwise a muted, non-interactive marker. */
function StoreBadge({ href, logo, eyebrow, label, variant = "solid", className }: StoreBadgeProps) {
    const classes = clsx(
        "inline-flex min-h-[48px] items-center gap-3 rounded-xl px-4 py-2 shadow-card transition-[opacity,background-color]",
        storeBadgeVariants[variant],
        href ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" : "pointer-events-none opacity-70",
        className,
    );
    const content = (
        <>
            {logo}
            <span className="flex flex-col items-start leading-tight">
                {eyebrow ? <span className="text-[0.65rem] font-medium uppercase tracking-wide opacity-80">{eyebrow}</span> : null}
                <span className="text-sm font-semibold sm:text-[0.9375rem]">{label}</span>
            </span>
        </>
    );
    if (!href) {
        return <span className={classes}>{content}</span>;
    }
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
            {content}
        </a>
    );
}

type PlayStoreButtonProps = {
    href: string;
    eyebrow?: string;
    label: string;
    variant?: StoreBadgeVariant;
    className?: string;
};

/** External link to the Android app, styled like a store badge. */
export function PlayStoreButton({ href, eyebrow, label, variant, className }: PlayStoreButtonProps) {
    return <StoreBadge href={href} logo={<PlayLogo className="shrink-0" />} eyebrow={eyebrow} label={label} variant={variant} className={className} />;
}

type AppStoreButtonProps = {
    /** The App Store page; undefined until the iOS app is published (ADR-047). */
    href?: string;
    eyebrow?: string;
    label: string;
    variant?: StoreBadgeVariant;
    className?: string;
};

/** External link to the iOS app, or a "coming soon" marker while there is no App Store page yet. */
export function AppStoreButton({ href, eyebrow, label, variant, className }: AppStoreButtonProps) {
    return <StoreBadge href={href} logo={<AppleLogo className="shrink-0" />} eyebrow={eyebrow} label={label} variant={variant} className={className} />;
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
