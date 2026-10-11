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

const bundled = evaluationData();
const newer: EvaluationData = { examDate: "21.07.2026", lastSyncAt: "15.10.2026 02:10:00", history: [] };
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
        expect(container.textContent).toContain("14. Juli 2026");
        expect(container.textContent).toContain(bundled.examDate.slice(-4));
        expect(mocks.refresh).toHaveBeenCalledTimes(1);
    });

    it("prefers a newer cached download", async () => {
        storeEvaluation(newer);
        await render();
        expect(container.textContent).toContain("21. Juli 2026");
        expect(container.textContent).not.toContain("14. Juli 2026");
    });

    it("ignores a cached download older than the bundled file", async () => {
        storeEvaluation(older);
        await render();
        expect(container.textContent).toContain("14. Juli 2026");
    });

    it("updates in place when the refresh stores new data", async () => {
        mocks.refresh.mockImplementation(async () => {
            storeEvaluation(newer);
            return newer;
        });
        await render();
        expect(container.textContent).toContain("21. Juli 2026");
    });
});
