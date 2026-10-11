"use client";

import { Button } from "@heroui/react";
import type { CSSProperties } from "react";
import { InlineNotice } from "@/components/ui/feedback";
import type { ActiveNotice } from "@/utils/notice-store";
import type { Translations } from "@/utils/i18n";

type NoticeListProps = {
    notices: ActiveNotice[];
    onDismiss: (id: string) => void;
    t: Translations;
    className?: string;
    style?: CSSProperties;
};

/** Owner notices from the daily download (see `useNotices`); each one can be hidden for good. */
export function NoticeList({ notices, onDismiss, t, className, style }: NoticeListProps) {
    if (notices.length === 0) {
        return null;
    }
    return (
        <section aria-label={t.home_notices_aria} className={className} style={style}>
            <ul className="flex flex-col gap-3">
                {notices.map((notice) => (
                    <li key={notice.id}>
                        <InlineNotice
                            tone={notice.tone}
                            title={notice.title}
                            action={
                                <div className="flex flex-wrap gap-2">
                                    {notice.url ? (
                                        <Button
                                            as="a"
                                            href={notice.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            size="sm"
                                            variant="flat"
                                            color="primary"
                                            className="h-9 font-medium"
                                        >
                                            {notice.linkLabel ?? t.home_notice_open}
                                        </Button>
                                    ) : null}
                                    <Button size="sm" variant="light" color="default" className="h-9 font-medium" onPress={() => onDismiss(notice.id)}>
                                        {t.home_notice_dismiss}
                                    </Button>
                                </div>
                            }
                        >
                            {notice.body ? <p>{notice.body}</p> : null}
                        </InlineNotice>
                    </li>
                ))}
            </ul>
        </section>
    );
}
