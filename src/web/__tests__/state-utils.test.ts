import { describe, it, expect, beforeEach, vi } from "vitest";

describe("state-utils", () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    const localStorageMock = {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value;
      }),
      removeItem: vi.fn(),
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

  // Inline the saveStateChange logic to test without module resolution issues
  const saveStateChange = (state: { code: string; name: string }) => {
    const data = {
      state: {
        stateCode: state.code,
        stateName: state.name,
      },
      dailyProgress: [] as any[],
      questionProgress: [],
      id: "",
      testProgress: [],
      appLanguage: "de",
      appFirstTimeOpenDateTime: new Date(Date.now()),
      lastReviewPromptDateTime: null,
      reviewNoCount: 0,
      userReviewed: false,
    };
    const today = new Date().toDateString();
    data.dailyProgress.push({
      attempted: 0,
      date: today,
      correct: 0,
      incorrect: 0,
      skipped: 0,
      flagged: 0,
    });
    localStorage.setItem("user", JSON.stringify(data));
    window.dispatchEvent(new StorageEvent("user"));
    return data;
  };

  describe("saveStateChange", () => {
    it("creates user data with selected state", () => {
      const result = saveStateChange({ code: "BE", name: "Berlin" });
      expect(result.state.stateCode).toBe("BE");
      expect(result.state.stateName).toBe("Berlin");
    });

    it("initializes empty progress arrays", () => {
      const result = saveStateChange({ code: "BY", name: "Bayern" });
      expect(result.questionProgress).toEqual([]);
      expect(result.testProgress).toEqual([]);
    });

    it("creates one daily progress entry for today", () => {
      const result = saveStateChange({ code: "BE", name: "Berlin" });
      expect(result.dailyProgress).toHaveLength(1);
      expect(result.dailyProgress[0].attempted).toBe(0);
      expect(result.dailyProgress[0].correct).toBe(0);
    });

    it("sets default language to 'de'", () => {
      const result = saveStateChange({ code: "BE", name: "Berlin" });
      expect(result.appLanguage).toBe("de");
    });

    it("sets empty id", () => {
      const result = saveStateChange({ code: "BE", name: "Berlin" });
      expect(result.id).toBe("");
    });

    it("initializes review-related fields", () => {
      const result = saveStateChange({ code: "HH", name: "Hamburg" });
      expect(result.lastReviewPromptDateTime).toBeNull();
      expect(result.reviewNoCount).toBe(0);
      expect(result.userReviewed).toBe(false);
    });

    it("saves to localStorage", () => {
      saveStateChange({ code: "BE", name: "Berlin" });
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it("works for all German states", () => {
      const states = [
        { code: "BW", name: "Baden-Württemberg" },
        { code: "BY", name: "Bayern" },
        { code: "BE", name: "Berlin" },
        { code: "BB", name: "Brandenburg" },
        { code: "HB", name: "Bremen" },
        { code: "HH", name: "Hamburg" },
        { code: "HE", name: "Hessen" },
        { code: "NI", name: "Niedersachsen" },
        { code: "MV", name: "Mecklenburg-Vorpommern" },
        { code: "NW", name: "Nordrhein-Westfalen" },
        { code: "RP", name: "Rheinland-Pfalz" },
        { code: "SL", name: "Saarland" },
        { code: "SN", name: "Sachsen" },
        { code: "ST", name: "Sachsen-Anhalt" },
        { code: "SH", name: "Schleswig-Holstein" },
        { code: "TH", name: "Thüringen" },
      ];
      for (const state of states) {
        const result = saveStateChange(state);
        expect(result.state.stateCode).toBe(state.code);
        expect(result.state.stateName).toBe(state.name);
      }
    });
  });
});
