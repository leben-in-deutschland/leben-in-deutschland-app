"use client";

import clsx from "clsx";
import { usePathname } from "next/navigation";
import { activeTab } from "@/utils/routes";
import { useTranslations } from "@/utils/user-store";
import { AppLink } from "@/components/ui/app-link";
import { APP_TABS } from "./app-header";

/** Phone tab bar for the five learner areas. Hidden on wide screens, where the header shows tabs. */
export function BottomNav() {
    const pathname = usePathname();
    const t = useTranslations();
    const current = activeTab(pathname);

    return (
        <nav
            aria-label={t.nav_tabbar_aria}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
        >
            <div className="mx-auto max-w-lg px-3 pb-[calc(var(--safe-area-inset-bottom)+var(--tabbar-gap))]">
                <ul className="glass pointer-events-auto grid h-[var(--tabbar-height)] grid-cols-5 rounded-[26px] px-1 shadow-float ring-1 ring-foreground/[0.07] dark:ring-white/[0.09]">
                    {APP_TABS.map(({ href, labelKey, icon: TabIcon }) => {
                        const selected = current === href;
                        return (
                            <li key={href} className="flex">
                                <AppLink
                                    href={href}
                                    aria-current={selected ? "page" : undefined}
                                    className="group flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium"
                                >
                                    <span
                                        className={clsx(
                                            "inline-flex h-8 w-[52px] items-center justify-center rounded-full transition-[background-color,color,box-shadow,transform] duration-300 ease-out",
                                            selected
                                                ? "bg-primary text-primary-foreground shadow-glow"
                                                : "text-default-500 group-hover:bg-default-100 group-hover:text-foreground group-active:scale-95",
                                        )}
                                    >
                                        <TabIcon size={20} strokeWidth={selected ? 2.4 : 2} />
                                    </span>
                                    <span className={clsx("leading-none transition-colors", selected ? "font-semibold text-primary dark:text-primary-600" : "text-default-500")}>
                                        {t[labelKey]}
                                    </span>
                                </AppLink>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </nav>
    );
}
