/*
 * The home card shows the newest BAMF status we know: the bundled file by
 * default, a fresher download when one is cached, and it updates in place
 * when the refresh finishes.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluationData } from "@/types/evaluation";
import { storeEvaluation } from "@/utils/evaluation-store";

const mocks = vi.hoisted(() => ({
    refresh: vi.fn(async (): Promise<EvaluationData | null> => null),
}));

vi.mock("@/services/evaluation", () => ({
    refreshEvaluation: mocks.refresh,
    evaluationRefreshSupported: () => true,
}));

import { evaluationData, getTranslations } from "@/data/data";
import { EvaluationStatus } from "@/components/home/evaluation-status";
import { useEvaluation } from "@/components/home/use-evaluation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Card() {
    const data = useEvaluation();
    return <EvaluationStatus data={data} language="de" t={getTranslations("de") as unknown as Record<string, string>} />;
}

// The bundled file is re-synced from BAMF regularly, so expectations derive from it
// instead of pinning one sync's dates.
const bundled = evaluationData();

function germanDate(value: string): Date {
    const [day, month, year] = value.trim().split(" ")[0].split(".").map(Number);
    return new Date(year, month - 1, day);
}

function shiftDays(value: string, days: number): string {
    const date = germanDate(value);
    date.setDate(date.getDate() + days);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** How the German card writes an exam date, e.g. "14. Juli 2026". */
function longGerman(value: string): string {
    return germanDate(value).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
}

const newer: EvaluationData = {
    examDate: shiftDays(bundled.examDate, 7),
    lastSyncAt: `${shiftDays(bundled.lastSyncAt, 1)} 02:10:00`,
    history: [],
};
const older: EvaluationData = { examDate: "01.01.2020", lastSyncAt: "01.02.2020 02:10:00", history: [] };

describe("home evaluation card", () => {
    let root: Root | null = null;
    let container: HTMLDivElement;

    beforeEach(() => {
        localStorage.clear();
        mocks.refresh.mockReset().mockResolvedValue(null);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root?.unmount());
        container.remove();
    });

    async function render() {
        await act(async () => {
            root!.render(<Card />);
        });
    }

    it("shows the bundled date and asks for a refresh once", async () => {
        await render();
        expect(container.textContent).toContain(longGerman(bundled.examDate));
        expect(container.textContent).toContain(bundled.examDate.slice(-4));
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it("prefers a newer cached download", async () => {
        storeEvaluation(newer);
        await render();
        expect(container.textContent).toContain(longGerman(newer.examDate));
        expect(container.textContent).not.toContain(longGerman(bundled.examDate));
    });

    it("ignores a cached download older than the bundled file", async () => {
        storeEvaluation(older);
        await render();
        expect(container.textContent).toContain(longGerman(bundled.examDate));
        expect(container.textContent).not.toContain(longGerman(older.examDate));
    });

    it("updates in place when the refresh stores new data", async () => {
        mocks.refresh.mockImplementation(async () => {
            storeEvaluation(newer);
            return newer;
        });
        await render();
        expect(container.textContent).toContain(longGerman(newer.examDate));
    });
});
