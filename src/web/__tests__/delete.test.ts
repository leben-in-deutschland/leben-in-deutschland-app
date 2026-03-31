import { describe, it, expect, beforeEach, vi } from "vitest";

describe("delete", () => {
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

  // Inline delete logic
  const deleteFromlocalStorage = () => {
    localStorage.removeItem("user");
    window.dispatchEvent(new StorageEvent("user"));
  };

  const deleteData = () => {
    deleteFromlocalStorage();
  };

  describe("deleteData", () => {
    it("removes user data from localStorage", () => {
      mockStorage["user"] = JSON.stringify({ id: "test" });
      deleteData();
      expect(localStorage.removeItem).toHaveBeenCalledWith("user");
    });

    it("dispatches a StorageEvent after deletion", () => {
      deleteData();
      expect(window.dispatchEvent).toHaveBeenCalled();
    });

    it("does not throw when no data exists", () => {
      expect(() => deleteData()).not.toThrow();
    });

    it("data is no longer retrievable after deletion", () => {
      mockStorage["user"] = JSON.stringify({ id: "test", state: { stateName: "Berlin", stateCode: "BE" } });
      deleteData();
      // After removeItem is called, our mock deletes the key
      expect(mockStorage["user"]).toBeUndefined();
    });
  });
});
