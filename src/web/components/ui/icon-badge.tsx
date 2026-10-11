import clsx from "clsx";
import { Icon, type IconComponent } from "./icons";

export type Accent = "primary" | "secondary" | "success" | "warning" | "danger" | "default";

/*
 * HeroUI color scales run light-to-dark in the light theme and dark-to-light
 * in the dark theme, so "bg-x-50 text-x-700" reads well in both.
 */
export const ACCENT_SOFT: Record<Accent, string> = {
    primary: "bg-gradient-to-br from-primary-50 to-primary-100 text-primary-700 ring-1 ring-inset ring-primary-500/10",
    secondary: "bg-gradient-to-br from-secondary-50 to-secondary-100 text-secondary-700 ring-1 ring-inset ring-secondary-500/15",
    success: "bg-gradient-to-br from-success-50 to-success-100 text-success-700 ring-1 ring-inset ring-success-500/10",
    warning: "bg-gradient-to-br from-warning-50 to-warning-100 text-warning-700 ring-1 ring-inset ring-warning-500/10",
    danger: "bg-gradient-to-br from-danger-50 to-danger-100 text-danger-700 ring-1 ring-inset ring-danger-500/10",
    default: "bg-gradient-to-br from-default-100 to-default-200/70 text-default-700 ring-1 ring-inset ring-foreground/[0.05]",
};

/** Faint accent wash for the background of a whole tile. */
export const ACCENT_TINT: Record<Accent, string> = {
    primary: "from-primary-50/70",
    secondary: "from-secondary-50/70",
    success: "from-success-50/70",
    warning: "from-warning-50/70",
    danger: "from-danger-50/70",
    default: "from-default-100/70",
};

export const ACCENT_TEXT: Record<Accent, string> = {
    primary: "text-primary",
    secondary: "text-secondary-600",
    success: "text-success",
    warning: "text-warning-600",
    danger: "text-danger",
    default: "text-default-600",
};

export const ACCENT_SOLID: Record<Accent, string> = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    danger: "bg-danger text-danger-foreground",
    default: "bg-default-200 text-default-800",
};

const sizeClasses = {
    sm: { box: "h-8 w-8 rounded-[10px]", icon: 16 },
    md: { box: "h-10 w-10 rounded-[13px]", icon: 20 },
    lg: { box: "h-12 w-12 rounded-2xl", icon: 24 },
    xl: { box: "h-14 w-14 rounded-[18px]", icon: 28 },
} as const;

type IconBadgeProps = {
    /** Icon component or icon name from `ICONS`. */
    icon: IconComponent | string;
    accent?: Accent;
    size?: keyof typeof sizeClasses;
    solid?: boolean;
    className?: string;
};

/** An icon on a tinted square. */
export function IconBadge({ icon, accent = "default", size = "md", solid = false, className }: IconBadgeProps) {
    const { box, icon: iconSize } = sizeClasses[size];
    const IconComp = typeof icon === "string" ? null : icon;
    return (
        <span
            className={clsx("inline-flex shrink-0 items-center justify-center", box, solid ? ACCENT_SOLID[accent] : ACCENT_SOFT[accent], className)}
            aria-hidden="true"
        >
            {IconComp ? <IconComp size={iconSize} /> : <Icon name={icon as string} size={iconSize} />}
        </span>
    );
}
