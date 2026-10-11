"use client";

import clsx from "clsx";
import { setAppLanguage, useAppLanguage, useHydrated, useTranslations } from "@/utils/user-store";

/** Compact DE / EN switch for the interface language. */
export function LanguageToggle({ className }: { className?: string }) {
    const language = useAppLanguage();
    const hydrated = useHydrated();
    const t = useTranslations();
    return (
        <div role="radiogroup" aria-label={t.language_label} className={clsx("inline-flex rounded-xl bg-default-100 p-1", className)}>
            {(["de", "en"] as const).map((value) => {
                const selected = hydrated && language === value;
                return (
                    <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        lang={value}
                        aria-label={value === "de" ? "Deutsch" : "English"}
                        onClick={() => setAppLanguage(value)}
                        className={clsx(
                            "inline-flex h-9 min-w-10 items-center justify-center rounded-lg px-2 text-sm font-semibold uppercase transition-colors",
                            selected ? "bg-content1 text-foreground shadow-card" : "text-default-500 hover:text-foreground",
                        )}
                    >
                        {value}
                    </button>
                );
            })}
        </div>
    );
}
