import clsx from "clsx";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

type SurfaceTone = "plain" | "sunken" | "outline" | "glass" | "tinted" | "raised";
type SurfacePadding = "none" | "sm" | "md" | "lg";

/** Shared look of a card: soft layered shadow plus a hairline ring instead of a hard border. */
export const CARD_RING = "ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]";
export const CARD = `rounded-card bg-content1 shadow-card ${CARD_RING}`;
/** Interactive card: lifts slightly on hover, settles on press. */
export const CARD_INTERACTIVE =
    "transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0 active:scale-[0.985] active:shadow-card";

const toneClasses: Record<SurfaceTone, string> = {
    plain: `bg-content1 shadow-card ${CARD_RING}`,
    raised: `bg-content1 shadow-raised ${CARD_RING}`,
    sunken: "bg-content2/70 ring-1 ring-inset ring-foreground/[0.04] dark:ring-white/[0.05]",
    outline: `${CARD_RING}`,
    glass: `glass shadow-card ${CARD_RING}`,
    tinted: "bg-gradient-to-br from-primary-50/90 via-content1 to-content1 shadow-card ring-1 ring-primary-500/15 dark:from-primary-50/60",
};

const paddingClasses: Record<SurfacePadding, string> = {
    none: "",
    sm: "p-4",
    md: "p-4 sm:p-5",
    lg: "p-5 sm:p-6",
};

type SurfaceProps = HTMLAttributes<HTMLElement> & {
    as?: ElementType;
    tone?: SurfaceTone;
    padding?: SurfacePadding;
};

/** A quiet container: white sheet on the grey ground (dark: lifted night). */
export function Surface({ as: Component = "div", tone = "plain", padding = "md", className, ...props }: SurfaceProps) {
    return <Component className={clsx("rounded-card", toneClasses[tone], paddingClasses[padding], className)} {...props} />;
}

type SectionHeadingProps = {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    id?: string;
    as?: "h2" | "h3";
    className?: string;
};

/** Heading for a block of content, with an optional action on the right. */
export function SectionHeading({ title, description, action, id, as: Heading = "h2", className }: SectionHeadingProps) {
    return (
        <div className={clsx("flex items-end justify-between gap-3", className)}>
            <div className="min-w-0">
                <Heading id={id} className="font-display text-[1.1875rem] font-bold leading-tight tracking-[-0.01em] text-foreground sm:text-[1.375rem]">
                    {title}
                </Heading>
                {description ? <p className="mt-0.5 text-sm text-default-500">{description}</p> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
        </div>
    );
}

type PageHeaderProps = {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    /** Small element above the title, e.g. a back link. */
    leading?: ReactNode;
    className?: string;
};

/** Top of a page: one clear title and a short sentence about the page. */
export function PageHeader({ title, description, actions, leading, className }: PageHeaderProps) {
    return (
        <header className={clsx("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
            <div className="min-w-0">
                {leading ? <div className="mb-2">{leading}</div> : null}
                <h1 className="font-display text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">{title}</h1>
                {description ? <p className="mt-1.5 max-w-2xl text-[0.9375rem] text-default-500 sm:text-base">{description}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </header>
    );
}
