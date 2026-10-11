import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BACK_EVENT, resolveBackAction, useBackButton } from "@/components/shell/use-back-button";

function press(): boolean {
    return window.dispatchEvent(new Event(BACK_EVENT, { cancelable: true }));
}

function Probe({ handler, enabled }: { handler: () => void; enabled?: boolean }) {
    useBackButton(handler, enabled);
    return null;
}

function mount(element: React.ReactElement): Root {
    const root = createRoot(document.createElement("div"));
    act(() => {
        root.render(element);
    });
    return root;
}

describe("resolveBackAction", () => {
    const base = { canGoBack: true, dialogOpen: false, intercepted: false };

    it("closes an open dialog before anything else", () => {
        expect(resolveBackAction({ ...base, pathname: "/mock.html", dialogOpen: true, intercepted: true })).toEqual({ type: "dismiss" });
    });

    it("leaves the press to a screen that claimed it", () => {
        expect(resolveBackAction({ ...base, pathname: "/mock.html", intercepted: true })).toEqual({ type: "intercepted" });
    });

    it("minimizes the app from the home tab", () => {
        expect(resolveBackAction({ ...base, pathname: "/dashboard.html" })).toEqual({ type: "minimize" });
        expect(resolveBackAction({ ...base, pathname: "/dashboard" })).toEqual({ type: "minimize" });
    });

    it("returns to home from the other tabs instead of walking the history", () => {
        for (const path of ["/practice.html", "/mock", "/progress/", "/settings.html?x=1"]) {
            expect(resolveBackAction({ ...base, pathname: path })).toEqual({ type: "navigate", path: "/dashboard" });
        }
    });

    it("returns a practice session to its hub, like the close button", () => {
        expect(resolveBackAction({ ...base, pathname: "/prepare.html?action=review" })).toEqual({ type: "navigate", path: "/practice" });
    });

    it("walks the history elsewhere and falls back to home when there is none", () => {
        expect(resolveBackAction({ ...base, pathname: "/somewhere.html" })).toEqual({ type: "history" });
        expect(resolveBackAction({ ...base, pathname: "/somewhere.html", canGoBack: false })).toEqual({ type: "navigate", path: "/dashboard" });
    });
});

describe("useBackButton", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("claims the press while enabled and runs the handler", () => {
        const handler = vi.fn();
        const root = mount(<Probe handler={handler} />);
        let unclaimed = true;
        act(() => {
            unclaimed = press();
        });
        expect(unclaimed).toBe(false);
        expect(handler).toHaveBeenCalledTimes(1);
        act(() => {
            root.unmount();
        });
        act(() => {
            unclaimed = press();
        });
        expect(unclaimed).toBe(true);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("ignores the press while disabled", () => {
        const handler = vi.fn();
        mount(<Probe handler={handler} enabled={false} />);
        let unclaimed = false;
        act(() => {
            unclaimed = press();
        });
        expect(unclaimed).toBe(true);
        expect(handler).not.toHaveBeenCalled();
    });
});
