import clsx from "clsx";
import type { ReactNode } from "react";
import { IconBadge, type Accent } from "./icon-badge";
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, XCircleIcon, type IconComponent } from "./icons";

type EmptyStateProps = {
    icon: IconComponent | string;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    accent?: Accent;
    className?: string;
};

/** Shown when a list or mode has nothing in it; always offers a next step. */
export function EmptyState({ icon, title, description, action, accent = "default", className }: EmptyStateProps) {
    return (
        <div className={clsx("flex flex-col items-center gap-3 px-4 py-10 text-center", className)}>
            <IconBadge icon={icon} accent={accent} size="lg" />
            <div className="max-w-sm">
                <p className="font-display text-lg font-semibold text-foreground">{title}</p>
                {description ? <p className="mt-1 text-sm text-default-500">{description}</p> : null}
            </div>
            {action ? <div className="mt-1">{action}</div> : null}
        </div>
    );
}

type NoticeTone = "info" | "success" | "warning" | "danger";

const noticeStyles: Record<NoticeTone, { box: string; icon: IconComponent; iconClass: string }> = {
    info: { box: "bg-default-100 text-default-700", icon: InfoIcon, iconClass: "text-default-500" },
    success: { box: "bg-success-50 text-success-800", icon: CheckCircleIcon, iconClass: "text-success-600" },
    warning: { box: "bg-warning-50 text-warning-800", icon: AlertTriangleIcon, iconClass: "text-warning-600" },
    danger: { box: "bg-danger-50 text-danger-800", icon: XCircleIcon, iconClass: "text-danger-600" },
};

type InlineNoticeProps = {
    tone?: NoticeTone;
    title?: ReactNode;
    children?: ReactNode;
    action?: ReactNode;
    className?: string;
};

/** A short message inside a page, e.g. a disclaimer or a blocked permission. */
export function InlineNotice({ tone = "info", title, children, action, className }: InlineNoticeProps) {
    const style = noticeStyles[tone];
    const NoticeIcon = style.icon;
    return (
        <div className={clsx("flex gap-3 rounded-xl px-4 py-3 text-sm", style.box, className)} role={tone === "danger" ? "alert" : undefined}>
            <NoticeIcon size={18} className={clsx("mt-0.5 shrink-0", style.iconClass)} />
            <div className="min-w-0 flex-1">
                {title ? <p className="font-semibold">{title}</p> : null}
                {children ? <div className={clsx(title && "mt-0.5", "leading-relaxed")}>{children}</div> : null}
                {action ? <div className="mt-2">{action}</div> : null}
            </div>
        </div>
    );
}
