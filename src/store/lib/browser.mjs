// Headless Chromium driven over the DevTools protocol with Node's built-in
// WebSocket. No npm packages needed.
//
// Browser choice: Playwright's chrome-headless-shell first - it never draws a
// window and never touches the macOS keychain. A full Chrome (Chrome for
// Testing, Google Chrome, Chromium) started raw on a fresh profile asks the
// keychain for "Chrome Safe Storage" and pops a dialog on the owner's screen,
// so every launch passes --use-mock-keychain. Microsoft Edge is never used:
// on the owner's Mac it is his own browser.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const NO_BROWSER_MESSAGE =
    "No Chromium-based browser found. Install Playwright's headless shell (npx playwright install chromium-headless-shell) " +
    "or set LID_BROWSER (or BROWSER_PATH) to a Chromium executable.";

/** Playwright's download layouts per platform: the headless shell and the full Chrome (for Testing), newer layout first. */
function playwrightLayouts(platform, arch) {
    if (platform === "darwin") {
        const cpu = arch === "arm64" ? "mac-arm64" : "mac-x64";
        return {
            shell: [`chrome-headless-shell-${cpu}/chrome-headless-shell`, "chrome-mac/headless_shell"],
            chrome: [
                `chrome-${cpu}/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
                "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
            ],
        };
    }
    if (platform === "linux") {
        const cpu = arch === "arm64" ? "linux-arm64" : "linux64";
        return {
            shell: [`chrome-headless-shell-${cpu}/chrome-headless-shell`, "chrome-linux/headless_shell"],
            chrome: [`chrome-${cpu}/chrome`, "chrome-linux/chrome"],
        };
    }
    return { shell: [], chrome: [] };
}

/** Where Playwright keeps its downloads: PLAYWRIGHT_BROWSERS_PATH, then the platform's cache directory. */
function playwrightRoots({ env, home, platform }) {
    const roots = [];
    const custom = env.PLAYWRIGHT_BROWSERS_PATH;
    // "0" means "inside node_modules" to Playwright; there is no fixed path to look at.
    if (custom && custom !== "0") {
        roots.push(custom);
    }
    if (platform === "darwin") {
        roots.push(path.join(home, "Library", "Caches", "ms-playwright"));
    } else if (platform === "linux") {
        roots.push(path.join(env.XDG_CACHE_HOME || path.join(home, ".cache"), "ms-playwright"));
    }
    return [...new Set(roots)];
}

/** `<prefix>-<revision>` directories in `root`, newest revision first. */
function revisionDirs(root, prefix, list) {
    let names;
    try {
        names = list(root);
    } catch {
        return [];
    }
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    return names
        .map((name) => ({ name, match: pattern.exec(name) }))
        .filter(({ match }) => match)
        .sort((a, b) => Number(b.match[1]) - Number(a.match[1]))
        .map(({ name }) => path.join(root, name));
}

/**
 * @typedef {object} CandidateOptions
 * @property {Record<string, string | undefined>} [env] environment to read (default: process.env)
 * @property {string} [home] home directory (default: os.homedir())
 * @property {string} [platform] "darwin", "linux", ... (default: process.platform)
 * @property {string} [arch] "arm64", "x64", ... (default: process.arch)
 * @property {(dir: string) => string[]} [list] directory listing (default: fs.readdirSync)
 */

/**
 * Every browser executable worth trying, in order: LID_BROWSER, BROWSER_PATH,
 * Playwright's headless shell (newest revision first, every download root),
 * Playwright's full Chrome for Testing, then Google Chrome and Chromium in
 * /Applications. Existence is not checked here except for the directory
 * listing of the Playwright roots; `findBrowser` picks the first that exists.
 *
 * @param {CandidateOptions} [options]
 * @returns {string[]}
 */
export function browserCandidates({
    env = process.env,
    home = os.homedir(),
    platform = process.platform,
    arch = process.arch,
    list = (dir) => readdirSync(dir),
} = {}) {
    const layouts = playwrightLayouts(platform, arch);
    const roots = playwrightRoots({ env, home, platform });
    const fromPlaywright = (prefix, files) =>
        roots.flatMap((root) => revisionDirs(root, prefix, list).flatMap((dir) => files.map((file) => path.join(dir, file))));
    const candidates = [
        env.LID_BROWSER,
        env.BROWSER_PATH,
        ...fromPlaywright("chromium_headless_shell", layouts.shell),
        ...fromPlaywright("chromium", layouts.chrome),
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ].filter(Boolean);
    return [...new Set(candidates)];
}

/**
 * The first browser candidate that exists; throws NO_BROWSER_MESSAGE when none does.
 *
 * @param {CandidateOptions & { exists?: (file: string) => boolean }} [options]
 * @returns {string}
 */
export function findBrowser({ exists = existsSync, ...options } = {}) {
    const found = browserCandidates(options).find((candidate) => exists(candidate));
    if (!found) {
        throw new Error(NO_BROWSER_MESSAGE);
    }
    return found;
}

/**
 * Command-line flags for one launch. --use-mock-keychain is always there: no keychain prompt, ever.
 *
 * @param {{ profile: string, headless?: boolean }} options
 * @returns {string[]}
 */
export function browserArgs({ profile, headless = true }) {
    return [
        headless ? "--headless=new" : "",
        "--use-mock-keychain",
        "--remote-debugging-port=0",
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-sync",
        "--hide-scrollbars",
        "--mute-audio",
        "--force-color-profile=srgb",
        "--font-render-hinting=none",
        "--window-size=1400,1000",
        "about:blank",
    ].filter(Boolean);
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

    /** Clicks with real pointer events; when the element cannot be brought under the pointer (inner scroll container, overlay), falls back to a DOM click. */
    async click(selector, { index = 0 } = {}) {
        const box = await this.evaluate(`(() => {
            const nodes = document.querySelectorAll(${JSON.stringify(selector)});
            const node = nodes[${index}];
            if (!node) return null;
            node.scrollIntoView({ block: "center", inline: "nearest" });
            const r = node.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const hit = document.elementFromPoint(x, y);
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight || !hit || !(hit === node || node.contains(hit))) {
                node.click();
                return { clicked: true };
            }
            return { x, y };
        })()`);
        if (!box) {
            throw new Error(`click: no element for ${selector}[${index}]`);
        }
        if (box.clicked) {
            return;
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
    const profile = mkdtempSync(path.join(os.tmpdir(), "lid-store-browser-"));
    const args = browserArgs({ profile, headless });
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
