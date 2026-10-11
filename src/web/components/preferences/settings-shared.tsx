"use client";

import { Switch } from "@heroui/react";
import clsx from "clsx";
import type { ChangeEvent, ComponentProps, ReactNode } from "react";
import { FoldOut } from "@/components/ui/fold-out";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import type { IconComponent } from "@/components/ui/icons";
import { SectionHeading, Surface } from "@/components/ui/surface";

/**
 * Small building blocks shared by the settings sections.
 * Every interactive element is at least 44 px tall.
 */

type SettingsSectionProps = {
    id?: string;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    /** Rendered under the rows, outside the divided list (e.g. notices). */
    footer?: ReactNode;
};

/** A heading plus a white sheet with divided rows. `id` makes the section a hash target. */
export function SettingsSection({ id, title, description, action, children, footer }: SettingsSectionProps) {
    return (
        <section id={id} aria-labelledby={id ? `${id}-heading` : undefined} className="scroll-mt-24 space-y-3">
            <SectionHeading id={id ? `${id}-heading` : undefined} title={title} description={description} action={action} />
            <Surface padding="none" className="divide-y divide-divider overflow-hidden">
                {children}
            </Surface>
            {footer}
        </section>
    );
}

type SettingBlockProps = {
    icon?: IconComponent;
    accent?: Accent;
    title: ReactNode;
    description?: ReactNode;
    /** Value or control shown on the right of the title line. */
    trailing?: ReactNode;
    /** Control rendered under the title line, full width (chips, inputs). */
    children?: ReactNode;
    className?: string;
};

/** A row that holds a control below the title; use when chips or inputs need the whole width. */
export function SettingBlock({ icon, accent = "default", title, description, trailing, children, className }: SettingBlockProps) {
    return (
        <div className={clsx("flex flex-col gap-3 px-4 py-3", className)}>
            <div className="flex min-h-[32px] items-center gap-3">
                {icon ? <IconBadge icon={icon} accent={accent} /> : null}
                <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-foreground">{title}</p>
                    {description ? <p className="mt-0.5 text-sm leading-snug text-default-500">{description}</p> : null}
                </div>
                {trailing ? <div className="shrink-0 text-sm text-default-500">{trailing}</div> : null}
            </div>
            {children ? <div className={clsx(icon && "sm:pl-[52px]")}>{children}</div> : null}
        </div>
    );
}

type SwitchRowProps = {
    icon?: IconComponent;
    accent?: Accent;
    title: ReactNode;
    description?: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    /** Extra controls shown below while the switch is on (e.g. a time input). */
    children?: ReactNode;
};

/** A full-width row whose whole surface toggles the switch. */
export function SwitchRow({ icon, accent = "default", title, description, checked, onChange, disabled, children }: SwitchRowProps) {
    return (
        <div>
            <Switch
                isSelected={checked}
                onValueChange={onChange}
                isDisabled={disabled}
                color="primary"
                classNames={{
                    base: "m-0 flex w-full max-w-none flex-row-reverse items-center justify-between gap-3 px-4 py-3 min-h-[56px] cursor-pointer",
                    wrapper: "m-0",
                    label: "ms-0 min-w-0 flex-1 flex items-center gap-3 text-foreground",
                }}
            >
                {icon ? <IconBadge icon={icon} accent={accent} /> : null}
                <span className="min-w-0 flex-1">
                    <span className="block font-medium leading-snug">{title}</span>
                    {description ? <span className="mt-0.5 block text-sm leading-snug text-default-500">{description}</span> : null}
                </span>
            </Switch>
            {checked && children ? <div className={clsx("px-4 pb-3", icon && "sm:pl-[68px]")}>{children}</div> : null}
        </div>
    );
}

type SettingsFoldOutProps = Omit<ComponentProps<typeof FoldOut>, "variant" | "className" | "contentClassName">;

/**
 * A fold-out that takes one row of a settings sheet and hides advanced rows.
 * The toggle gets the sheet's row padding; the opened rows pull back to the
 * full width so they line up with, and keep the dividers of, their siblings.
 */
export function SettingsFoldOut(props: SettingsFoldOutProps) {
    return (
        <FoldOut
            {...props}
            variant="row"
            className="px-4 py-1.5"
            contentClassName="-mx-4 -mb-1.5 mt-0.5 divide-y divide-divider border-t border-divider"
        />
    );
}

const nativeInputClasses =
    "h-11 min-w-0 rounded-xl border border-divider bg-content2 px-3 text-[0.9375rem] text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus/40 dark:[color-scheme:dark]";

type NativeInputProps = {
    id?: string;
    value: string;
    onChange: (value: string) => void;
    label: string;
    min?: string;
    className?: string;
};

/** Native time picker; works well on Android and desktop browsers. */
export function TimeInput({ id, value, onChange, label, className }: NativeInputProps) {
    const handle = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
    return <input id={id} type="time" value={value} onChange={handle} aria-label={label} className={clsx(nativeInputClasses, className)} />;
}

/** Native date picker. `min` is "YYYY-MM-DD". */
export function DateInput({ id, value, onChange, label, min, className }: NativeInputProps) {
    const handle = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value);
    return (
        <input
            id={id}
            type="date"
            value={value}
            min={min}
            onChange={handle}
            aria-label={label}
            className={clsx(nativeInputClasses, "w-full sm:w-auto", className)}
        />
    );
}

/** Small value pill shown on the right of a row. */
export function ValuePill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" | "success" | "warning" | "danger" }) {
    const tones = {
        default: "bg-default-100 text-default-700",
        primary: "bg-primary-50 text-primary-700",
        success: "bg-success-50 text-success-700",
        warning: "bg-warning-50 text-warning-700",
        danger: "bg-danger-50 text-danger-700",
    } as const;
    return <span className={clsx("inline-flex max-w-[11rem] truncate rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}
