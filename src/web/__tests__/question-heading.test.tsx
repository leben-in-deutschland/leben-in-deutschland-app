// @vitest-environment jsdom
/*
 * The question picture in practice and in the mock exam carries the same alt
 * text as the catalogue list: the question number and, on four-picture
 * questions, the official captions "Bild 1" .. "Bild 4", so a screen-reader
 * user can tell the four picture options apart.
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import common from "@/data/translations/areas/common.de.json";
import { QuestionHeading } from "@/components/question/question-heading";
import { questionsData } from "@/data/data";
import type { Question } from "@/types/question";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t = common as Record<string, string>;
let root: Root;
let container: HTMLDivElement;

function question(num: string): Question {
    return questionsData().find((entry) => entry.num === num)!;
}

async function render(node: React.ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

function alt(): string | null {
    return container.querySelector("img")?.getAttribute("alt") ?? null;
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

describe("QuestionHeading picture alt text", () => {
    it("practice: names the catalogue number and the Bild 1..4 captions", async () => {
        await render(<QuestionHeading question={question("56")} t={t} />);
        expect(alt()).toBe("Bild zur Frage (Frage 56): Bild 1, Bild 2, Bild 3, Bild 4");
    });

    it("practice: a single picture names the catalogue number", async () => {
        await render(<QuestionHeading question={question("62")} t={t} />);
        expect(alt()).toBe("Bild zur Frage (Frage 62)");
    });

    it("mock exam: uses the sheet label, not the catalogue number", async () => {
        await render(<QuestionHeading question={question("BY-1")} t={t} variant="sheet" label="Frage 31" />);
        expect(alt()).toBe("Bild zur Frage (Frage 31): Bild 1, Bild 2, Bild 3, Bild 4");
        expect(container.textContent).not.toContain("BY-1");
    });

    it("renders no picture for a question without one", async () => {
        const plain = questionsData().find((entry) => entry.image === "-")!;
        await render(<QuestionHeading question={plain} t={t} />);
        expect(alt()).toBeNull();
    });
});
