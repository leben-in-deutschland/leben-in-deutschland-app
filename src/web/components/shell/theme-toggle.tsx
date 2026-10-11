"use client";

import clsx from "clsx";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import { useHydrated, useTranslations } from "@/utils/user-store";

const OPTIONS = [
    { value: "light", icon: SunIcon, labelKey: "theme_light" },
    { value: "system", icon: MonitorIcon, labelKey: "theme_system" },
    { value: "dark", icon: MoonIcon, labelKey: "theme_dark" },
] as const;

/** Light / system / dark switch. Renders a same-size placeholder until hydrated. */
export function ThemeToggle({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
    const { theme, setTheme } = useTheme();
    const hydrated = useHydrated();
    const t = useTranslations();
    const current = hydrated ? theme ?? "system" : null;

    return (
        <div role="radiogroup" aria-label={t.theme_label} className={clsx("inline-flex rounded-xl bg-default-100 p-1", className)}>
            {OPTIONS.map(({ value, icon: OptionIcon, labelKey }) => {
                const selected = current === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={t[labelKey]}
                        title={t[labelKey]}
                        onClick={() => setTheme(value)}
                        className={clsx(
                            "inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors",
                            selected ? "bg-content1 text-foreground shadow-card" : "text-default-500 hover:text-foreground",
                        )}
                    >
                        <OptionIcon size={16} />
                        {showLabels ? <span>{t[labelKey]}</span> : null}
                    </button>
                );
            })}
        </div>
    );
}
