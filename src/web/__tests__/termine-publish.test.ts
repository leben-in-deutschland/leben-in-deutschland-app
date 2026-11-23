// @vitest-environment node
/**
 * The exam-dates publisher (src/termine/publish.mjs, ADR-050): what a run
 * leaves on the `data` branch, when it reads and when it stays quiet. The
 * exam centres are not read here - a stand-in writes the file. Git is real: a
 * bare repository in a temporary folder is the remote.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ageHours, MIN_AGE_HOURS, publish } from "../../termine/publish.mjs";

const SCRIPT = fileURLToPath(new URL("../../termine/publish.mjs", import.meta.url));
const MORNING = new Date("2026-11-23T05:17:00.000Z");
/**
 * For the one test that starts the command itself: were it ever to begin a
 * real read by mistake, every page fails at once instead of 111 websites
 * being asked by a test.
 */
const NO_NETWORK = "--import=data:text/javascript,globalThis.fetch=()=>Promise.reject(Error(1))";

function hoursAfter(start: Date, hours: number): Date {
    return new Date(start.getTime() + hours * 3_600_000);
}

function file(generatedAt: Date, centres: unknown[] = []) {
    return { version: 1, generatedAt: generatedAt.toISOString(), centres };
}

/**
 * Git without the developer's configuration and without the variables a git
 * hook sets (a test run from a hook must not act on the repository the hook
 * belongs to), under an identity that names nobody.
 */
function gitEnv(identity = true): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const name of Object.keys(env)) {
        if (name.startsWith("GIT_")) {
            delete env[name];
        }
    }
    env.GIT_CONFIG_GLOBAL = devNull;
    env.GIT_CONFIG_NOSYSTEM = "1";
    if (identity) {
        env.GIT_AUTHOR_NAME = "exam dates test";
        env.GIT_AUTHOR_EMAIL = "";
        env.GIT_COMMITTER_NAME = "exam dates test";
        env.GIT_COMMITTER_EMAIL = "";
    }
    return env;
}

/** Stands in for sync.mjs: writes `data` as the new file and remembers the published file it was handed. */
function reader(data: unknown, summary = "3 of 3 centres read, 2 list a date; 5 dates, 1 bookable") {
    const seen: { calls: number; previous: string | null } = { calls: 0, previous: null };
    const read = async ({ previousFile, outFile }: { previousFile: string; outFile: string }) => {
        seen.calls += 1;
        seen.previous = existsSync(previousFile) ? readFileSync(previousFile, "utf8") : null;
        writeFileSync(outFile, `${JSON.stringify(data, null, 1)}\n`);
        return summary;
    };
    return { read, seen };
}

describe("exam dates publisher", () => {
    let dir: string;
    let origin: string;
    let work: string;
    let source: string;
    let env: NodeJS.ProcessEnv;
    let lines: string[];

    const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const onRemote = (...args: string[]) => git(origin, ...args);
    /** The exam centres are never read here: a test that brings no reader of its own fails. */
    const noReader = async () => {
        throw new Error("this test has no reader");
    };
    const run = (options: Parameters<typeof publish>[0] = {}) => publish({ repo: work, source, env, read: noReader, log: (line) => lines.push(line), ...options });

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), "termine-publish-test-"));
        origin = path.join(dir, "origin.git");
        work = path.join(dir, "work");
        env = gitEnv();
        git(dir, "init", "--quiet", "--bare", origin);
        git(dir, "init", "--quiet", work);
        source = pathToFileURL(origin).href;
        git(work, "remote", "add", "origin", source);
        lines = [];
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it("creates the branch on the first run: one commit with the file and its README, and no other ref", async () => {
        const { read, seen } = reader(file(MORNING));
        const result = await run({ now: MORNING, read });

        expect(result.outcome).toBe("published");
        expect(seen.previous).toBeNull();
        expect(onRemote("for-each-ref", "--format=%(refname)")).toBe("refs/heads/data");
        expect(onRemote("rev-list", "--count", "data")).toBe("1");
        expect(onRemote("ls-tree", "-r", "--name-only", "data").split("\n")).toEqual(["README.md", "termine.json"]);
        expect(JSON.parse(onRemote("show", "data:termine.json"))).toEqual(file(MORNING));
        expect(onRemote("show", "data:README.md")).toContain("Exam dates");
        expect(onRemote("log", "-1", "--format=%s", "data")).toBe("termine: 3 of 3 centres read, 2 list a date; 5 dates, 1 bookable");
        expect(git(work, "rev-parse", "refs/remotes/origin/data")).toBe(onRemote("rev-parse", "data"));
    });

    it("adds one commit on top of what is published and hands the reader the published file", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const first = onRemote("rev-parse", "data");
        const later = hoursAfter(MORNING, 4);
        const { read, seen } = reader(file(later, [{ id: "by-musterstadt-vhs" }]));
        const result = await run({ now: later, read });

        expect(result).toMatchObject({ outcome: "published", parent: first });
        expect(JSON.parse(seen.previous ?? "null")).toEqual(file(MORNING));
        expect(onRemote("rev-list", "--count", "data")).toBe("2");
        expect(onRemote("log", "-1", "--format=%P", "data")).toBe(first);
        expect(JSON.parse(onRemote("show", "data:termine.json"))).toEqual(file(later, [{ id: "by-musterstadt-vhs" }]));
    });

    it("builds on a published commit this checkout has never seen", async () => {
        const other = path.join(dir, "other");
        git(dir, "init", "--quiet", other);
        git(other, "remote", "add", "origin", source);
        await run({ repo: other, now: MORNING, read: reader(file(MORNING)).read });
        const theirs = onRemote("rev-parse", "data");

        const later = hoursAfter(MORNING, 4);
        const { read, seen } = reader(file(later));
        const result = await run({ now: later, read });

        expect(result).toMatchObject({ outcome: "published", parent: theirs });
        expect(JSON.parse(seen.previous ?? "null")).toEqual(file(MORNING));
        expect(onRemote("rev-list", "--count", "data")).toBe("2");
    });

    it("does nothing while the published file is younger than three hours", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const { read, seen } = reader(file(hoursAfter(MORNING, 2)));
        const result = await run({ now: hoursAfter(MORNING, MIN_AGE_HOURS - 0.01), read });

        expect(result.outcome).toBe("fresh");
        expect(seen.calls).toBe(0);
        expect(onRemote("rev-list", "--count", "data")).toBe("1");
        expect(lines.join("\n")).toContain("nothing to do");
    });

    it("reads again once the published file is three hours old, and earlier when asked to", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const due = hoursAfter(MORNING, MIN_AGE_HOURS);
        expect((await run({ now: due, read: reader(file(due)).read })).outcome).toBe("published");

        const soon = hoursAfter(due, 1);
        expect((await run({ now: soon, read: reader(file(soon)).read, evenIfFresh: true })).outcome).toBe("published");
        expect(onRemote("rev-list", "--count", "data")).toBe("3");
    });

    it("publishes nothing when the read changed nothing", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const { read, seen } = reader(file(MORNING));
        const result = await run({ now: hoursAfter(MORNING, 6), read });

        expect(result.outcome).toBe("unchanged");
        expect(seen.calls).toBe(1);
        expect(onRemote("rev-list", "--count", "data")).toBe("1");
    });

    it("fails the run when the push is refused, and leaves the branch as it was", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const before = onRemote("rev-parse", "data");
        const hook = path.join(origin, "hooks", "pre-receive");
        writeFileSync(hook, "#!/bin/sh\necho 'no pushes today' >&2\nexit 1\n");
        chmodSync(hook, 0o755);

        const later = hoursAfter(MORNING, 6);
        await expect(run({ now: later, read: reader(file(later)).read })).rejects.toThrow(/the push to origin was refused: .*pre-receive hook declined/);

        expect(onRemote("rev-parse", "data")).toBe(before);
        expect(git(work, "rev-parse", "refs/remotes/origin/data")).toBe(before);
    });

    it("steps back, without a fault, when another run published while it was reading", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const other = path.join(dir, "other");
        git(dir, "init", "--quiet", other);
        git(other, "remote", "add", "origin", source);
        const later = hoursAfter(MORNING, 6);
        const theirs = file(later, [{ id: "theirs" }]);
        const mine = reader(file(later, [{ id: "mine" }]));
        // While this run reads, another checkout publishes.
        const read: typeof mine.read = async (files) => {
            await run({ repo: other, now: later, read: reader(theirs).read });
            return mine.read(files);
        };

        const result = await run({ now: later, read });

        expect(result.outcome).toBe("overtaken");
        expect(onRemote("rev-list", "--count", "data")).toBe("2");
        expect(JSON.parse(onRemote("show", "data:termine.json"))).toEqual(theirs);
    });

    it("pushes nothing in a dry run", async () => {
        const result = await run({ now: MORNING, read: reader(file(MORNING)).read, dryRun: true });

        expect(result.outcome).toBe("dry-run");
        expect(onRemote("for-each-ref")).toBe("");
        expect(git(work, "ls-tree", "-r", "--name-only", result.commit ?? "").split("\n")).toEqual(["README.md", "termine.json"]);
    });

    it("fails the run and publishes nothing when the read fails", async () => {
        await run({ now: MORNING, read: reader(file(MORNING)).read });
        const before = onRemote("rev-parse", "data");
        const read = async () => {
            throw new Error("the read failed (sync.mjs ended with exit 1); nothing published");
        };

        await expect(run({ now: hoursAfter(MORNING, 6), read })).rejects.toThrow("the read failed");
        expect(onRemote("rev-parse", "data")).toBe(before);
    });

    it("ends quietly, without a read, when the published branch cannot be reached", async () => {
        const { read, seen } = reader(file(MORNING));
        const result = await run({ now: MORNING, read, source: pathToFileURL(path.join(dir, "nowhere.git")).href });

        expect(result.outcome).toBe("unreachable");
        expect(seen.calls).toBe(0);
        expect(onRemote("for-each-ref")).toBe("");
    });

    it("refuses to commit under a name git would have to guess from the machine", async () => {
        env = gitEnv(false);

        await expect(run({ now: MORNING, read: reader(file(MORNING)).read })).rejects.toThrow("commit-tree failed");
        expect(onRemote("for-each-ref")).toBe("");
    });

    it("prints nothing on standard output - a watch that prints there wakes an agent", async () => {
        const now = new Date();
        await run({ now, read: reader(file(now)).read });

        const ran = spawnSync(process.execPath, [SCRIPT, "--source", source, "--remote", "origin"], {
            env: { ...env, GIT_DIR: path.join(work, ".git"), NODE_OPTIONS: NO_NETWORK },
            encoding: "utf8",
        });

        expect(ran.status).toBe(0);
        expect(ran.stdout).toBe("");
        expect(ran.stderr).toContain("nothing to do");
    });
});

describe("age of the published file", () => {
    it("counts the hours since the file was generated", () => {
        expect(ageHours(JSON.stringify(file(MORNING)), hoursAfter(MORNING, 3))).toBe(3);
        expect(ageHours(JSON.stringify(file(MORNING)), hoursAfter(MORNING, -1))).toBe(-1);
    });

    it("has no age for a text that is not a published file", () => {
        expect(ageHours("not json")).toBeNull();
        expect(ageHours("{}")).toBeNull();
        expect(ageHours('{"generatedAt":"soon"}')).toBeNull();
    });
});
