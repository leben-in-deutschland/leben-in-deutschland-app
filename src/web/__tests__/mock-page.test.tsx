/*
 * Renders the real /mock page in jsdom with a record written by version 2.0
 * and walks through intro, exam, results, cancel, timeout, and review mode.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OFFICIAL_SHEETS } from "@/components/mock/official-sheets";
import { BACK_EVENT } from "@/components/shell/use-back-button";
import { getQuestion, getRelevantQuestions, getStateQuestions } from "@/utils/question-bank";
import { readUser } from "@/utils/user-store";
import type { MockTestProgress } from "@/types/user";

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(window.location.search),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => "/mock",
}));

const BE_NUMS = getRelevantQuestions("BE").map((q) => q.num);
const BE_STATE_NUMS = getStateQuestions("BE").map((q) => q.num);

function legacyMock(datetime: string, passed: boolean, cancelled = false): MockTestProgress {
    const nums = [...BE_NUMS.slice(100, 130), ...BE_STATE_NUMS.slice(0, 3)];
    return {
        datetime,
        timeTake: "1543",
        passed,
        cancelled,
        questions: nums.map((num, index) => {
            const question = getQuestion(num)!;
            if (index % 11 === 10) {
                return { answeredCorrectly: false, answerSelected: "", num, skipped: index % 2 === 0, flagged: false };
            }
            const correct = passed ? index % 5 !== 0 : index % 3 === 0;
            const wrongOption = question.solution === "a" ? "b" : "a";
            return { answeredCorrectly: correct, answerSelected: correct ? question.solution : wrongOption, num, skipped: false, flagged: index === 4 };
        }),
    };
}

const LEGACY_USER = {
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [],
    questionProgress: [],
    id: "",
    testProgress: [legacyMock("2026-10-01T17:12:00.000Z", false), legacyMock("2026-10-03T09:30:00.000Z", false, true), legacyMock("2026-10-07T19:05:00.000Z", true)],
    appLanguage: "de",
    appFirstTimeOpenDateTime: "2026-10-09T08:00:00.000Z",
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
    onboardingCompleted: true,
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function text(): string {
    return container?.textContent ?? "";
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function click(el: Element | null | undefined) {
    if (!el) throw new Error("element not found");
    act(() => {
        el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (el as HTMLElement).click();
    });
}

function byText(selector: string, needle: string): Element | undefined {
    return Array.from(document.querySelectorAll(selector)).find((el) => (el.textContent ?? "").includes(needle));
}

function byLabel(label: string): Element | undefined {
    return Array.from(document.querySelectorAll("[aria-label]")).find((el) => el.getAttribute("aria-label") === label);
}

async function mount(search = "") {
    window.history.replaceState({}, "", `/mock${search}`);
    const { default: MockPage } = await import("@/app/mock/page");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(<MockPage />);
    });
    await flush();
}

/** Intro → cover → running exam, the way a person starts a test. */
async function startExam() {
    click(byText("button", "Prüfung starten"));
    await flush();
    click(byText("button", "Test beginnen"));
    await flush();
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    window.localStorage.setItem("user", JSON.stringify(LEGACY_USER));
    window.matchMedia = window.matchMedia ?? ((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() } as any));
    (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
    (globalThis as any).IntersectionObserver = (globalThis as any).IntersectionObserver ?? class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
    window.scrollTo = vi.fn() as any;
    Element.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
    if (root) {
        await act(async () => root!.unmount());
    }
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
});

describe("mock page smoke", () => {
    it("renders the intro with recent exams", async () => {
        await mount();
        expect(text()).toContain("Probeprüfung");
        expect(text()).toContain("Letzte Prüfungen");
        expect(text()).toContain("1 von 2 bestanden");
        expect(container!.querySelectorAll('a[href^="/mock?review="]').length).toBe(2);
        expect(text()).toContain("Prüfung starten");
        expect(text()).toContain("wie auf dem echten Fragebogen gemischt");
    });

    it("links to both official BAMF sample sheets in a new tab and marks the selected test type", async () => {
        await mount();
        expect(text()).toContain("Offizielle Musterfragebögen");
        const links = Array.from(container!.querySelectorAll('a[target="_blank"]'));
        expect(links.length).toBe(2);
        expect(links.map((a) => a.getAttribute("href"))).toEqual([OFFICIAL_SHEETS.einbuergerung.href, OFFICIAL_SHEETS.lid.href]);
        expect(links.every((a) => a.getAttribute("rel") === "noopener noreferrer")).toBe(true);
        expect(links[0].textContent).toContain("Musterfragebogen Einbürgerungstest");
        expect(links[0].textContent).toContain("bamf.de · PDF");
        expect(links[0].textContent).toContain("Dein Testtyp");
        expect(links[1].textContent).toContain("Musterfragebogen Test „Leben in Deutschland“");
        expect(links[1].textContent).not.toContain("Dein Testtyp");
        expect(links[0].getAttribute("aria-label")).toBe("Musterfragebogen Einbürgerungstest (öffnet bamf.de in einem neuen Tab)");
    });

    it("shows the cover sheet with the test name, state, pass mark and marking example before the clock starts", async () => {
        await mount();
        click(byText("button", "Prüfung starten"));
        await flush();
        expect(container!.querySelector("h1")?.textContent).toBe("Einbürgerungstest");
        expect(text()).toContain("Testfragebogen");
        expect(text()).toContain("Musterfragebogen");
        expect(text()).toContain("Bundesland");
        expect(text()).toContain("Berlin");
        expect(text()).toContain("17 richtigen Antworten");
        expect(text()).toContain("60 Minuten");
        expect(text()).toContain("Anleitung");
        expect(text()).toContain("Beispiel – so kreuzt man an");
        expect(text()).toContain("Wie viele Tage hat die Woche?");
        // The demo marks "7" with a cross and cannot be changed.
        const demo = Array.from(container!.querySelectorAll('[aria-label="Beispielfrage"] button')) as HTMLButtonElement[];
        expect(demo.map((b) => b.querySelector(".answer-text")?.textContent)).toEqual(["2", "5", "7", "10"]);
        expect(demo[2].querySelector(".sr-only")?.textContent).toBe("ausgewählt");
        expect(demo.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false"]);
        expect(demo.every((b) => b.disabled)).toBe(true);
        expect(demo[2].querySelector('[data-marker="checkbox"] svg')).not.toBeNull();
        expect(demo[0].querySelector('[data-marker="checkbox"] svg')).toBeNull();
        // No running clock and no questions yet.
        expect(document.querySelector("[role=timer]")).toBeNull();
        expect(text()).not.toContain("1 / 33");
        expect(text()).toContain("Test beginnen");
    });

    it("returns from the cover to the intro with the back button and the hardware back key", async () => {
        await mount();
        click(byText("button", "Prüfung starten"));
        await flush();
        expect(text()).toContain("Test beginnen");
        click(byText("button", "Zurück"));
        await flush();
        expect(text()).toContain("Prüfung starten");
        expect(text()).not.toContain("Test beginnen");

        click(byText("button", "Prüfung starten"));
        await flush();
        expect(text()).toContain("Test beginnen");
        let claimed = false;
        act(() => {
            claimed = !window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }));
        });
        await flush();
        expect(claimed).toBe(true);
        expect(text()).toContain("Prüfung starten");
        expect(text()).not.toContain("Test beginnen");
        expect(readUser()!.testProgress.length).toBe(3);
    });

    it("starts the clock only when the test begins, not on the cover", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ["setInterval", "clearInterval", "Date"] });
        await mount();
        click(byText("button", "Prüfung starten"));
        await act(async () => {
            await Promise.resolve();
        });
        const begin = byText("button", "Test beginnen");
        expect(begin).toBeTruthy();
        await act(async () => {
            vi.advanceTimersByTime(5 * 60 * 1000);
        });
        click(begin);
        await act(async () => {
            await Promise.resolve();
        });
        expect(text()).toContain("60:00");
        await act(async () => {
            vi.advanceTimersByTime(60 * 1000);
        });
        expect(text()).toContain("59:00");
    });

    it("runs through an exam: answer, flag, map, submit, results", async () => {
        await mount();
        await startExam();
        expect(text()).toContain("1 / 33");
        expect(text()).toContain("60:00");
        expect(document.querySelector("header [role=timer]")).not.toBeNull();

        // Sheet heading: "Frage 1" plus the test name, but no catalogue number or topic hint.
        expect(container!.querySelector("header")?.textContent).toContain("Einbürgerungstest");
        const headingWrapper = container!.querySelector("#exam-question")!.parentElement!;
        expect(headingWrapper.querySelector("p")?.textContent).toBe("Frage 1");
        expect(headingWrapper.querySelectorAll("span").length).toBe(0);

        // answer the first question with a click
        const answerButtons = () => Array.from(container!.querySelectorAll('[role="group"] button'));
        expect(answerButtons().length).toBe(4);
        expect(container!.querySelectorAll('[role="group"] [data-marker="checkbox"]').length).toBe(4);
        // Only the answer text, no letter badge - whatever letter the answer itself starts with.
        expect(answerButtons()[0].textContent).toBe(answerButtons()[0].querySelector(".answer-text")?.textContent);
        click(answerButtons()[1]);
        await flush();
        expect(answerButtons()[1].getAttribute("aria-pressed")).toBe("true");
        expect(answerButtons()[1].querySelector('[data-marker="checkbox"] svg')).not.toBeNull();
        expect(answerButtons()[0].querySelector('[data-marker="checkbox"] svg')).toBeNull();
        expect(text()).toContain("1 von 33 beantwortet");

        // keyboard: flag, pick C, move right
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", bubbles: true }));
        });
        await flush();
        expect(byLabel("Markierung entfernen")).toBeTruthy();
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "3", bubbles: true }));
        });
        await flush();
        expect(answerButtons()[2].getAttribute("aria-pressed")).toBe("true");
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
        });
        await flush();
        expect(text()).toContain("2 / 33");
        click(byText("button", "Zurück"));
        await flush();
        expect(text()).toContain("1 / 33");

        // question map (mobile modal)
        click(byLabel("Fragenübersicht"));
        await flush();
        const cells = Array.from(document.querySelectorAll('[role="dialog"] ol button'));
        expect(cells.length).toBe(33);
        expect(cells[0].getAttribute("aria-current")).toBe("step");
        click(cells[32]);
        await flush();
        await flush();
        expect(text()).toContain("33 / 33");

        // last question shows submit; the dialog lists what is open
        click(byText("nav button", "Prüfung abgeben"));
        await flush();
        await flush();
        // The map dialog may still be animating out, so find the submit dialog by its title.
        const dialog = byText('[role="dialog"]', "Prüfung abgeben?");
        expect(dialog?.textContent).toContain("32 Fragen sind noch unbeantwortet.");
        expect(dialog?.textContent).toContain("1 Frage ist markiert.");
        click(byText('[role="dialog"] button', "Trotzdem abgeben"));
        await flush();
        await flush();

        expect(text()).toContain("Nicht bestanden");
        expect(text()).toContain("Bestehensgrenze: 17 von 33 richtig");
        expect(text()).toContain("Nach Thema");
        expect(text()).toContain("Deine Antworten");
        const user = readUser()!;
        expect(user.testProgress.length).toBe(4);
        const saved = user.testProgress[3];
        expect(saved.passMark).toBe(17);
        expect(saved.questions.filter((q) => q.flagged).length).toBe(1);
        expect(saved.questions.filter((q) => !q.skipped).length).toBe(1);
        expect(saved.cancelled).toBe(false);

        // filters and accordion
        const reviewItems = () => container!.querySelectorAll('section[aria-labelledby="exam-review-heading"] button[aria-expanded]');
        expect(reviewItems().length).toBe(33);
        click(byText('[role="radiogroup"] button, [role="radio"]', "Unbeantwortet"));
        await flush();
        expect(reviewItems().length).toBe(32);
        click(reviewItems()[0]);
        await flush();
        await flush();
        const reviewAnswers = container!.querySelectorAll('section[aria-labelledby="exam-review-heading"] [aria-pressed]');
        expect(reviewAnswers.length).toBe(4);
        expect(Array.from(reviewAnswers).every((el) => (el as HTMLButtonElement).disabled)).toBe(true);
        // The one answered question is random, so the wrong filter depends on the draw.
        const wrongCount = saved.questions.filter((q) => !q.skipped && q.answeredCorrectly === false).length;
        const wrongChip = byText('[role="radiogroup"] button, [role="radio"]', "Falsch") as HTMLButtonElement;
        expect(wrongChip.textContent).toContain(`· ${wrongCount}`);
        click(byText('[role="radiogroup"] button, [role="radio"]', "Markiert"));
        await flush();
        expect(reviewItems().length).toBe(1);

        click(byText("button", "Neue Prüfung"));
        await flush();
        expect(text()).toContain("Prüfung starten");
    });

    it("cancels an exam from the exit dialog and shows the cancelled result", async () => {
        await mount();
        await startExam();
        click(byLabel("Beenden"));
        await flush();
        click(byText('[role="dialog"] button', "Prüfung beenden"));
        await flush();
        await flush();
        expect(text()).toContain("Prüfung abgebrochen");
        const user = readUser()!;
        expect(user.testProgress[3].cancelled).toBe(true);
    });

    it("auto-submits when the timer runs out", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ["setInterval", "clearInterval", "Date"] });
        await mount();
        click(byText("button", "Prüfung starten"));
        await act(async () => {
            await Promise.resolve();
        });
        click(byText("button", "Test beginnen"));
        await act(async () => {
            await Promise.resolve();
        });
        expect(text()).toContain("60:00");
        await act(async () => {
            vi.advanceTimersByTime(55 * 60 * 1000 + 1000);
        });
        expect(text()).toContain("04:59");
        await act(async () => {
            vi.advanceTimersByTime(5 * 60 * 1000);
        });
        await act(async () => {
            await Promise.resolve();
        });
        expect(text()).toContain("Die Zeit ist um");
        const user = readUser()!;
        expect(user.testProgress.length).toBe(4);
        expect(Number(user.testProgress[3].timeTake)).toBeGreaterThanOrEqual(3600);
    });

    it("renders a stored legacy exam in review mode and handles unknown keys", async () => {
        await mount(`?review=${encodeURIComponent("2026-10-07T19:05:00.000Z")}`);
        expect(text()).toContain("Prüfung ansehen");
        expect(text()).toContain("Bestanden");
        expect(text()).toContain("Bestehensgrenze: 17 von 33 richtig");
        expect(text()).toContain("25:43");
        expect(container!.querySelector('a[href="/mock"]')).not.toBeNull();
        expect(container!.querySelector('a[href="/progress"]')).not.toBeNull();
        await act(async () => root!.unmount());
        root = null;
        container?.remove();

        await mount(`?review=nope`);
        expect(text()).toContain("Prüfung nicht gefunden");
    });

    it("renders a cancelled legacy exam in review mode", async () => {
        await mount(`?review=${encodeURIComponent("2026-10-03T09:30:00.000Z")}`);
        expect(text()).toContain("Prüfung abgebrochen");
        expect(text()).toContain("Abgebrochen");
    });
});
