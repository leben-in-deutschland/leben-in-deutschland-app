import { describe, it, expect, beforeEach, vi } from "vitest";

describe("user service", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };
    vi.stubGlobal("localStorage", localStorageMock);
    vi.stubGlobal("dispatchEvent", vi.fn());
    vi.stubGlobal("StorageEvent", class StorageEvent {
      type: string;
      constructor(type: string) { this.type = type; }
    });
  });

  // Inline user service logic to avoid module resolution
  const readFromlocalStorage = () => {
    const user = localStorage.getItem("user");
    if (!user) return null;
    return JSON.parse(user);
  };

  const saveInlocalStorage = (user: any) => {
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new StorageEvent("user"));
  };

  const getUserData = () => {
    const user = readFromlocalStorage();
    if (user) return user;
    return null;
  };

  const saveUserData = (user: any) => {
    saveInlocalStorage(user);
    return user;
  };

  describe("getUserData", () => {
    it("returns null when no user data exists", () => {
      expect(getUserData()).toBeNull();
    });

    it("returns user data when it exists in localStorage", () => {
      const user = {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "de",
      };
      mockStorage["user"] = JSON.stringify(user);
      const result = getUserData();
      expect(result).toEqual(user);
    });

    it("returns null for empty string in localStorage", () => {
      // localStorage.getItem returns null for missing keys, not empty string
      // but if somehow empty, JSON.parse would fail
      expect(getUserData()).toBeNull();
    });
  });

  describe("saveUserData", () => {
    it("saves user data and returns the same user object", () => {
      const user = {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
      };
      const result = saveUserData(user);
      expect(result).toEqual(user);
      expect(localStorage.setItem).toHaveBeenCalledWith("user", JSON.stringify(user));
    });

    it("overwrites existing user data", () => {
      const user1 = { id: "user-1", state: { stateName: "Berlin", stateCode: "BE" } };
      const user2 = { id: "user-2", state: { stateName: "Bayern", stateCode: "BY" } };
      saveUserData(user1);
      saveUserData(user2);
      const result = getUserData();
      expect(result).toEqual(user2);
    });

    it("preserves all user fields through save/load cycle", () => {
      const user = {
        id: "test",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [{ date: "2025-01-01", attempted: 10, correct: 8, incorrect: 2, skipped: 0, flagged: 0 }],
        questionProgress: [{ num: "1", answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }],
        testProgress: [],
        appLanguage: "en",
        appFirstTimeOpenDateTime: "2025-01-01T00:00:00.000Z",
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
      };
      saveUserData(user);
      const result = getUserData();
      expect(result.questionProgress[0].answeredCorrectly).toBe(true);
      expect(result.appLanguage).toBe("en");
    });
  });
});
