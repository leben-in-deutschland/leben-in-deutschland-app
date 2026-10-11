import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { User } from "@/types/user";
import type { NotificationCard, PlannedNotification } from "@/utils/notification-planner";

type NotificationsService = typeof import("@/services/notifications");
type HapticsService = typeof import("@/services/haptics");

/*
 * The Capacitor plugins and the notification planner are replaced by mocks.
 * Each test imports a fresh copy of the service, so the per-session state
 * (created channels, task queue) starts empty.
 */
const native = vi.hoisted(() => ({
    env: { native: true, platform: "android" },
    /** Every id the planner contract allows (utils/notification-planner.ts). */
    plannerIds: [2000, 2001, 2002, 2100, 2101, 2102, 2103, 3000, 3001, 4000, 5000, 5001, 5002, 5003, 5004, 5005, 6000],
    Capacitor: {
        isNativePlatform: vi.fn(),
        getPlatform: vi.fn(),
    },
    LocalNotifications: {
        checkPermissions: vi.fn(),
        requestPermissions: vi.fn(),
        createChannel: vi.fn(),
        registerActionTypes: vi.fn(),
        getPending: vi.fn(),
        cancel: vi.fn(),
        schedule: vi.fn(),
        addListener: vi.fn(),
    },
    Haptics: {
        notification: vi.fn(),
        impact: vi.fn(),
    },
    planNotifications: vi.fn(),
    planTestNotification: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: native.Capacitor }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: native.LocalNotifications }));
vi.mock("@capacitor/haptics", () => ({
    Haptics: native.Haptics,
    ImpactStyle: { Heavy: "HEAVY", Medium: "MEDIUM", Light: "LIGHT" },
    NotificationType: { Success: "SUCCESS", Warning: "WARNING", Error: "ERROR" },
}));
vi.mock("@/utils/notification-planner", () => ({
    LEGACY_NOTIFICATION_ID: 65241,
    plannedNotificationIds: () => [...native.plannerIds],
    planNotifications: native.planNotifications,
    planTestNotification: native.planTestNotification,
}));

const LN = native.LocalNotifications;
const LEGACY_ID = 65241;
const TEST_ID = 6900;
const SMALL_ICON = "ic_stat_android_chrome_192x192";

/** Friday, 9 October 2026, 12:00 local time. */
const NOW = new Date(2026, 9, 9, 12, 0, 0);

const T: Record<string, string> = {
    notif_channel_reminders_name: "Study reminders",
    notif_channel_reminders_desc: "Daily reminders to practice",
    notif_channel_streak_name: "Streak",
    notif_channel_streak_desc: "Warnings when your streak is at risk",
    notif_channel_exam_name: "Exam",
    notif_channel_exam_desc: "Exam countdown and mock exam suggestions",
    notif_channel_progress_name: "Progress",
    notif_channel_progress_desc: "Weekly summaries",
    notif_action_question: "Answer",
    notif_action_practice: "Practise now",
    notif_action_mock: "Start mock exam",
    notif_action_progress: "See progress",
    notif_test_title: "Notifications are working",
    notif_test_body: "Your reminders will look like this.",
};

const T_DE: Record<string, string> = {
    notif_channel_reminders_name: "Lernerinnerungen",
    notif_channel_reminders_desc: "Tägliche Erinnerungen zum Üben",
    notif_channel_streak_name: "Serie",
    notif_channel_streak_desc: "Hinweise, wenn deine Serie in Gefahr ist",
    notif_channel_exam_name: "Prüfung",
    notif_channel_exam_desc: "Countdown zur Prüfung und Vorschläge für Probeprüfungen",
    notif_channel_progress_name: "Fortschritt",
    notif_channel_progress_desc: "Wöchentliche Zusammenfassungen",
    notif_action_question: "Antworten",
    notif_action_practice: "Jetzt üben",
    notif_action_mock: "Probeprüfung starten",
    notif_action_progress: "Fortschritt ansehen",
    notif_test_title: "Benachrichtigungen funktionieren",
    notif_test_body: "So sehen deine Erinnerungen aus.",
};

const CHANNELS_EN = [
    { id: "reminders", name: "Study reminders", description: "Daily reminders to practice", importance: 3 },
    { id: "streak", name: "Streak", description: "Warnings when your streak is at risk", importance: 4 },
    { id: "exam", name: "Exam", description: "Exam countdown and mock exam suggestions", importance: 4 },
    { id: "progress", name: "Progress", description: "Weekly summaries", importance: 3 },
];

/** The button sets the service registers, with English titles. */
const ACTION_TYPES_EN = [
    { id: "question", actions: [{ id: "answer", title: "Answer", foreground: true }] },
    { id: "practice", actions: [{ id: "practice", title: "Practise now", foreground: true }] },
    { id: "mock", actions: [{ id: "mock", title: "Start mock exam", foreground: true }] },
    { id: "progress", actions: [{ id: "progress", title: "See progress", foreground: true }] },
];

/** What the mocked planner returns for the test notification unless a test says otherwise. */
const TEST_CARD: NotificationCard = {
    title: "Notifications are working",
    body: "Your reminders will look like this.",
    route: "/settings",
};

function makeUser(): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "en",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        onboardingCompleted: true,
    };
}

function planned(overrides: Partial<PlannedNotification> & Pick<PlannedNotification, "id">): PlannedNotification {
    return {
        channelId: "reminders",
        kind: "daily",
        title: `Title ${overrides.id}`,
        body: `Body ${overrides.id}`,
        at: new Date(2026, 9, 9, 18, 0),
        route: "/dashboard",
        ...overrides,
    };
}

const DAILY = planned({ id: 2001, at: new Date(2026, 9, 10, 18, 0) });
const STREAK = planned({ id: 3000, channelId: "streak", kind: "streak", at: new Date(2026, 9, 9, 20, 30), route: "/practice" });
const WEEKLY = planned({ id: 4000, channelId: "progress", kind: "weekly", at: new Date(2026, 9, 11, 18, 0), route: "/progress" });
const EXAM = planned({ id: 5002, channelId: "exam", kind: "exam", at: new Date(2026, 9, 16, 9, 0), route: "/mock" });
const PLAN = [DAILY, STREAK, WEEKLY, EXAM];

/** The payload the plugin should receive for a planned notification. */
function schemaOf(item: PlannedNotification) {
    return {
        id: item.id,
        title: item.title,
        body: item.body,
        largeBody: item.body,
        schedule: { at: item.at, allowWhileIdle: true },
        channelId: item.channelId,
        smallIcon: SMALL_ICON,
        extra: { route: item.route },
        autoCancel: true,
    };
}

function pendingOf(ids: number[]) {
    return { notifications: ids.map((id) => ({ id, title: "", body: "" })) };
}

/** Ids passed to `LocalNotifications.cancel`, over all calls. */
function cancelledIds(): number[] {
    return LN.cancel.mock.calls.flatMap(([options]) => options.notifications.map((entry: { id: number }) => entry.id));
}

/** Notifications passed to the n-th `LocalNotifications.schedule` call. */
function scheduled(call = 0): Record<string, unknown>[] {
    return LN.schedule.mock.calls[call][0].notifications;
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Lets every pending promise callback run. */
function flush(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

let service: NotificationsService;
let warn: MockInstance<typeof console.warn>;

beforeEach(async () => {
    vi.resetAllMocks();
    native.env.native = true;
    native.env.platform = "android";
    native.Capacitor.isNativePlatform.mockImplementation(() => native.env.native);
    native.Capacitor.getPlatform.mockImplementation(() => native.env.platform);
    LN.checkPermissions.mockResolvedValue({ display: "granted" });
    LN.requestPermissions.mockResolvedValue({ display: "granted" });
    LN.createChannel.mockResolvedValue(undefined);
    LN.registerActionTypes.mockResolvedValue(undefined);
    LN.getPending.mockResolvedValue({ notifications: [] });
    LN.cancel.mockResolvedValue(undefined);
    LN.schedule.mockImplementation(async ({ notifications }) => ({
        notifications: notifications.map(({ id }: { id: number }) => ({ id })),
    }));
    LN.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
    native.Haptics.notification.mockResolvedValue(undefined);
    native.Haptics.impact.mockResolvedValue(undefined);
    native.planNotifications.mockReturnValue([]);
    native.planTestNotification.mockImplementation((_user: User | null, t: Record<string, string>) => ({
        ...TEST_CARD,
        title: t.notif_test_title || "notif_test_title",
        body: t.notif_test_body || "notif_test_body",
    }));
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.resetModules();
    service = await import("@/services/notifications");
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("getNotificationPermission", () => {
    it("is unsupported on the web without calling the plugin", async () => {
        native.env.native = false;
        await expect(service.getNotificationPermission()).resolves.toBe("unsupported");
        expect(LN.checkPermissions).not.toHaveBeenCalled();
    });

    it.each([
        ["granted", "granted"],
        ["denied", "denied"],
        ["prompt", "prompt"],
        ["prompt-with-rationale", "prompt"],
    ])("maps the plugin state %s to %s", async (display, expected) => {
        LN.checkPermissions.mockResolvedValue({ display });
        await expect(service.getNotificationPermission()).resolves.toBe(expected);
    });

    it("is unsupported for an unknown plugin state", async () => {
        LN.checkPermissions.mockResolvedValue({ display: "limited" });
        await expect(service.getNotificationPermission()).resolves.toBe("unsupported");
    });

    it("is unsupported when the plugin rejects", async () => {
        LN.checkPermissions.mockRejectedValue(new Error("not implemented"));
        await expect(service.getNotificationPermission()).resolves.toBe("unsupported");
        expect(warn).toHaveBeenCalled();
    });

    it("is unsupported when the plugin throws synchronously", async () => {
        LN.checkPermissions.mockImplementation(() => {
            throw new Error("bridge missing");
        });
        await expect(service.getNotificationPermission()).resolves.toBe("unsupported");
        expect(warn).toHaveBeenCalled();
    });

    it("treats a failing platform check as the web", async () => {
        native.Capacitor.isNativePlatform.mockImplementation(() => {
            throw new Error("no Capacitor");
        });
        await expect(service.getNotificationPermission()).resolves.toBe("unsupported");
        expect(LN.checkPermissions).not.toHaveBeenCalled();
    });
});

describe("requestNotificationPermission", () => {
    it("is unsupported on the web without showing a dialog", async () => {
        native.env.native = false;
        await expect(service.requestNotificationPermission()).resolves.toBe("unsupported");
        expect(LN.requestPermissions).not.toHaveBeenCalled();
    });

    it.each([
        ["granted", "granted"],
        ["denied", "denied"],
        ["prompt", "prompt"],
        ["prompt-with-rationale", "prompt"],
    ])("maps the dialog result %s to %s", async (display, expected) => {
        LN.requestPermissions.mockResolvedValue({ display });
        await expect(service.requestNotificationPermission()).resolves.toBe(expected);
        expect(LN.requestPermissions).toHaveBeenCalledTimes(1);
    });

    it("is unsupported when the dialog fails", async () => {
        LN.requestPermissions.mockRejectedValue(new Error("activity gone"));
        await expect(service.requestNotificationPermission()).resolves.toBe("unsupported");
        expect(warn).toHaveBeenCalled();
    });
});

describe("syncNativeNotifications", () => {
    it("does nothing on the web", async () => {
        native.env.native = false;
        native.planNotifications.mockReturnValue(PLAN);

        await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);

        expect(native.planNotifications).not.toHaveBeenCalled();
        for (const call of Object.values(LN)) {
            expect(call).not.toHaveBeenCalled();
        }
    });

    it.each(["denied", "prompt", "prompt-with-rationale"])(
        "does nothing without permission (%s) and never asks for it",
        async (display) => {
            LN.checkPermissions.mockResolvedValue({ display });
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);

            expect(LN.requestPermissions).not.toHaveBeenCalled();
            expect(LN.createChannel).not.toHaveBeenCalled();
            expect(LN.registerActionTypes).not.toHaveBeenCalled();
            expect(LN.getPending).not.toHaveBeenCalled();
            expect(LN.cancel).not.toHaveBeenCalled();
            expect(LN.schedule).not.toHaveBeenCalled();
        },
    );

    it("schedules the plan with the expected payload and returns the count", async () => {
        const user = makeUser();
        native.planNotifications.mockReturnValue(PLAN);

        await expect(service.syncNativeNotifications(user, T, NOW)).resolves.toBe(4);

        expect(native.planNotifications).toHaveBeenCalledWith(user, T, NOW);
        expect(LN.schedule).toHaveBeenCalledTimes(1);
        expect(LN.schedule).toHaveBeenCalledWith({ notifications: PLAN.map(schemaOf) });
    });

    it("plans with the current time when none is given", async () => {
        const before = Date.now();
        await service.syncNativeNotifications(makeUser(), T);
        const after = Date.now();

        const now = native.planNotifications.mock.calls[0][2] as Date;
        expect(now).toBeInstanceOf(Date);
        expect(now.getTime()).toBeGreaterThanOrEqual(before);
        expect(now.getTime()).toBeLessThanOrEqual(after);
    });

    it("skips planned notifications without a valid future time", async () => {
        native.planNotifications.mockReturnValue([
            planned({ id: 2000, at: new Date(2026, 9, 9, 11, 59) }),
            planned({ id: 2002, at: new Date(Number.NaN) }),
            planned({ id: 2100, at: undefined as unknown as Date }),
            DAILY,
        ]);

        await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(1);
        expect(LN.schedule).toHaveBeenCalledWith({ notifications: [schemaOf(DAILY)] });
    });

    describe("rich cards", () => {
        const QUESTION = planned({
            id: 2000,
            at: new Date(2026, 9, 9, 18, 0),
            title: "Question of the day",
            body: "Which colours are on the German flag?",
            largeBody: "Which colours are on the German flag?\n\nA  black, red, gold\nB  blue, white\nC  red, white\nD  green, white",
            summaryText: "No. 12 · Rights & freedoms",
            actionTypeId: "question",
            questionNum: "12",
        });
        const SUMMARY = planned({
            id: 4000,
            channelId: "progress",
            kind: "weekly",
            at: new Date(2026, 9, 11, 18, 0),
            route: "/progress",
            largeBody: "fallback text",
            summaryText: "This week",
            inboxList: ["42 questions answered", "3 days practised", "1 mock exam passed"],
            actionTypeId: "progress",
        });

        it("passes the expanded text, summary, button set, and question number through", async () => {
            native.planNotifications.mockReturnValue([QUESTION]);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(1);

            expect(scheduled()[0]).toEqual({
                ...schemaOf(QUESTION),
                largeBody: QUESTION.largeBody,
                summaryText: QUESTION.summaryText,
                actionTypeId: "question",
                extra: { route: QUESTION.route, questionNum: "12" },
            });
        });

        it("sends the inbox lines together with the expanded text as fallback", async () => {
            native.planNotifications.mockReturnValue([SUMMARY]);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            expect(scheduled()[0]).toEqual({
                ...schemaOf(SUMMARY),
                largeBody: "fallback text",
                summaryText: "This week",
                inboxList: ["42 questions answered", "3 days practised", "1 mock exam passed"],
                actionTypeId: "progress",
            });
        });

        it("uses the body as expanded text when the card has none", async () => {
            native.planNotifications.mockReturnValue([DAILY, planned({ id: 2002, largeBody: "" })]);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            const [daily, empty] = scheduled();
            expect(daily.largeBody).toBe(DAILY.body);
            expect(empty.largeBody).toBe("Body 2002");
        });

        it("leaves out empty optional fields", async () => {
            native.planNotifications.mockReturnValue([planned({ id: 2000, summaryText: "", inboxList: [], questionNum: "" })]);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            const [notification] = scheduled();
            expect(notification).not.toHaveProperty("summaryText");
            expect(notification).not.toHaveProperty("inboxList");
            expect(notification).not.toHaveProperty("actionTypeId");
            expect(notification.extra).toEqual({ route: "/dashboard" });
        });
    });

    describe("button sets", () => {
        it("registers the four button sets with translated titles before scheduling", async () => {
            native.planNotifications.mockReturnValue(PLAN);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            expect(LN.registerActionTypes).toHaveBeenCalledTimes(1);
            expect(LN.registerActionTypes).toHaveBeenCalledWith({ types: ACTION_TYPES_EN });
            expect(LN.registerActionTypes.mock.invocationCallOrder[0]).toBeLessThan(LN.schedule.mock.invocationCallOrder[0]);
        });

        it("registers the button sets only once per session", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.sendTestNotification(T);

            expect(LN.registerActionTypes).toHaveBeenCalledTimes(1);
        });

        it("registers the button sets again after a language change", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.syncNativeNotifications(makeUser(), T_DE, NOW);
            await service.syncNativeNotifications(makeUser(), T_DE, NOW);

            expect(LN.registerActionTypes).toHaveBeenCalledTimes(2);
            expect(LN.registerActionTypes.mock.calls[1][0].types.map((type: { id: string; actions: { title: string }[] }) => [type.id, type.actions[0].title])).toEqual([
                ["question", "Antworten"],
                ["practice", "Jetzt üben"],
                ["mock", "Probeprüfung starten"],
                ["progress", "Fortschritt ansehen"],
            ]);
        });

        it("uses the key names when the translations are missing", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), {}, NOW);

            expect(LN.registerActionTypes.mock.calls[0][0].types[0]).toEqual({
                id: "question",
                actions: [{ id: "answer", title: "notif_action_question", foreground: true }],
            });
        });

        it("does not register button sets when nothing is planned", async () => {
            await service.syncNativeNotifications(makeUser(), T, NOW);
            expect(LN.registerActionTypes).not.toHaveBeenCalled();
        });

        it("schedules the cards without buttons when registering fails, without retrying", async () => {
            LN.registerActionTypes.mockRejectedValue(new Error("register failed"));
            native.planNotifications.mockReturnValue([planned({ id: 2000, actionTypeId: "question" }), STREAK]);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(2);

            expect(scheduled()[0]).not.toHaveProperty("actionTypeId");
            expect(scheduled()[0]).toMatchObject({ id: 2000, largeBody: "Body 2000", channelId: "reminders" });
            expect(warn).toHaveBeenCalled();

            await service.syncNativeNotifications(makeUser(), T, NOW);
            expect(LN.registerActionTypes).toHaveBeenCalledTimes(1);
            expect(scheduled(1)[0]).not.toHaveProperty("actionTypeId");
        });

        it("keeps the buttons when renaming them fails", async () => {
            native.planNotifications.mockReturnValue([planned({ id: 2000, actionTypeId: "practice" })]);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            LN.registerActionTypes.mockRejectedValue(new Error("rename failed"));

            await service.syncNativeNotifications(makeUser(), T_DE, NOW);

            expect(LN.registerActionTypes).toHaveBeenCalledTimes(2);
            expect(scheduled(1)[0].actionTypeId).toBe("practice");
        });

        it("tries again after a failure when the language changes", async () => {
            LN.registerActionTypes.mockRejectedValueOnce(new Error("register failed"));
            native.planNotifications.mockReturnValue([planned({ id: 2000, actionTypeId: "mock" })]);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            expect(scheduled(0)[0]).not.toHaveProperty("actionTypeId");

            await service.syncNativeNotifications(makeUser(), T_DE, NOW);

            expect(LN.registerActionTypes).toHaveBeenCalledTimes(2);
            expect(scheduled(1)[0].actionTypeId).toBe("mock");
        });
    });

    describe("channels", () => {
        it("creates the four Android channels with translated names", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);

            expect(LN.createChannel.mock.calls.map(([channel]) => channel)).toEqual(CHANNELS_EN);
        });

        it("creates the channels only once per session", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.sendTestNotification(T);

            expect(LN.createChannel).toHaveBeenCalledTimes(4);
            expect(LN.schedule).toHaveBeenCalledTimes(3);
        });

        it("renames the channels after a language change", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            await service.syncNativeNotifications(makeUser(), T_DE, NOW);
            await service.syncNativeNotifications(makeUser(), T_DE, NOW);

            expect(LN.createChannel).toHaveBeenCalledTimes(8);
            expect(LN.createChannel.mock.calls.slice(4).map(([channel]) => [channel.id, channel.name])).toEqual([
                ["reminders", "Lernerinnerungen"],
                ["streak", "Serie"],
                ["exam", "Prüfung"],
                ["progress", "Fortschritt"],
            ]);
        });

        it("uses the key names when the translations are missing", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), {}, NOW);

            expect(LN.createChannel.mock.calls[1][0]).toEqual({
                id: "streak",
                name: "notif_channel_streak_name",
                description: "notif_channel_streak_desc",
                importance: 4,
            });
        });

        it("creates the channels before scheduling", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            await service.syncNativeNotifications(makeUser(), T, NOW);

            const lastChannel = Math.max(...LN.createChannel.mock.invocationCallOrder);
            expect(lastChannel).toBeLessThan(LN.schedule.mock.invocationCallOrder[0]);
        });

        it("does not create channels when nothing is planned", async () => {
            await service.syncNativeNotifications(makeUser(), T, NOW);
            expect(LN.createChannel).not.toHaveBeenCalled();
        });

        it("skips channels on native platforms other than Android", async () => {
            native.env.platform = "ios";
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(4);

            expect(LN.createChannel).not.toHaveBeenCalled();
            for (const notification of scheduled()) {
                expect(notification).not.toHaveProperty("channelId");
            }
        });

        it("uses the default channel when a channel cannot be created, without retrying", async () => {
            LN.createChannel.mockImplementation(async (channel: { id: string }) => {
                if (channel.id === "streak") {
                    throw new Error("channel failed");
                }
            });
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(4);

            const [daily, streak, weekly, exam] = scheduled();
            expect(streak).not.toHaveProperty("channelId");
            expect([daily.channelId, weekly.channelId, exam.channelId]).toEqual(["reminders", "progress", "exam"]);
            expect(warn).toHaveBeenCalled();

            await service.syncNativeNotifications(makeUser(), T, NOW);
            expect(LN.createChannel).toHaveBeenCalledTimes(4);
            expect(scheduled(1)[1]).not.toHaveProperty("channelId");
        });

        it("keeps a channel that exists when renaming it fails", async () => {
            native.planNotifications.mockReturnValue([STREAK]);
            await service.syncNativeNotifications(makeUser(), T, NOW);
            LN.createChannel.mockRejectedValue(new Error("rename failed"));

            await service.syncNativeNotifications(makeUser(), T_DE, NOW);

            expect(scheduled(1)[0].channelId).toBe("streak");
        });
    });

    describe("cancelling", () => {
        it("cancels only this app's pending notifications and the old daily reminder", async () => {
            LN.getPending.mockResolvedValue(pendingOf([LEGACY_ID, 2000, 1, 2101, 99, 3001, TEST_ID, 6000, 7777, 123456]));
            native.planNotifications.mockReturnValue(PLAN);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            expect(LN.cancel).toHaveBeenCalledTimes(1);
            expect(LN.cancel).toHaveBeenCalledWith({
                notifications: [{ id: LEGACY_ID }, { id: 2000 }, { id: 2101 }, { id: 3001 }, { id: 6000 }],
            });
        });

        it("cancels before scheduling", async () => {
            LN.getPending.mockResolvedValue(pendingOf([3000]));
            native.planNotifications.mockReturnValue(PLAN);

            await service.syncNativeNotifications(makeUser(), T, NOW);

            expect(LN.cancel.mock.invocationCallOrder[0]).toBeLessThan(LN.schedule.mock.invocationCallOrder[0]);
        });

        it("does not call cancel when none of its notifications are pending", async () => {
            LN.getPending.mockResolvedValue(pendingOf([1, 99, TEST_ID]));
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(4);

            expect(LN.cancel).not.toHaveBeenCalled();
            expect(LN.schedule).toHaveBeenCalledTimes(1);
        });

        it("clears its notifications when nothing is planned", async () => {
            LN.getPending.mockResolvedValue(pendingOf([LEGACY_ID, 2000, 42, 3001]));

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);

            expect(cancelledIds()).toEqual([LEGACY_ID, 2000, 3001]);
            expect(LN.schedule).not.toHaveBeenCalled();
        });

        it("clears its notifications for a missing learner", async () => {
            LN.getPending.mockResolvedValue(pendingOf([2100, 2103, 5]));

            await expect(service.syncNativeNotifications(null, T, NOW)).resolves.toBe(0);

            expect(native.planNotifications).toHaveBeenCalledWith(null, T, NOW);
            expect(cancelledIds()).toEqual([2100, 2103]);
        });

        it("cancels every own id when the pending list cannot be read", async () => {
            LN.getPending.mockRejectedValue(new Error("storage broken"));
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(4);

            expect([...cancelledIds()].sort((a, b) => a - b)).toEqual([...native.plannerIds, LEGACY_ID].sort((a, b) => a - b));
            expect(cancelledIds()).not.toContain(TEST_ID);
            expect(warn).toHaveBeenCalled();
        });

        it("still schedules when cancelling fails", async () => {
            LN.getPending.mockResolvedValue(pendingOf([2000]));
            LN.cancel.mockRejectedValue(new Error("cancel failed"));
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(4);
            expect(LN.schedule).toHaveBeenCalledTimes(1);
            expect(warn).toHaveBeenCalled();
        });
    });

    describe("failures", () => {
        it("returns 0 when scheduling rejects", async () => {
            LN.schedule.mockRejectedValue(new Error("exact alarms denied"));
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);
            expect(warn).toHaveBeenCalled();
        });

        it("returns 0 when scheduling throws synchronously", async () => {
            LN.schedule.mockImplementation(() => {
                throw new Error("bridge missing");
            });
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);
        });

        it("keeps the current schedule when planning fails", async () => {
            native.planNotifications.mockImplementation(() => {
                throw new Error("planner bug");
            });

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);

            expect(LN.getPending).not.toHaveBeenCalled();
            expect(LN.cancel).not.toHaveBeenCalled();
            expect(LN.schedule).not.toHaveBeenCalled();
            expect(warn).toHaveBeenCalled();
        });

        it("returns 0 when the permission check fails", async () => {
            LN.checkPermissions.mockRejectedValue(new Error("not implemented"));
            native.planNotifications.mockReturnValue(PLAN);

            await expect(service.syncNativeNotifications(makeUser(), T, NOW)).resolves.toBe(0);
            expect(LN.schedule).not.toHaveBeenCalled();
        });
    });

    describe("serialization", () => {
        it("runs concurrent calls one after another", async () => {
            native.planNotifications.mockReturnValueOnce([DAILY]).mockReturnValueOnce([STREAK, WEEKLY]);
            const gate = deferred<{ notifications: { id: number }[] }>();
            LN.schedule.mockImplementationOnce(() => gate.promise);

            const first = service.syncNativeNotifications(makeUser(), T, NOW);
            const second = service.syncNativeNotifications(makeUser(), T, NOW);
            await flush();

            // The first call waits inside `schedule`; the second has not started.
            expect(LN.schedule).toHaveBeenCalledTimes(1);
            expect(LN.checkPermissions).toHaveBeenCalledTimes(1);
            expect(native.planNotifications).toHaveBeenCalledTimes(1);
            expect(LN.getPending).toHaveBeenCalledTimes(1);

            gate.resolve({ notifications: [{ id: DAILY.id }] });
            await expect(first).resolves.toBe(1);
            await expect(second).resolves.toBe(2);

            expect(LN.schedule).toHaveBeenCalledTimes(2);
            expect(scheduled(1).map((notification) => notification.id)).toEqual([STREAK.id, WEEKLY.id]);
            expect(LN.checkPermissions.mock.invocationCallOrder[1]).toBeGreaterThan(LN.schedule.mock.invocationCallOrder[0]);
        });

        it("keeps going after a failed call", async () => {
            native.planNotifications.mockReturnValue(PLAN);
            const gate = deferred<never>();
            LN.schedule.mockImplementationOnce(() => gate.promise);

            const first = service.syncNativeNotifications(makeUser(), T, NOW);
            const second = service.syncNativeNotifications(makeUser(), T, NOW);
            await flush();
            gate.reject(new Error("schedule failed"));

            await expect(first).resolves.toBe(0);
            await expect(second).resolves.toBe(4);
        });

        it("lets cancelPendingNotifications wait for a running sync", async () => {
            native.planNotifications.mockReturnValue([DAILY]);
            LN.getPending.mockResolvedValue(pendingOf([DAILY.id]));
            const gate = deferred<{ notifications: { id: number }[] }>();
            LN.schedule.mockImplementationOnce(() => gate.promise);

            const sync = service.syncNativeNotifications(makeUser(), T, NOW);
            const cancel = service.cancelPendingNotifications();
            await flush();
            expect(LN.getPending).toHaveBeenCalledTimes(1);

            gate.resolve({ notifications: [{ id: DAILY.id }] });
            await sync;
            await cancel;

            expect(LN.getPending).toHaveBeenCalledTimes(2);
            const lastCancel = Math.max(...LN.cancel.mock.invocationCallOrder);
            expect(lastCancel).toBeGreaterThan(LN.schedule.mock.invocationCallOrder[0]);
        });
    });
});

describe("cancelPendingNotifications", () => {
    it("does nothing on the web", async () => {
        native.env.native = false;
        await expect(service.cancelPendingNotifications()).resolves.toBeUndefined();
        expect(LN.getPending).not.toHaveBeenCalled();
        expect(LN.cancel).not.toHaveBeenCalled();
    });

    it("cancels its planned notifications, the old reminder, and the test notification only", async () => {
        LN.getPending.mockResolvedValue(pendingOf([LEGACY_ID, 77, 2000, 5005, 65240, 6000, TEST_ID, 6001]));

        await service.cancelPendingNotifications();

        expect(LN.cancel).toHaveBeenCalledTimes(1);
        expect(cancelledIds()).toEqual([LEGACY_ID, 2000, 5005, 6000, TEST_ID]);
    });

    it("does not call cancel when nothing of this app is pending", async () => {
        LN.getPending.mockResolvedValue(pendingOf([1, 2, 3]));
        await service.cancelPendingNotifications();
        expect(LN.cancel).not.toHaveBeenCalled();
    });

    it("does not need permission", async () => {
        LN.checkPermissions.mockResolvedValue({ display: "denied" });
        LN.getPending.mockResolvedValue(pendingOf([LEGACY_ID]));

        await service.cancelPendingNotifications();

        expect(cancelledIds()).toEqual([LEGACY_ID]);
    });

    it("never throws when the plugin fails", async () => {
        LN.getPending.mockRejectedValue(new Error("storage broken"));
        LN.cancel.mockRejectedValue(new Error("cancel failed"));

        await expect(service.cancelPendingNotifications()).resolves.toBeUndefined();

        expect(cancelledIds()).toContain(TEST_ID);
        expect(cancelledIds()).toContain(LEGACY_ID);
        expect(warn).toHaveBeenCalled();
    });
});

describe("sendTestNotification", () => {
    it("does nothing on the web", async () => {
        native.env.native = false;
        await expect(service.sendTestNotification(T)).resolves.toBe(false);
        expect(LN.schedule).not.toHaveBeenCalled();
    });

    it("needs permission and never asks for it", async () => {
        LN.checkPermissions.mockResolvedValue({ display: "prompt" });

        await expect(service.sendTestNotification(T)).resolves.toBe(false);

        expect(LN.requestPermissions).not.toHaveBeenCalled();
        expect(LN.schedule).not.toHaveBeenCalled();
    });

    it("schedules the planner's test card five seconds from now", async () => {
        const before = Date.now();
        await expect(service.sendTestNotification(T)).resolves.toBe(true);
        const after = Date.now();

        expect(native.planTestNotification).toHaveBeenCalledTimes(1);
        expect(native.planTestNotification).toHaveBeenCalledWith(null, T, expect.any(Date));
        const card = native.planTestNotification.mock.results[0].value as NotificationCard;
        expect(LN.schedule).toHaveBeenCalledTimes(1);
        const [notification] = scheduled();
        expect(notification).toEqual({
            id: TEST_ID,
            title: card.title,
            body: card.body,
            largeBody: card.body,
            schedule: { at: expect.any(Date), allowWhileIdle: true },
            channelId: "reminders",
            smallIcon: SMALL_ICON,
            extra: { route: card.route },
            autoCancel: true,
        });
        const at = (notification.schedule as { at: Date }).at.getTime();
        expect(at).toBeGreaterThanOrEqual(before + 5000);
        expect(at).toBeLessThanOrEqual(after + 5000);
    });

    it("plans the card for the current learner", async () => {
        const user = makeUser();
        await service.sendTestNotification(T, user);
        expect(native.planTestNotification).toHaveBeenCalledWith(user, T, expect.any(Date));
    });

    it("schedules a rich card with its buttons", async () => {
        native.planTestNotification.mockReturnValue({
            title: "Question of the day",
            body: "Which colours are on the German flag?",
            largeBody: "Which colours are on the German flag?\n\nA  black, red, gold\nB  blue, white",
            summaryText: "No. 12 · Rights & freedoms",
            actionTypeId: "question",
            questionNum: "12",
            route: "/practice?question=12",
        });

        await expect(service.sendTestNotification(T, makeUser())).resolves.toBe(true);

        expect(LN.registerActionTypes).toHaveBeenCalledWith({ types: ACTION_TYPES_EN });
        expect(LN.registerActionTypes.mock.invocationCallOrder[0]).toBeLessThan(LN.schedule.mock.invocationCallOrder[0]);
        expect(scheduled()[0]).toEqual({
            id: TEST_ID,
            title: "Question of the day",
            body: "Which colours are on the German flag?",
            largeBody: "Which colours are on the German flag?\n\nA  black, red, gold\nB  blue, white",
            summaryText: "No. 12 · Rights & freedoms",
            actionTypeId: "question",
            schedule: { at: expect.any(Date), allowWhileIdle: true },
            channelId: "reminders",
            smallIcon: SMALL_ICON,
            extra: { route: "/practice?question=12", questionNum: "12" },
            autoCancel: true,
        });
    });

    it("schedules the card without buttons when registering them fails", async () => {
        LN.registerActionTypes.mockRejectedValue(new Error("register failed"));
        native.planTestNotification.mockReturnValue({ ...TEST_CARD, actionTypeId: "question" });

        await expect(service.sendTestNotification(T)).resolves.toBe(true);

        expect(scheduled()[0]).not.toHaveProperty("actionTypeId");
        expect(warn).toHaveBeenCalled();
    });

    it("creates the channels before the first notification", async () => {
        await service.sendTestNotification(T_DE);

        expect(LN.createChannel).toHaveBeenCalledTimes(4);
        expect(Math.max(...LN.createChannel.mock.invocationCallOrder)).toBeLessThan(LN.schedule.mock.invocationCallOrder[0]);
        expect(scheduled()[0].title).toBe("Benachrichtigungen funktionieren");
    });

    it("returns false when the planner throws", async () => {
        native.planTestNotification.mockImplementation(() => {
            throw new Error("planner bug");
        });

        await expect(service.sendTestNotification(T)).resolves.toBe(false);

        expect(LN.schedule).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalled();
    });

    it("is not cancelled by a later sync", async () => {
        await service.sendTestNotification(T);
        LN.getPending.mockResolvedValue(pendingOf([TEST_ID, 2000]));

        await service.syncNativeNotifications(makeUser(), T, NOW);

        expect(cancelledIds()).toEqual([2000]);
    });

    it("returns false when scheduling fails", async () => {
        LN.schedule.mockRejectedValue(new Error("schedule failed"));
        await expect(service.sendTestNotification(T)).resolves.toBe(false);
        expect(warn).toHaveBeenCalled();
    });
});

describe("addNotificationTapListener", () => {
    type Listener = (action: unknown) => void;

    function listener(): Listener {
        return LN.addListener.mock.calls[0][1] as Listener;
    }

    function tap(extra?: unknown) {
        return { actionId: "tap", notification: { id: 2000, title: "Title", body: "Body", extra } };
    }

    it("does nothing on the web", () => {
        native.env.native = false;
        const unsubscribe = service.addNotificationTapListener(vi.fn());

        expect(LN.addListener).not.toHaveBeenCalled();
        expect(() => unsubscribe()).not.toThrow();
    });

    it("opens the route stored on the notification", () => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        expect(LN.addListener).toHaveBeenCalledWith("localNotificationActionPerformed", expect.any(Function));
        listener()(tap({ route: "/practice" }));

        expect(onRoute).toHaveBeenCalledTimes(1);
        expect(onRoute).toHaveBeenCalledWith("/practice");
    });

    it.each(["/prepare?action=review", "/progress#achievements", "/mock", "/"])("keeps the app route %s", (route) => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        listener()(tap({ route }));

        expect(onRoute).toHaveBeenCalledWith(route);
    });

    it.each([
        ["a notification without extra data (the old daily reminder)", tap(undefined)],
        ["extra data without a route", tap({})],
        ["an empty route", tap({ route: "" })],
        ["a route that is not a string", tap({ route: 42 })],
        ["a relative path", tap({ route: "dashboard" })],
        ["a full URL", tap({ route: "https://example.com/" })],
        ["a protocol-relative URL", tap({ route: "//example.com" })],
        ["a backslash URL", tap({ route: "/\\example.com" })],
        ["a missing notification", { actionId: "tap", notification: null }],
        ["a missing action", undefined],
    ])("opens the dashboard for %s", (_label, action) => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        listener()(action);

        expect(onRoute).toHaveBeenCalledWith("/dashboard");
    });

    it("ignores dismiss actions", () => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        listener()({ ...tap({ route: "/mock" }), actionId: "dismiss" });

        expect(onRoute).not.toHaveBeenCalled();
    });

    it.each(["answer", "practice", "mock", "progress"])("opens the card's route for the %s button", (actionId) => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        listener()({ ...tap({ route: "/practice?question=12", questionNum: "12" }), actionId });

        expect(onRoute).toHaveBeenCalledTimes(1);
        expect(onRoute).toHaveBeenCalledWith("/practice?question=12");
    });

    it("opens the dashboard for a button whose route is unsafe", () => {
        const onRoute = vi.fn();
        service.addNotificationTapListener(onRoute);

        listener()({ ...tap({ route: "https://example.com/" }), actionId: "answer" });

        expect(onRoute).toHaveBeenCalledWith("/dashboard");
    });

    it("removes the listener when unsubscribed", async () => {
        const handle = { remove: vi.fn().mockResolvedValue(undefined) };
        LN.addListener.mockResolvedValue(handle);
        const onRoute = vi.fn();
        const unsubscribe = service.addNotificationTapListener(onRoute);
        await flush();

        unsubscribe();
        unsubscribe();
        listener()(tap({ route: "/mock" }));

        expect(handle.remove).toHaveBeenCalledTimes(1);
        expect(onRoute).not.toHaveBeenCalled();
    });

    it("removes the listener once registered when unsubscribed early", async () => {
        const handle = { remove: vi.fn().mockResolvedValue(undefined) };
        const registration = deferred<typeof handle>();
        LN.addListener.mockReturnValue(registration.promise);
        const onRoute = vi.fn();

        const unsubscribe = service.addNotificationTapListener(onRoute);
        unsubscribe();
        expect(handle.remove).not.toHaveBeenCalled();

        registration.resolve(handle);
        await flush();

        expect(handle.remove).toHaveBeenCalledTimes(1);
        listener()(tap({ route: "/mock" }));
        expect(onRoute).not.toHaveBeenCalled();
    });

    it("accepts a handle returned without a promise", async () => {
        const handle = { remove: vi.fn().mockResolvedValue(undefined) };
        LN.addListener.mockReturnValue(handle);

        const unsubscribe = service.addNotificationTapListener(vi.fn());
        await flush();
        unsubscribe();

        expect(handle.remove).toHaveBeenCalledTimes(1);
    });

    it("never throws when registering fails", async () => {
        LN.addListener.mockRejectedValue(new Error("not implemented"));
        const unsubscribe = service.addNotificationTapListener(vi.fn());
        await flush();

        expect(() => unsubscribe()).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });

    it("never throws when registering throws synchronously", () => {
        LN.addListener.mockImplementation(() => {
            throw new Error("bridge missing");
        });

        const unsubscribe = service.addNotificationTapListener(vi.fn());

        expect(() => unsubscribe()).not.toThrow();
        expect(warn).toHaveBeenCalled();
    });

    it("never throws when removing fails", async () => {
        const handle = { remove: vi.fn().mockRejectedValue(new Error("remove failed")) };
        LN.addListener.mockResolvedValue(handle);
        const unsubscribe = service.addNotificationTapListener(vi.fn());
        await flush();

        expect(() => unsubscribe()).not.toThrow();
        await flush();

        expect(handle.remove).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalled();
    });

    it("keeps listening when the route handler throws", () => {
        const onRoute = vi.fn().mockImplementationOnce(() => {
            throw new Error("router not ready");
        });
        service.addNotificationTapListener(onRoute);

        expect(() => listener()(tap({ route: "/mock" }))).not.toThrow();
        listener()(tap({ route: "/progress" }));

        expect(onRoute).toHaveBeenCalledTimes(2);
        expect(onRoute).toHaveBeenLastCalledWith("/progress");
        expect(warn).toHaveBeenCalled();
    });
});

describe("with the real planner", () => {
    type Planner = typeof import("@/utils/notification-planner");

    it("mocks the planner's real ids, and the test id stays outside them", async () => {
        const real = await vi.importActual<Planner>("@/utils/notification-planner");

        expect(real.plannedNotificationIds()).toEqual(native.plannerIds);
        expect(real.LEGACY_NOTIFICATION_ID).toBe(LEGACY_ID);
        expect(real.plannedNotificationIds()).not.toContain(TEST_ID);
    });

    it("schedules a real plan with translated texts on known channels", async () => {
        const real = await vi.importActual<Planner>("@/utils/notification-planner");
        const { getTranslations } = await import("@/data/data");
        const t = getTranslations("en") as Record<string, string>;
        native.planNotifications.mockImplementation(real.planNotifications);

        const count = await service.syncNativeNotifications(makeUser(), t, NOW);

        expect(count).toBeGreaterThan(0);
        const notifications = scheduled();
        expect(notifications).toHaveLength(count);
        for (const notification of notifications) {
            expect(native.plannerIds).toContain(notification.id);
            expect(["reminders", "streak", "exam", "progress"]).toContain(notification.channelId);
            expect((notification.schedule as { at: Date }).at.getTime()).toBeGreaterThan(NOW.getTime());
            expect((notification.extra as { route: string }).route).toMatch(/^\/[a-z]/);
            expect(notification.title).not.toMatch(/^notif_/);
            expect(notification.body).not.toMatch(/^notif_/);
        }
    });

    it("schedules the real test card for the learner", async () => {
        const real = await vi.importActual<Planner>("@/utils/notification-planner");
        const { getTranslations } = await import("@/data/data");
        const t = getTranslations("de") as Record<string, string>;
        native.planTestNotification.mockImplementation(real.planTestNotification);
        const user = makeUser();

        await expect(service.sendTestNotification(t, user)).resolves.toBe(true);

        const card = real.planTestNotification(user, t, new Date());
        const [notification] = scheduled();
        expect(notification).toMatchObject({ id: TEST_ID, title: card.title, body: card.body, channelId: "reminders" });
        expect((notification.extra as { route: string }).route).toBe(card.route);
        expect(card.route).toMatch(/^\/[a-z]/);
        expect(card.title).not.toMatch(/^notif_/);
        expect(card.body).not.toMatch(/^notif_/);
        if (card.actionTypeId) {
            expect(notification.actionTypeId).toBe(card.actionTypeId);
        }
    });
});

describe("haptics", () => {
    let haptics: HapticsService;

    beforeEach(async () => {
        haptics = await import("@/services/haptics");
    });

    it("plays the success, error, and tap effects in the app", async () => {
        await haptics.hapticSuccess(true);
        expect(native.Haptics.notification).toHaveBeenLastCalledWith({ type: "SUCCESS" });

        await haptics.hapticError(true);
        expect(native.Haptics.notification).toHaveBeenLastCalledWith({ type: "ERROR" });

        await haptics.hapticTap(true);
        expect(native.Haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
    });

    it("is enabled by default", async () => {
        await haptics.hapticSuccess();
        await haptics.hapticError();
        await haptics.hapticTap();

        expect(native.Haptics.notification).toHaveBeenCalledTimes(2);
        expect(native.Haptics.impact).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the learner turned haptics off", async () => {
        await haptics.hapticSuccess(false);
        await haptics.hapticError(false);
        await haptics.hapticTap(false);

        expect(native.Haptics.notification).not.toHaveBeenCalled();
        expect(native.Haptics.impact).not.toHaveBeenCalled();
    });

    it("does nothing on the web", async () => {
        native.env.native = false;

        await haptics.hapticSuccess(true);
        await haptics.hapticError(true);
        await haptics.hapticTap(true);

        expect(native.Haptics.notification).not.toHaveBeenCalled();
        expect(native.Haptics.impact).not.toHaveBeenCalled();
    });

    it("never throws when the plugin fails", async () => {
        native.Haptics.notification.mockRejectedValue(new Error("no vibrator"));
        native.Haptics.impact.mockImplementation(() => {
            throw new Error("bridge missing");
        });

        await expect(haptics.hapticSuccess(true)).resolves.toBeUndefined();
        await expect(haptics.hapticError(true)).resolves.toBeUndefined();
        await expect(haptics.hapticTap(true)).resolves.toBeUndefined();
        expect(warn).toHaveBeenCalledTimes(3);
    });

    it("treats a failing platform check as the web", async () => {
        native.Capacitor.isNativePlatform.mockImplementation(() => {
            throw new Error("no Capacitor");
        });

        await expect(haptics.hapticTap(true)).resolves.toBeUndefined();
        expect(native.Haptics.impact).not.toHaveBeenCalled();
    });
});
