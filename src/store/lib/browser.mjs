// Headless Chromium (Microsoft Edge on this machine) driven over the DevTools
// protocol with Node's built-in WebSocket. No npm packages needed.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
    process.env.LID_BROWSER,
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter(Boolean);

function findBrowser() {
    const found = CANDIDATES.find((candidate) => existsSync(candidate));
    if (!found) {
        throw new Error(`No Chromium-based browser found. Set LID_BROWSER to the executable path.`);
    }
    return found;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class Connection {
    constructor(socket) {
        this.socket = socket;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        socket.addEventListener("message", (event) => this.onMessage(JSON.parse(event.data)));
    }

    onMessage(message) {
        if (message.id !== undefined) {
            const entry = this.pending.get(message.id);
            if (!entry) {
                return;
            }
            this.pending.delete(message.id);
            if (message.error) {
                entry.reject(new Error(`${entry.method}: ${message.error.message}`));
            } else {
                entry.resolve(message.result);
            }
            return;
        }
        const key = `${message.sessionId ?? ""}:${message.method}`;
        for (const listener of this.listeners.get(key) ?? []) {
            listener(message.params);
        }
    }

    send(method, params = {}, sessionId) {
        const id = this.nextId++;
        const payload = { id, method, params };
        if (sessionId) {
            payload.sessionId = sessionId;
        }
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, method });
            this.socket.send(JSON.stringify(payload));
        });
    }

    on(sessionId, method, listener) {
        const key = `${sessionId ?? ""}:${method}`;
        const list = this.listeners.get(key) ?? [];
        list.push(listener);
        this.listeners.set(key, list);
        return () => this.listeners.set(key, (this.listeners.get(key) ?? []).filter((item) => item !== listener));
    }
}

class Page {
    constructor(connection, sessionId, targetId) {
        this.connection = connection;
        this.sessionId = sessionId;
        this.targetId = targetId;
        this.initScripts = [];
    }

    send(method, params) {
        return this.connection.send(method, params, this.sessionId);
    }

    on(method, listener) {
        return this.connection.on(this.sessionId, method, listener);
    }

    async enable() {
        await this.send("Page.enable");
        await this.send("Runtime.enable");
        await this.send("Network.enable");
    }

    /** Emulates a device. `scale` is the device pixel ratio. */
    async setDevice({ width, height, scale, mobile = true, userAgent }) {
        await this.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile, screenWidth: width, screenHeight: height });
        await this.send("Emulation.setTouchEmulationEnabled", { enabled: mobile, maxTouchPoints: mobile ? 5 : 1 });
        if (userAgent) {
            await this.send("Emulation.setUserAgentOverride", { userAgent });
        }
    }

    async setColorScheme(scheme) {
        await this.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: scheme }] });
    }

    /** Runs `source` before any page script on every new document. Replaces earlier init scripts. */
    async setInitScript(source) {
        for (const identifier of this.initScripts) {
            await this.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
        }
        this.initScripts = [];
        const { identifier } = await this.send("Page.addScriptToEvaluateOnNewDocument", { source });
        this.initScripts.push(identifier);
    }

    async navigate(url, { timeout = 20000 } = {}) {
        let loaded;
        const done = new Promise((resolve) => {
            loaded = resolve;
        });
        const off = this.on("Page.loadEventFired", () => loaded());
        try {
            const result = await this.send("Page.navigate", { url });
            if (result.errorText) {
                throw new Error(`navigate ${url}: ${result.errorText}`);
            }
            await Promise.race([done, sleep(timeout).then(() => Promise.reject(new Error(`navigate ${url}: load timeout`)))]);
        } finally {
            off();
        }
    }

    async evaluate(expression, { awaitPromise = true } = {}) {
        const { result, exceptionDetails } = await this.send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
        if (exceptionDetails) {
            throw new Error(`evaluate failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
        }
        return result.value;
    }

    /** Waits until `expression` is truthy (polled every 100 ms). */
    async waitFor(expression, { timeout = 15000, label = expression } = {}) {
        const started = Date.now();
        while (Date.now() - started < timeout) {
            if (await this.evaluate(`Boolean(${expression})`)) {
                return;
            }
            await sleep(100);
        }
        throw new Error(`timed out waiting for ${label}`);
    }

    /** Waits for fonts, two animation frames, and a short pause so transitions finish. */
    async settle(ms = 400) {
        await this.evaluate(`document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))`);
        await sleep(ms);
    }

    async click(selector, { index = 0 } = {}) {
        const box = await this.evaluate(`(() => {
            const nodes = document.querySelectorAll(${JSON.stringify(selector)});
            const node = nodes[${index}];
            if (!node) return null;
            node.scrollIntoView({ block: "center", inline: "nearest" });
            const r = node.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        if (!box) {
            throw new Error(`click: no element for ${selector}[${index}]`);
        }
        await this.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y });
        await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
        await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
    }

    async screenshot({ clip, format = "png", quality } = {}) {
        const params = { format, captureBeyondViewport: false, fromSurface: true };
        if (clip) {
            params.clip = { ...clip, scale: clip.scale ?? 1 };
        }
        if (quality !== undefined) {
            params.quality = quality;
        }
        const { data } = await this.send("Page.captureScreenshot", params);
        return Buffer.from(data, "base64");
    }

    async close() {
        await this.connection.send("Target.closeTarget", { targetId: this.targetId });
    }
}

/** Launches the browser headless; returns `{ newPage, close }`. */
export async function launchBrowser({ headless = true } = {}) {
    const executable = findBrowser();
    const profile = mkdtempSync(path.join(os.tmpdir(), "lid-store-edge-"));
    const args = [
        headless ? "--headless=new" : "",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-features=msEdgeSidebarV2,msHubApps,msEdgeShoppingAssist",
        "--hide-scrollbars",
        "--mute-audio",
        "--force-color-profile=srgb",
        "--font-render-hinting=none",
        "--window-size=1400,1000",
        "about:blank",
    ].filter(Boolean);
    const child = spawn(executable, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });

    const portFile = path.join(profile, "DevToolsActivePort");
    const started = Date.now();
    while (!existsSync(portFile)) {
        if (child.exitCode !== null) {
            throw new Error(`browser exited early (${child.exitCode}): ${stderr.slice(-800)}`);
        }
        if (Date.now() - started > 30000) {
            child.kill("SIGKILL");
            throw new Error(`browser did not open its DevTools port: ${stderr.slice(-800)}`);
        }
        await sleep(100);
    }
    const [port, browserPath] = readFileSync(portFile, "utf8").trim().split("\n");
    const socket = new WebSocket(`ws://127.0.0.1:${port}${browserPath}`);
    await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", () => reject(new Error("could not connect to the browser")), { once: true });
    });
    const connection = new Connection(socket);

    return {
        async newPage() {
            const { targetId } = await connection.send("Target.createTarget", { url: "about:blank" });
            const { sessionId } = await connection.send("Target.attachToTarget", { targetId, flatten: true });
            const page = new Page(connection, sessionId, targetId);
            await page.enable();
            return page;
        },
        async close() {
            try {
                await connection.send("Browser.close");
            } catch {
                // The process may already be gone.
            }
            socket.close();
            await Promise.race([new Promise((resolve) => child.once("exit", resolve)), sleep(3000).then(() => child.kill("SIGKILL"))]);
            rmSync(profile, { recursive: true, force: true });
        },
    };
}
