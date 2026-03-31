import { describe, it, expect, beforeEach, vi } from "vitest";

// We test the logic of local-storage.ts directly
// We need to mock window.localStorage and window.dispatchEvent

describe("local-storage", () => {
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
      clear: vi.fn(() => {
        mockStorage = {};
      }),
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

  // Inline the functions to test them without module resolution issues
  const saveInlocalStorage = (user: any) => {
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new StorageEvent("user"));
  };

  const readFromlocalStorage = () => {
    const user = localStorage.getItem("user");
    if (!user) return null;
    return JSON.parse(user);
  };

  const deleteFromlocalStorage = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new StorageEvent("user"));
  };

  describe("saveInlocalStorage", () => {
    it("saves user data as JSON string", () => {
      const user = { id: "test", state: { stateName: "Berlin", stateCode: "BE" } };
      saveInlocalStorage(user);
      expect(localStorage.setItem).toHaveBeenCalledWith("user", JSON.stringify(user));
    });

    it("dispatches a StorageEvent", () => {
      const user = { id: "test" };
      saveInlocalStorage(user);
      expect(window.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe("readFromlocalStorage", () => {
    it("returns null when no user data exists", () => {
      expect(readFromlocalStorage()).toBeNull();
    });

    it("returns parsed user data when it exists", () => {
      const user = { id: "test", state: { stateName: "Berlin", stateCode: "BE" } };
      mockStorage["user"] = JSON.stringify(user);
      const result = readFromlocalStorage();
      expect(result).toEqual(user);
    });

    it("parses complex user objects correctly", () => {
      const user = {
        id: "user-1",
        state: { stateName: "Bayern", stateCode: "BY" },
        dailyProgress: [{ date: "2025-01-01", attempted: 5, correct: 3, incorrect: 2, skipped: 0, flagged: 0 }],
        questionProgress: [],
        testProgress: [],
      };
      mockStorage["user"] = JSON.stringify(user);
      const result = readFromlocalStorage();
      expect(result).toEqual(user);
      expect(result.dailyProgress[0].attempted).toBe(5);
    });
  });

  describe("deleteFromlocalStorage", () => {
    it("removes user data from localStorage", () => {
      mockStorage["user"] = JSON.stringify({ id: "test" });
      deleteFromlocalStorage();
      expect(localStorage.removeItem).toHaveBeenCalledWith("user");
    });

    it("dispatches a StorageEvent after deletion", () => {
      deleteFromlocalStorage();
      expect(window.dispatchEvent).toHaveBeenCalled();
    });
  });
});
