"use client";

import clsx from "clsx";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { dayKey } from "@/utils/date-utils";
import { unreadCount } from "@/utils/engagement";
import { fmt } from "@/utils/i18n";
import { activeTab } from "@/utils/routes";
import { computeStreak } from "@/utils/streak-logic";
import { useIsNative, useTranslations, useUser } from "@/utils/user-store";
import { AppLink, useAppNavigate } from "@/components/ui/app-link";
import {
    BellIcon,
    BookOpenIcon,
    ChartIcon,
    ClipboardCheckIcon,
    FlameIcon,
    HeartIcon,
    HomeIcon,
    MenuIcon,
    SettingsIcon,
} from "@/components/ui/icons";
import { useTipJarAvailable } from "@/components/support/use-tip-jar";
import { BrandLockup } from "./brand";
import { LanguageToggle } from "./language-toggle";
import { NotificationCenter } from "./notification-center";
import { ThemeToggle } from "./theme-toggle";

export const APP_TABS = [
    { href: "/dashboard", labelKey: "nav_home", icon: HomeIcon },
    { href: "/practice", labelKey: "nav_practice", icon: BookOpenIcon },
    { href: "/mock", labelKey: "nav_exam", icon: ClipboardCheckIcon },
    { href: "/progress", labelKey: "nav_progress", icon: ChartIcon },
    { href: "/settings", labelKey: "nav_settings", icon: SettingsIcon },
] as const;

const PUBLIC_LINKS = [
    { href: "/question-catalogue", labelKey: "nav_catalogue" },
    { href: "/#explore", labelKey: "nav_centers" },
    { href: "/#bamf-evaluation", labelKey: "nav_bamf" },
] as const;

function StreakChip() {
    const user = useUser();
    const t = useTranslations();
    if (!user?.state?.stateCode) {
        return null;
    }
    const streak = computeStreak(user, dayKey());
    return (
        <AppLink
            href="/progress#streak"
            className={clsx(
                "inline-flex h-10 items-center gap-1.5 rounded-full px-3 font-display text-base font-bold tabular transition-colors hover:bg-default-100",
                streak.todayDone ? "text-secondary-600" : "text-default-500",
            )}
            aria-label={fmt(t.streak_chip_aria, { count: streak.current })}
        >
            <FlameIcon size={20} className={clsx(streak.atRisk && "motion-safe:animate-pulse")} />
            {streak.current}
        </AppLink>
    );
}

/** Way to the tip jar; shown only where the store (Google Play, App Store) can sell the tips (PLAN-012). */
function TipLink() {
    const t = useTranslations();
    return (
        <AppLink
            href="/settings#support"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-danger-500 transition-colors hover:bg-danger-50 dark:text-danger-400"
            aria-label={t.tip_button_aria}
        >
            <HeartIcon size={20} />
        </AppLink>
    );
}

function BellButton() {
    const user = useUser();
    const t = useTranslations();
    const [open, setOpen] = useState(false);
    const unread = unreadCount(user);
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-foreground"
                aria-label={unread > 0 ? fmt(t.notifications_open_unread, { count: unread }) : t.notifications_open}
            >
                <BellIcon size={20} />
                {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground">
                        {unread > 9 ? "9+" : unread}
                    </span>
                ) : null}
            </button>
            <NotificationCenter isOpen={open} onOpenChange={setOpen} />
        </>
    );
}

function DesktopTabs() {
    const pathname = usePathname();
    const t = useTranslations();
    const current = activeTab(pathname);
    return (
        <nav aria-label={t.nav_main_aria} className="hidden md:block">
            <ul className="flex items-center gap-1 rounded-full bg-default-100/80 p-1 ring-1 ring-inset ring-foreground/[0.04]">
                {APP_TABS.slice(0, 4).map(({ href, labelKey, icon: TabIcon }) => {
                    const selected = current === href;
                    return (
                        <li key={href}>
                            <AppLink
                                href={href}
                                aria-current={selected ? "page" : undefined}
                                className={clsx(
                                    "inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200",
                                    selected ? "bg-content1 text-foreground shadow-card ring-1 ring-foreground/[0.05]" : "text-default-500 hover:text-foreground",
                                )}
                            >
                                <TabIcon size={16} />
                                {t[labelKey]}
                            </AppLink>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}

/** Header for learner screens: brand, tabs (wide screens), tip jar, streak, notifications, settings. */
function AppVariant() {
    const t = useTranslations();
    const tipJar = useTipJarAvailable();
    return (
        <>
            <AppLink href="/dashboard" className="rounded-lg" aria-label={t.nav_home}>
                <BrandLockup compact tight={tipJar} />
            </AppLink>
            <DesktopTabs />
            <div className="flex items-center gap-1">
                {tipJar ? <TipLink /> : null}
                <StreakChip />
                <BellButton />
                <AppLink
                    href="/settings"
                    className="hidden h-10 w-10 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-foreground md:inline-flex"
                    aria-label={t.nav_settings}
                >
                    <SettingsIcon size={20} />
                </AppLink>
            </div>
        </>
    );
}

/** Header for public pages: brand, reference links, language and theme, and the way into the app. */
function PublicVariant() {
    const t = useTranslations();
    const navigate = useAppNavigate();
    return (
        <>
            <AppLink href="/" className="rounded-lg" aria-label={t.nav_landing}>
                <BrandLockup compact />
            </AppLink>
            <nav aria-label={t.nav_main_aria} className="hidden lg:block">
                <ul className="flex items-center gap-1">
                    {PUBLIC_LINKS.map(({ href, labelKey }) => (
                        <li key={href}>
                            <AppLink
                                href={href}
                                className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground"
                            >
                                {t[labelKey]}
                            </AppLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <div className="flex items-center gap-2">
                <LanguageToggle className="hidden sm:inline-flex" />
                <ThemeToggle className="hidden md:inline-flex" />
                <Button color="primary" radius="full" className="font-semibold" onPress={() => navigate("/dashboard")}>
                    {t.nav_open_app}
                </Button>
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <Button isIconOnly variant="light" aria-label={t.nav_more} className="lg:hidden">
                            <MenuIcon size={20} />
                        </Button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label={t.nav_more} onAction={(key) => navigate(String(key))}>
                        {PUBLIC_LINKS.map(({ href, labelKey }) => (
                            <DropdownItem key={href}>{t[labelKey]}</DropdownItem>
                        ))}
                    </DropdownMenu>
                </Dropdown>
            </div>
        </>
    );
}

export function AppHeader({ variant }: { variant: "app" | "public" }) {
    const isNative = useIsNative();
    return (
        <header className="sticky top-0 z-40 border-b border-divider/60 bg-background/70 backdrop-blur-xl backdrop-saturate-150">
            <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
                {variant === "app" || isNative ? <AppVariant /> : <PublicVariant />}
            </div>
        </header>
    );
}
