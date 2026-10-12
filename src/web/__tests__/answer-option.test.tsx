// @vitest-environment jsdom
/* Render tests for the answer row: the default letter badge and the checkbox marker of the mock exam. */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerOption, type AnswerState } from "@/components/question/answer-option";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

async function render(node: React.ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function button(): HTMLButtonElement {
    return container.querySelector("button")!;
}

function marker(): HTMLElement | null {
    return container.querySelector('[data-marker="checkbox"]');
}

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe("AnswerOption letter marker (default)", () => {
    it("shows the upper-case letter and no checkbox", async () => {
        await render(
            <AnswerOption letter="a" onSelect={() => undefined}>
                Berlin
            </AnswerOption>,
        );
        expect(button().textContent).toBe("aBerlin");
        expect(button().querySelector("span")?.className).toContain("uppercase");
        expect(marker()).toBeNull();
        expect(button().getAttribute("aria-pressed")).toBe("false");
    });

    it("keeps the letter when selected and marks it pressed", async () => {
        await render(
            <AnswerOption letter="c" state="selected">
                Hamburg
            </AnswerOption>,
        );
        expect(button().getAttribute("aria-pressed")).toBe("true");
        expect(button().querySelector("span")?.textContent).toBe("c");
        expect(marker()).toBeNull();
    });
});

describe("AnswerOption checkbox marker", () => {
    it("renders an empty square box without a letter when idle", async () => {
        await render(
            <AnswerOption letter="a" marker="checkbox" onSelect={() => undefined}>
                2
            </AnswerOption>,
        );
        const box = marker()!;
        expect(box).not.toBeNull();
        expect(box.className).toContain("rounded-md");
        expect(box.className).toContain("h-8 w-8");
        expect(box.getAttribute("aria-hidden")).toBe("true");
        expect(box.querySelector("svg")).toBeNull();
        expect(box.textContent).toBe("");
        expect(button().textContent).toBe("2");
        expect(button().getAttribute("aria-pressed")).toBe("false");
    });

    it("shows a cross when selected and reports the pressed state", async () => {
        await render(
            <AnswerOption letter="c" marker="checkbox" state="selected" srStatus="selected">
                7
            </AnswerOption>,
        );
        const box = marker()!;
        expect(box.className).toContain("bg-primary");
        expect(box.querySelector("svg")).not.toBeNull();
        expect(button().getAttribute("aria-pressed")).toBe("true");
        expect(button().querySelector(".sr-only")?.textContent).toBe("selected");
        // Only the box carries the cross; no trailing wrong/correct badge while ungraded.
        expect(button().querySelectorAll("svg").length).toBe(1);
    });

    it.each<[AnswerState, string, boolean]>([
        ["correct", "bg-success", true],
        ["reveal", "bg-success-100", false],
        ["wrong", "bg-danger", true],
    ])("colours the graded %s box and keeps the trailing badge", async (state, className, pressed) => {
        await render(
            <AnswerOption letter="b" marker="checkbox" state={state} disabled>
                5
            </AnswerOption>,
        );
        const box = marker()!;
        expect(box.className).toContain(className);
        expect(box.querySelector("svg")).not.toBeNull();
        expect(button().getAttribute("aria-pressed")).toBe(String(pressed));
        expect(button().querySelectorAll("svg").length).toBe(2);
        expect(button().disabled).toBe(true);
    });

    it("stays empty when dimmed and still fires onSelect when enabled", async () => {
        const onSelect = vi.fn();
        await render(
            <AnswerOption letter="d" marker="checkbox" state="dimmed">
                10
            </AnswerOption>,
        );
        expect(marker()!.querySelector("svg")).toBeNull();

        await render(
            <AnswerOption letter="d" marker="checkbox" onSelect={onSelect}>
                10
            </AnswerOption>,
        );
        await act(async () => {
            button().click();
        });
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("does not fire onSelect when disabled", async () => {
        const onSelect = vi.fn();
        await render(
            <AnswerOption letter="a" marker="checkbox" onSelect={onSelect} disabled>
                2
            </AnswerOption>,
        );
        expect(button().disabled).toBe(true);
        expect(button().className).toContain("cursor-not-allowed");
        await act(async () => {
            button().click();
        });
        expect(onSelect).not.toHaveBeenCalled();
    });
});
