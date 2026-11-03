// @vitest-environment node
/*
 * src/catalogue/lib/http.mjs is the one way the BAMF scripts talk to bamf.de
 * (scripts/bamf-data-sync.mjs, src/catalogue/check.mjs and watch.mjs). The
 * PULSE watches in .pulse/automations/ queue a job whenever their script
 * prints to stdout, so a connection reset that the built-in retry recovers
 * from must be reported on stderr only - on 2026-11-03 a retry notice on
 * stdout queued a Prüfstellen and a catalogue job although nothing had
 * changed. fetch is stubbed; nothing here touches the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, HttpError } from "../../catalogue/lib/http.mjs";

const URL_UNDER_TEST = "https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BB.xlsx";

function connectionReset(): TypeError {
    return Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
}

describe("bamf.de GET helper", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("retries a reset connection once and reports the retry on stderr, never stdout", async () => {
        const fetchMock = vi.fn().mockRejectedValueOnce(connectionReset()).mockResolvedValueOnce(new Response("ok", { status: 200 }));
        vi.stubGlobal("fetch", fetchMock);
        const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
        const stderr = vi.spyOn(console, "error").mockImplementation(() => {});

        const pending = get(URL_UNDER_TEST);
        await vi.advanceTimersByTimeAsync(3_000);
        const response = await pending;

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(stdout).not.toHaveBeenCalled();
        expect(stderr).toHaveBeenCalledWith("  ! GET /SharedDocs/Anlagen/DE/Integration/Einbuergerung/Pruefstellen-BB.xlsx failed: ECONNRESET; retrying in 3 s");
    });

    it("gives up after the one retry and throws, still printing nothing on stdout", async () => {
        const fetchMock = vi.fn().mockRejectedValue(connectionReset());
        vi.stubGlobal("fetch", fetchMock);
        const stdout = vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});

        const pending = get(URL_UNDER_TEST);
        const outcome = expect(pending).rejects.toThrow(HttpError);
        await vi.advanceTimersByTimeAsync(3_000);
        await outcome;

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(stdout).not.toHaveBeenCalled();
    });
});
