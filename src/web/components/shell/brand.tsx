import clsx from "clsx";

/** The app mark: a small passport with a gold rosette. */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
            <rect x="5" y="2" width="22" height="28" rx="4.5" fill="var(--pass-cover)" />
            <rect x="5.75" y="2.75" width="20.5" height="26.5" rx="3.75" fill="none" stroke="var(--pass-foil)" strokeOpacity="0.55" strokeWidth="0.75" />
            <circle cx="16" cy="13" r="5" fill="none" stroke="var(--pass-foil)" strokeWidth="1.5" />
            <circle cx="16" cy="13" r="2.25" fill="none" stroke="var(--pass-foil)" strokeWidth="1" />
            <path d="M11 22.5h10" stroke="var(--pass-foil)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

/** Mark plus name. The short form drops the name on very small screens. */
export function BrandLockup({ compact = false, tight = false, className }: { compact?: boolean; tight?: boolean; className?: string }) {
    return (
        <span className={clsx("inline-flex items-center gap-2", className)}>
            <BrandMark />
            <span
                className={clsx(
                    "font-display text-[1.0625rem] font-semibold leading-none tracking-tight text-foreground",
                    compact && !tight && "max-[359px]:sr-only",
                    // Header with the tip button: less room, so the title shrinks and then yields on small phones.
                    tight && "whitespace-nowrap max-[419px]:text-[0.9375rem] max-[383px]:sr-only",
                )}
            >
                Leben in Deutschland
            </span>
        </span>
    );
}
