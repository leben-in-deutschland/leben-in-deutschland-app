import { describe, expect, it } from "vitest";
import { appleAppId, shouldAskForReview } from "@/components/shell/native-prompts";
import { User } from "@/types/user";

const NOW = new Date("2026-10-09T12:00:00.000Z");

function record(overrides: Partial<User> = {}): User {
    return {
        id: "legacy",
        state: { stateCode: "BE", stateName: "Berlin" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "de",
        // Legacy records keep dates as ISO strings after the JSON round trip.
        appFirstTimeOpenDateTime: "2026-10-01T08:00:00.000Z" as unknown as Date,
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        ...overrides,
    };
}

describe("shouldAskForReview", () => {
    it("asks two days after the first start when never asked before", () => {
        expect(shouldAskForReview(record(), NOW)).toBe(true);
    });

    it("waits two days after the first start", () => {
        const fresh = record({ appFirstTimeOpenDateTime: "2026-10-08T08:00:00.000Z" as unknown as Date });
        expect(shouldAskForReview(fresh, NOW)).toBe(false);
    });

    it("never asks again after a review or two refusals", () => {
        expect(shouldAskForReview(record({ userReviewed: true }), NOW)).toBe(false);
        expect(shouldAskForReview(record({ reviewNoCount: 2 }), NOW)).toBe(false);
        expect(shouldAskForReview(record({ reviewNoCount: 1 }), NOW)).toBe(true);
    });

    it("waits four days between prompts, accepting legacy string dates", () => {
        const recent = record({ lastReviewPromptDateTime: "2026-10-07T12:00:00.000Z" as unknown as Date });
        expect(shouldAskForReview(recent, NOW)).toBe(false);
        const old = record({ lastReviewPromptDateTime: "2026-10-04T12:00:00.000Z" as unknown as Date });
        expect(shouldAskForReview(old, NOW)).toBe(true);
    });

    it("stays quiet when the first-start date is damaged or not stamped yet", () => {
        expect(shouldAskForReview(record({ appFirstTimeOpenDateTime: "garbage" as unknown as Date }), NOW)).toBe(false);
        expect(shouldAskForReview(record({ appFirstTimeOpenDateTime: new Date(0) }), NOW)).toBe(false);
    });
});

describe("appleAppId", () => {
    it("reads the numeric Apple ID from the App Store URL", () => {
        expect(appleAppId("https://apps.apple.com/de/app/id6740000001")).toBe("6740000001");
        expect(appleAppId("https://apps.apple.com/de/app/leben-in-deutschland/id6740000001?platform=iphone")).toBe("6740000001");
        expect(appleAppId("https://apps.apple.com/app/id6740000001/")).toBe("6740000001");
    });

    it("is undefined before the App Store URL is set or when it carries no id", () => {
        expect(appleAppId(undefined)).toBeUndefined();
        expect(appleAppId("")).toBeUndefined();
        expect(appleAppId("https://play.google.com/store/apps/details?id=org.lebenindeutschland.app")).toBeUndefined();
    });
});
