"use client";

import clsx from "clsx";
import { Button, Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@heroui/react";
import type { InAppNotification, InAppNotificationType } from "@/types/user";
import { dayKey } from "@/utils/date-utils";
import { markAllNotificationsRead, markNotificationRead, renderNotification } from "@/utils/engagement";
import { formatDate } from "@/utils/i18n";
import { updateUser, useAppLanguage, useTranslations, useUser } from "@/utils/user-store";
import { IconBadge, type Accent } from "@/components/ui/icon-badge";
import { EmptyState } from "@/components/ui/feedback";
import { useAppNavigate } from "@/components/ui/app-link";
import {
    AwardIcon,
    BellIcon,
    CalendarIcon,
    CheckCheckIcon,
    ClipboardCheckIcon,
    FlameIcon,
    LandmarkIcon,
    LightbulbIcon,
    SnowflakeIcon,
    SparklesIcon,
    TargetIcon,
    type IconComponent,
} from "@/components/ui/icons";

const TYPE_STYLE: Record<InAppNotificationType, { icon: IconComponent; accent: Accent }> = {
    welcome: { icon: SparklesIcon, accent: "primary" },
    goal: { icon: TargetIcon, accent: "success" },
    streak: { icon: FlameIcon, accent: "secondary" },
    freeze: { icon: SnowflakeIcon, accent: "default" },
    achievement: { icon: AwardIcon, accent: "secondary" },
    exam: { icon: CalendarIcon, accent: "primary" },
    evaluation: { icon: LandmarkIcon, accent: "default" },
    tip: { icon: LightbulbIcon, accent: "warning" },
    mock: { icon: ClipboardCheckIcon, accent: "primary" },
};

type NotificationCenterProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
};

/** Drawer listing in-app notifications, newest first, split into today and earlier. */
export function NotificationCenter({ isOpen, onOpenChange }: NotificationCenterProps) {
    const user = useUser();
    const t = useTranslations();
    const language = useAppLanguage();
    const navigate = useAppNavigate();
    const items = user?.inbox ?? [];
    const today = dayKey();
    const todayItems = items.filter((item) => dayKey(item.createdAt) === today);
    const earlierItems = items.filter((item) => dayKey(item.createdAt) !== today);
    const hasUnread = items.some((item) => !item.read);

    const open = (item: InAppNotification) => {
        updateUser((draft) => markNotificationRead(draft, item.id));
        onOpenChange(false);
        if (item.route) {
            navigate(item.route);
        }
    };

    const renderGroup = (title: string, group: InAppNotification[]) =>
        group.length > 0 ? (
            <section aria-label={title} className="flex flex-col">
                <h3 className="px-1 pb-2 pt-4 text-sm font-semibold text-default-500">{title}</h3>
                <ul className="flex flex-col gap-1">
                    {group.map((item) => {
                        const { title: itemTitle, body } = renderNotification(t, item);
                        const style = TYPE_STYLE[item.type] ?? TYPE_STYLE.tip;
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => open(item)}
                                    className={clsx(
                                        "flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-default-100",
                                        !item.read && "bg-primary-50/60",
                                    )}
                                >
                                    <IconBadge icon={style.icon} accent={style.accent} size="md" />
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-start justify-between gap-2">
                                            <span className="font-medium leading-snug text-foreground">{itemTitle}</span>
                                            {!item.read ? (
                                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t.notifications_unread} />
                                            ) : null}
                                        </span>
                                        {body ? <span className="mt-0.5 block text-sm leading-snug text-default-600">{body}</span> : null}
                                        <span className="mt-1 block text-xs text-default-400">
                                            {formatDate(item.createdAt, language, {
                                                day: "numeric",
                                                month: "short",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        ) : null;

    return (
        <Drawer isOpen={isOpen} onOpenChange={onOpenChange} placement="right" size="sm" scrollBehavior="inside">
            <DrawerContent className="pt-safe">
                {() => (
                    <>
                        <DrawerHeader className="flex items-center justify-between gap-3 pr-12">
                            <span className="font-display text-xl font-semibold">{t.notifications_title}</span>
                            {hasUnread ? (
                                <Button
                                    size="sm"
                                    variant="light"
                                    startContent={<CheckCheckIcon size={16} />}
                                    onPress={() => updateUser((draft) => markAllNotificationsRead(draft))}
                                >
                                    {t.notifications_mark_all_read}
                                </Button>
                            ) : null}
                        </DrawerHeader>
                        <DrawerBody className="px-3 pb-6">
                            {items.length === 0 ? (
                                <EmptyState
                                    icon={BellIcon}
                                    title={t.notifications_empty_title}
                                    description={t.notifications_empty_body}
                                />
                            ) : (
                                <>
                                    {renderGroup(t.notifications_today, todayItems)}
                                    {renderGroup(t.notifications_earlier, earlierItems)}
                                </>
                            )}
                        </DrawerBody>
                    </>
                )}
            </DrawerContent>
        </Drawer>
    );
}
