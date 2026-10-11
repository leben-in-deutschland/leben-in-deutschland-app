import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type {
    ActionPerformed,
    ActionType,
    Importance,
    LocalNotificationSchema,
    PermissionStatus,
} from "@capacitor/local-notifications";
import { User } from "@/types/user";
import { Translations } from "@/utils/i18n";
import {
    LEGACY_NOTIFICATION_ID,
    NotificationActionTypeId,
    NotificationCard,
    NotificationChannelId,
    PlannedNotification,
    planNotifications,
    planTestNotification,
    plannedNotificationIds,
} from "@/utils/notification-planner";

/**
 * Android system notifications: a thin wrapper around
 * `@capacitor/local-notifications`.
 *
 * What to schedule is decided by the pure planner in
 * `utils/notification-planner.ts`; this module only talks to the plugin. Every
 * function does nothing on the web and never throws: plugin failures are logged
 * with `console.warn` and show up in the return value instead.
 *
 * Calls that change the schedule run one after another, so two quick syncs
 * (for example after two settings changes) cannot interleave their cancel and
 * schedule steps.
 */

export type NotificationPermission = "granted" | "denied" | "prompt" | "unsupported";

/** Status bar icon in `src/android/app/src/main/res/drawable-*`. */
const SMALL_ICON = "ic_stat_android_chrome_192x192";
const TEST_NOTIFICATION_ID = 6900;
const TEST_NOTIFICATION_DELAY_MS = 5000;
/** Screen opened when a tapped notification carries no usable route. */
const DEFAULT_ROUTE = "/dashboard";

const CHANNELS: { id: NotificationChannelId; importance: Importance }[] = [
    { id: "reminders", importance: 3 },
    { id: "streak", importance: 4 },
    { id: "exam", importance: 4 },
    { id: "progress", importance: 3 },
];

/**
 * Button sets the planner may put on a card (`actionTypeId`). Each set has one
 * button; its id arrives as `actionId` when the learner taps it, and
 * `foreground` makes the tap open the app like a tap on the card itself.
 */
const ACTION_TYPES: { id: NotificationActionTypeId; actionId: string; titleKey: string }[] = [
    { id: "question", actionId: "answer", titleKey: "notif_action_question" },
    { id: "practice", actionId: "practice", titleKey: "notif_action_practice" },
    { id: "mock", actionId: "mock", titleKey: "notif_action_mock" },
    { id: "progress", actionId: "progress", titleKey: "notif_action_progress" },
];

interface ChannelState {
    /** Name and description of the last attempt; a language change creates the channel again. */
    signature: string;
    created: boolean;
}

/** Channel creation is attempted once per session (and per language). */
const channelStates = new Map<NotificationChannelId, ChannelState>();

interface ActionTypeState {
    /** Button titles of the last attempt; a language change registers the sets again. */
    signature: string;
    registered: boolean;
}

/** The four button sets are registered together, once per session (and per language). */
let actionTypeState: ActionTypeState | null = null;

/** Tail of the task queue. Never rejects. */
let queue: Promise<unknown> = Promise.resolve();

type Outcome<T> = { ok: true; value: T } | { ok: false };

/** Payload fields shared by planned notifications and the test notification. */
type NotificationContent = NotificationCard & {
    id: number;
    channelId: NotificationChannelId;
    at: Date;
};

function warn(action: string, error: unknown): void {
    console.warn(`[notifications] ${action} failed`, error);
}

/** Runs one plugin call. Synchronous throws and rejections both become `{ ok: false }`. */
async function attempt<T>(action: string, call: () => Promise<T>): Promise<Outcome<T>> {
    try {
        return { ok: true, value: await call() };
    } catch (error) {
        warn(action, error);
        return { ok: false };
    }
}

/**
 * Runs `task` after every earlier queued task has finished. The returned
 * promise never rejects; an unexpected error resolves to `fallback`.
 */
function enqueue<T>(action: string, task: () => Promise<T>, fallback: T): Promise<T> {
    const run = queue.then(task).catch((error: unknown) => {
        warn(action, error);
        return fallback;
    });
    queue = run;
    return run;
}

function isNative(): boolean {
    try {
        return Capacitor.isNativePlatform();
    } catch {
        return false;
    }
}

function isAndroid(): boolean {
    try {
        return Capacitor.getPlatform() === "android";
    } catch {
        return false;
    }
}

/** Translated text, or the key itself when the translation is missing. */
function text(t: Translations, key: string): string {
    return t?.[key] || key;
}

function toPermission(status: PermissionStatus | undefined): NotificationPermission {
    switch (status?.display) {
        case "granted":
            return "granted";
        case "denied":
            return "denied";
        case "prompt":
        case "prompt-with-rationale":
            return "prompt";
        default:
            return "unsupported";
    }
}

/** Current permission. "unsupported" on the web or when the plugin fails. */
export async function getNotificationPermission(): Promise<NotificationPermission> {
    if (!isNative()) {
        return "unsupported";
    }
    const result = await attempt("checkPermissions", () => LocalNotifications.checkPermissions());
    return result.ok ? toPermission(result.value) : "unsupported";
}

/**
 * Shows the system permission dialog (Android 13 and later) and returns the
 * result. Call it only after the learner tapped a button.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!isNative()) {
        return "unsupported";
    }
    const result = await attempt("requestPermissions", () => LocalNotifications.requestPermissions());
    return result.ok ? toPermission(result.value) : "unsupported";
}

/**
 * Creates the Android channels, or renames them after a language change.
 * Returns the ids of the channels that exist. Notifications for any other
 * channel go to the plugin's default channel, because Android drops a
 * notification whose channel does not exist.
 */
async function ensureChannels(t: Translations): Promise<Set<NotificationChannelId>> {
    const ready = new Set<NotificationChannelId>();
    if (!isAndroid()) {
        return ready;
    }
    for (const channel of CHANNELS) {
        const name = text(t, `notif_channel_${channel.id}_name`);
        const description = text(t, `notif_channel_${channel.id}_desc`);
        const signature = `${name}\n${description}`;
        const previous = channelStates.get(channel.id);
        if (previous?.signature !== signature) {
            const result = await attempt(`createChannel "${channel.id}"`, () =>
                LocalNotifications.createChannel({ id: channel.id, name, description, importance: channel.importance }),
            );
            channelStates.set(channel.id, { signature, created: result.ok || previous?.created === true });
        }
        if (channelStates.get(channel.id)?.created) {
            ready.add(channel.id);
        }
    }
    return ready;
}

/**
 * Registers the button sets, or renames the buttons after a language change.
 * Returns the ids of the sets that exist. A card whose set could not be
 * registered is scheduled without `actionTypeId`, so it shows up as a plain
 * card instead of pointing at buttons the system does not know.
 */
async function ensureActionTypes(t: Translations): Promise<Set<NotificationActionTypeId>> {
    const ready = new Set<NotificationActionTypeId>();
    if (!isNative()) {
        return ready;
    }
    const types: ActionType[] = ACTION_TYPES.map((type) => ({
        id: type.id,
        actions: [{ id: type.actionId, title: text(t, type.titleKey), foreground: true }],
    }));
    const signature = types.map((type) => type.actions?.[0]?.title ?? "").join("\n");
    const previous = actionTypeState;
    if (previous?.signature !== signature) {
        const result = await attempt("registerActionTypes", () => LocalNotifications.registerActionTypes({ types }));
        actionTypeState = { signature, registered: result.ok || previous?.registered === true };
    }
    if (actionTypeState?.registered) {
        for (const type of ACTION_TYPES) {
            ready.add(type.id);
        }
    }
    return ready;
}

/** Ids this module may cancel: every planner id and the old 08:00 reminder. */
function ownIds(includeTest: boolean): Set<number> {
    const ids = new Set<number>(plannedNotificationIds());
    ids.add(LEGACY_NOTIFICATION_ID);
    if (includeTest) {
        ids.add(TEST_NOTIFICATION_ID);
    }
    return ids;
}

/**
 * Cancels the pending notifications whose id is in `ids`; other ids are never
 * touched. When the pending list cannot be read, every id in `ids` is
 * cancelled so that no outdated reminder fires.
 */
async function cancelOwnPending(ids: Set<number>): Promise<void> {
    const pending = await attempt("getPending", () => LocalNotifications.getPending());
    const targets = pending.ok
        ? (pending.value?.notifications ?? []).map((notification) => Number(notification.id)).filter((id) => ids.has(id))
        : Array.from(ids);
    const unique = Array.from(new Set(targets));
    if (unique.length === 0) {
        return;
    }
    await attempt("cancel", () => LocalNotifications.cancel({ notifications: unique.map((id) => ({ id })) }));
}

/** Whether `value` is a text worth sending to the plugin. */
function hasText(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

function toSchema(
    content: NotificationContent,
    channels: Set<NotificationChannelId>,
    actionTypes: Set<NotificationActionTypeId>,
): LocalNotificationSchema {
    const extra: { route: string; questionNum?: string } = { route: content.route };
    if (hasText(content.questionNum)) {
        extra.questionNum = content.questionNum;
    }
    const schema: LocalNotificationSchema = {
        id: content.id,
        title: content.title,
        body: content.body,
        // Android "big text": the expanded card, or just the body on more than one line.
        largeBody: hasText(content.largeBody) ? content.largeBody : content.body,
        schedule: { at: content.at, allowWhileIdle: true },
        smallIcon: SMALL_ICON,
        extra,
        autoCancel: true,
    };
    if (hasText(content.summaryText)) {
        schema.summaryText = content.summaryText;
    }
    if (Array.isArray(content.inboxList) && content.inboxList.length > 0) {
        // Android "inbox" style wins over the big text; `largeBody` stays as the fallback.
        schema.inboxList = content.inboxList;
    }
    if (content.actionTypeId !== undefined && actionTypes.has(content.actionTypeId)) {
        schema.actionTypeId = content.actionTypeId;
    }
    if (channels.has(content.channelId)) {
        schema.channelId = content.channelId;
    }
    return schema;
}

/** A missing date would make the plugin show the notification at once. */
function isFuture(item: PlannedNotification, now: Date): boolean {
    return item.at instanceof Date && item.at.getTime() > now.getTime();
}

async function syncNow(user: User | null, t: Translations, now: Date): Promise<number> {
    if (!isNative() || (await getNotificationPermission()) !== "granted") {
        return 0;
    }
    let planned: PlannedNotification[];
    try {
        planned = planNotifications(user, t, now).filter((item) => isFuture(item, now));
    } catch (error) {
        // Keep the current schedule rather than clearing it because of a bug.
        warn("planNotifications", error);
        return 0;
    }
    const channels = planned.length > 0 ? await ensureChannels(t) : new Set<NotificationChannelId>();
    const actionTypes = planned.length > 0 ? await ensureActionTypes(t) : new Set<NotificationActionTypeId>();
    await cancelOwnPending(ownIds(false));
    if (planned.length === 0) {
        return 0;
    }
    const result = await attempt("schedule", () =>
        LocalNotifications.schedule({ notifications: planned.map((item) => toSchema(item, channels, actionTypes)) }),
    );
    return result.ok ? planned.length : 0;
}

/**
 * Replaces this app's scheduled Android notifications with the current plan
 * and returns how many were scheduled. Does nothing (returns 0) on the web or
 * without permission; never asks for permission. Removes the old daily
 * reminder (id 65241). Pending notifications with other ids, including the
 * test notification, are left alone. Pass `user` null, or a learner who turned
 * notifications off, to clear the schedule.
 */
export function syncNativeNotifications(user: User | null, t: Translations, now?: Date): Promise<number> {
    return enqueue("syncNativeNotifications", () => syncNow(user, t, now ?? new Date()), 0);
}

/** Cancels every pending notification of this app (planned, old daily reminder, and test). */
export function cancelPendingNotifications(): Promise<void> {
    return enqueue(
        "cancelPendingNotifications",
        async () => {
            if (isNative()) {
                await cancelOwnPending(ownIds(true));
            }
        },
        undefined,
    );
}

/**
 * Sends the planner's test card (`planTestNotification`) 5 seconds from now so
 * the learner can check that notifications arrive and see the real format.
 * Needs permission; never asks for it. Returns false on the web, without
 * permission, or when scheduling fails.
 */
export function sendTestNotification(t: Translations, user?: User | null): Promise<boolean> {
    return enqueue(
        "sendTestNotification",
        async () => {
            if (!isNative() || (await getNotificationPermission()) !== "granted") {
                return false;
            }
            const channels = await ensureChannels(t);
            const actionTypes = await ensureActionTypes(t);
            const content: NotificationContent = {
                ...planTestNotification(user ?? null, t, new Date()),
                id: TEST_NOTIFICATION_ID,
                channelId: "reminders",
                at: new Date(Date.now() + TEST_NOTIFICATION_DELAY_MS),
            };
            const result = await attempt("schedule test notification", () =>
                LocalNotifications.schedule({ notifications: [toSchema(content, channels, actionTypes)] }),
            );
            return result.ok;
        },
        false,
    );
}

/**
 * The in-app route stored on a tapped notification. Only app paths are
 * accepted ("/..."); anything else, such as "//host" or a full URL, falls back
 * to the dashboard.
 */
function routeOf(action: ActionPerformed | undefined): string {
    const route: unknown = action?.notification?.extra?.route;
    return typeof route === "string" && /^\/(?![/\\])/.test(route) ? route : DEFAULT_ROUTE;
}

function removeHandle(handle: PluginListenerHandle): void {
    void attempt("remove tap listener", () => handle.remove());
}

/**
 * Calls `onRoute` with the screen to open whenever the learner taps one of
 * this app's notifications or one of its buttons (also when the tap started
 * the app). The card and every button of a set lead to the card's route; a
 * swipe-away ("dismiss") is ignored. Returns a function that removes the
 * listener. Does nothing on the web.
 */
export function addNotificationTapListener(onRoute: (route: string) => void): () => void {
    if (!isNative()) {
        return () => undefined;
    }
    let active = true;
    let handle: PluginListenerHandle | null = null;

    const listener = (action: ActionPerformed) => {
        if (!active || action?.actionId === "dismiss") {
            return;
        }
        try {
            onRoute(routeOf(action));
        } catch (error) {
            warn("notification tap handler", error);
        }
    };

    let registration: Promise<PluginListenerHandle>;
    try {
        registration = Promise.resolve(LocalNotifications.addListener("localNotificationActionPerformed", listener));
    } catch (error) {
        warn("addListener", error);
        return () => undefined;
    }
    registration.then(
        (registered) => {
            handle = registered;
            if (!active) {
                removeHandle(registered);
            }
        },
        (error: unknown) => warn("addListener", error),
    );

    return () => {
        if (!active) {
            return;
        }
        active = false;
        if (handle) {
            removeHandle(handle);
        }
    };
}
