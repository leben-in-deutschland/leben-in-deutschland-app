import clsx from "clsx";

/**
 * The app mark: the same Germany map in flag colours as the app icon on the
 * stores and the favicons (`public/android-chrome-*.png` is the single source;
 * `scripts/ios-assets.mjs` derives the iOS icon from it).
 */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
    return (
        <img
            src="/android-chrome-192x192.png"
            width={size}
            height={size}
            alt=""
            aria-hidden="true"
            decoding="async"
            className={clsx("shrink-0 object-contain", className)}
            style={{ width: size, height: size }}
        />
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
