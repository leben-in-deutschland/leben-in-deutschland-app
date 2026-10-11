import { useEffect, useSyncExternalStore } from "react";
import { refreshNotices } from "@/services/notices";
import { dayKey } from "@/utils/date-utils";
import {
    activeNotices,
    dismissNotice,
    noticeStore,
    readDismissed,
    resolveFlags,
    subscribeDismissed,
    type ActiveNotice,
    type NoticeFile,
    type NoticeFlags,
} from "@/utils/notice-store";
import { APP_VERSION } from "@/utils/remote-cache";
import { useAppLanguage, useIsNative } from "@/utils/user-store";

function fileSnapshot(): NoticeFile | null {
    return noticeStore.read().data;
}

function serverFile(): NoticeFile | null {
    return null;
}

const noDismissed: readonly string[] = Object.freeze([]) as readonly string[];

function serverDismissed(): readonly string[] {
    return noDismissed;
}

/** The downloaded notice file, if any. Triggers one refresh per mount on Android. */
export function useNoticeFile(): NoticeFile | null {
    const file = useSyncExternalStore(noticeStore.subscribe, fileSnapshot, serverFile);
    useEffect(() => {
        void refreshNotices();
    }, []);
    return file;
}

/** The owner's switches with defaults applied. */
export function useNoticeFlags(): NoticeFlags {
    return resolveFlags(useNoticeFile());
}

/** The notices to show on Home for this learner, plus a way to hide one for good. */
export function useNotices(): { notices: ActiveNotice[]; dismiss: (id: string) => void } {
    const file = useNoticeFile();
    const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, serverDismissed);
    const language = useAppLanguage();
    const native = useIsNative();
    const notices = activeNotices(file, { today: dayKey(), platform: native ? "android" : "web", version: APP_VERSION, dismissed }, language);
    return { notices, dismiss: dismissNotice };
}
