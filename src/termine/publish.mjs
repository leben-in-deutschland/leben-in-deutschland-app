#!/usr/bin/env node
// Publishes the exam dates: one run reads what is published, lets sync.mjs
// read the exam centres, and pushes the new termine.json as one commit to the
// `data` branch of this repository.
//
//   node src/termine/publish.mjs [--dry-run] [--even-if-fresh]
//                                [--source URL] [--remote NAME] [--branch NAME]
//
// The Hive automation `.hive/automations/termine-sync.yaml` runs this every
// six hours (ADR-050, change of 2026-11-23). It is a watch, and a watch that
// prints on standard output hands an agent a job - so nothing is ever printed
// there. What a run has to say goes to standard error, which Hive keeps as
// the schedule's log (`hive schedule log SCHED-NNN`).
//
// How a run ends:
//   exit 0  published; or nothing to do (the published file is younger than
//           MIN_AGE_HOURS, the read changed nothing, or another run
//           published while this one was reading); or the published branch
//           could not be reached at all - then this machine is offline and
//           nothing was read.
//   exit 1  the read failed (sync.mjs says why), the push was refused, or
//           something here is broken. Hive sends an agent after three such
//           runs in a row.
//
// The only thing ever pushed is `<commit>:refs/heads/<branch>`, never with
// force. The push uses the git login of the checkout this runs in - the one
// a `git push` typed there would use. Hive gives a script no credential of
// its own.
//
// Node 22 and git, built-ins only.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where anybody can read the published branch: the public address of this repository. */
export const PUBLIC_REPOSITORY = "https://github.com/leben-in-deutschland/leben-in-deutschland-app.git";
export const DATA_BRANCH = "data";
export const DATA_FILE = "termine.json";
/** The README of the branch; it travels with every commit. */
const README_SOURCE = path.join(here, "data-branch.md");
/** A run does nothing while the published file is younger than this: four reads a day at most, also when a run by hand follows a scheduled one. */
export const MIN_AGE_HOURS = 3;
/** One git command - also a push that waits for an approval nobody gives. */
const GIT_TIMEOUT_MS = 120_000;

/**
 * @typedef {{ code: number | null, stdout: string, stderr: string, timedOut: boolean }} Ran
 * @typedef {(args: string[], options?: { input?: string, env?: Record<string, string>, timeoutMs?: number }) => Promise<Ran>} Git
 * @typedef {(files: { previousFile: string, outFile: string }) => Promise<string>} Reader
 * @typedef {"published" | "dry-run" | "fresh" | "unchanged" | "unreachable" | "overtaken"} Outcome
 * @typedef {{ outcome: Outcome, summary?: string, commit?: string, parent?: string | null, why?: string }} Result
 */

/** Hours since the file was generated; null when the text is not a published file. */
export function ageHours(text, now = new Date()) {
    try {
        const generatedAt = new Date(JSON.parse(text).generatedAt).getTime();
        return Number.isNaN(generatedAt) ? null : (now.getTime() - generatedAt) / 3_600_000;
    } catch {
        return null;
    }
}

function lastLine(text) {
    const lines = String(text)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    return (lines.at(-1) ?? "").replaceAll(os.homedir(), "~");
}

/** Why a push did not happen, in git's own words: the remote's verdict, else the first line that names a cause. */
function refusal(pushed) {
    const verdict = pushed.stdout.split("\n").find((line) => line.startsWith("!"));
    if (verdict) {
        return verdict.split("\t").at(-1)?.trim() || verdict.trim();
    }
    const lines = pushed.stderr.split("\n").map((line) => line.trim());
    const cause = lines.find((line) => /denied|rejected|fatal:|error:|no answer/i.test(line));
    return (cause ?? lastLine(pushed.stderr) ?? "").replaceAll(os.homedir(), "~") || `exit ${pushed.code}`;
}

function spell(hours) {
    const minutes = Math.round(hours * 60);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * Runs git in `repo`. A command that fails or runs out of time comes back
 * with its exit code and what it said; only a git that cannot be started at
 * all is an error - then nothing here can work.
 *
 * @param {string} repo
 * @param {Record<string, string | undefined>} baseEnv
 * @returns {Git}
 */
function gitIn(repo, baseEnv) {
    return (args, { input, env = {}, timeoutMs = GIT_TIMEOUT_MS } = {}) =>
        new Promise((resolve, reject) => {
            const child = spawn("git", args, {
                cwd: repo,
                env: { ...baseEnv, GIT_TERMINAL_PROMPT: "0", ...env },
                stdio: ["pipe", "pipe", "pipe"],
            });
            let stdout = "";
            let stderr = "";
            let timedOut = false;
            const timer = setTimeout(() => {
                timedOut = true;
                child.kill("SIGTERM");
                setTimeout(() => child.kill("SIGKILL"), 2_000).unref();
            }, timeoutMs);
            child.stdout.on("data", (chunk) => {
                stdout += chunk;
            });
            child.stderr.on("data", (chunk) => {
                stderr += chunk;
            });
            child.on("error", (error) => {
                clearTimeout(timer);
                reject(new Error(`git could not be started: ${error.message}`));
            });
            child.on("close", (code) => {
                clearTimeout(timer);
                resolve({ code, stdout, stderr: timedOut ? `${stderr}\nno answer after ${Math.round(timeoutMs / 1000)} s` : stderr, timedOut });
            });
            child.stdin.on("error", () => {});
            child.stdin.end(input ?? "");
        });
}

/**
 * Options that keep a read of the public repository anonymous: no credential
 * helper is asked, so no login of this machine is ever offered for a read.
 */
function anonymously(url) {
    const options = ["-c", "credential.helper="];
    try {
        const { protocol, host } = new URL(url);
        if (protocol === "https:" || protocol === "http:") {
            options.push("-c", `credential.${protocol}//${host}.helper=`);
        }
    } catch {
        // A path or an scp-like address: no web login could be asked for.
    }
    return options;
}

/** Lets sync.mjs read the exam centres. Resolves with its one-line summary; rejects when the read failed. */
function readerWith(env) {
    /** @type {Reader} */
    return ({ previousFile, outFile }) =>
        new Promise((resolve, reject) => {
            const child = spawn(process.execPath, [path.join(here, "sync.mjs"), "--previous", previousFile, "--out", outFile], {
                env,
                stdio: ["ignore", "pipe", "inherit"],
            });
            let stdout = "";
            child.stdout.on("data", (chunk) => {
                stdout += chunk;
            });
            child.on("error", reject);
            child.on("close", (code) => {
                if (code === 0) {
                    resolve(lastLine(stdout));
                } else {
                    reject(new Error(`the read failed (sync.mjs ended with ${code === null ? "a signal" : `exit ${code}`}); nothing published`));
                }
            });
        });
}

/**
 * One run. `source` and `remote` are two addresses of the same repository:
 * the public one for reading, the checkout's own for the push.
 *
 * @param {object} [options]
 * @param {string} [options.repo] The checkout whose objects and git login are used.
 * @param {string} [options.source] Where the published branch is read from, anonymously.
 * @param {string} [options.remote] Where the commit is pushed: a remote of `repo`.
 * @param {string} [options.branch]
 * @param {Date} [options.now]
 * @param {boolean} [options.dryRun] Read and build the commit, push nothing.
 * @param {boolean} [options.evenIfFresh] Read although the published file is young.
 * @param {Reader} [options.read]
 * @param {(line: string) => void} [options.log]
 * @param {Record<string, string | undefined>} [options.env]
 * @param {number} [options.pushTimeoutMs]
 * @returns {Promise<Result>}
 */
export async function publish({
    repo = path.resolve(here, "../.."),
    source = PUBLIC_REPOSITORY,
    remote = "origin",
    branch = DATA_BRANCH,
    now = new Date(),
    dryRun = false,
    evenIfFresh = false,
    read,
    log = (line) => console.error(line),
    env = process.env,
    pushTimeoutMs = GIT_TIMEOUT_MS,
} = {}) {
    const git = gitIn(repo, env);
    const ref = `refs/heads/${branch}`;
    /** A git command that has to work; its output, trimmed. */
    const must = async (args, options) => {
        const ran = await git(args, options);
        if (ran.code !== 0) {
            throw new Error(`git ${args.find((arg) => !arg.startsWith("-") && !arg.includes("=")) ?? ""} failed: ${lastLine(ran.stderr) || `exit ${ran.code}`}`);
        }
        return ran.stdout.trim();
    };

    // 1. What is published? Read without a login; a branch that is not there yet is a first run.
    const listed = await git([...anonymously(source), "ls-remote", "--exit-code", source, ref]);
    let parent = null;
    if (listed.code === 0) {
        parent = listed.stdout.trim().split(/\s+/)[0] ?? "";
        if (!/^[0-9a-f]{40,64}$/.test(parent)) {
            throw new Error(`${source} names no commit for ${ref}`);
        }
    } else if (listed.code !== 2) {
        const why = lastLine(listed.stderr) || "no answer";
        log(`exam dates: the published branch could not be read (${why}); nothing read, nothing published`);
        return { outcome: "unreachable", why };
    }
    const tracking = (await git(["remote", "get-url", remote])).code === 0 ? `refs/remotes/${remote}/${branch}` : null;
    if (parent && (await git(["cat-file", "-e", `${parent}^{commit}`])).code !== 0) {
        const fetched = await git([...anonymously(source), "fetch", "--quiet", "--no-tags", source, tracking ? `+${ref}:${tracking}` : ref]);
        if (fetched.code !== 0) {
            const why = lastLine(fetched.stderr) || "no answer";
            log(`exam dates: the published branch could not be fetched (${why}); nothing read, nothing published`);
            return { outcome: "unreachable", why };
        }
    }
    const published = parent ? await git(["show", `${parent}:${DATA_FILE}`]) : null;
    const previous = published?.code === 0 ? published.stdout : null;

    // 2. Young enough? Then this run is one too many.
    const age = previous === null ? null : ageHours(previous, now);
    if (!evenIfFresh && age !== null && age >= 0 && age < MIN_AGE_HOURS) {
        log(`exam dates: the published file is ${spell(age)} old; nothing to do before it is ${MIN_AGE_HOURS} h old`);
        return { outcome: "fresh", parent };
    }

    const scratch = mkdtempSync(path.join(os.tmpdir(), "termine-publish-"));
    try {
        // 3. Read the centres. The previous file tells sync.mjs what to keep from a centre that is silent now.
        const previousFile = path.join(scratch, "previous.json");
        const outFile = path.join(scratch, DATA_FILE);
        if (previous !== null) {
            writeFileSync(previousFile, previous);
        }
        log(`exam dates: reading the exam centres (published: ${age === null ? "nothing yet" : `${spell(Math.max(age, 0))} ago`})`);
        const summary = await (read ?? readerWith(env))({ previousFile, outFile });
        if (!existsSync(outFile)) {
            throw new Error("the read wrote no file; nothing published");
        }

        // 4. One commit that holds the file and the README, on top of what is published.
        const file = await must(["hash-object", "-w", "--no-filters", outFile]);
        const readme = await must(["hash-object", "-w", "--no-filters", README_SOURCE]);
        const tree = await must(["mktree"], { input: `100644 blob ${readme}\tREADME.md\n100644 blob ${file}\t${DATA_FILE}\n` });
        if (parent && (await must(["rev-parse", `${parent}^{tree}`])) === tree) {
            log("exam dates: the read changed nothing; nothing published");
            return { outcome: "unchanged", summary, parent };
        }
        const message = `termine: ${summary || "exam dates"}`;
        // Git must not guess a name or an address from this machine: the commit is public.
        const commit = await must(["-c", "user.useConfigOnly=true", "commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", message]);
        if (dryRun) {
            log(`exam dates: dry run - ${commit} would go to ${branch} on ${remote}: ${message}`);
            return { outcome: "dry-run", summary, commit, parent };
        }

        // 5. The push: this one ref, never with force.
        const ownSsh = env.GIT_SSH_COMMAND || (await git(["config", "--get", "core.sshCommand"])).stdout.trim();
        const pushed = await git(["push", "--porcelain", remote, `${commit}:${ref}`], {
            env: ownSsh ? {} : { GIT_SSH_COMMAND: "ssh -oBatchMode=yes -oConnectTimeout=20" },
            timeoutMs: pushTimeoutMs,
        });
        if (pushed.code !== 0) {
            // Has somebody else published while this run was reading? Then the branch has what it needs.
            const again = await git([...anonymously(source), "ls-remote", "--exit-code", source, ref]);
            const tip = again.code === 0 ? (again.stdout.trim().split(/\s+/)[0] ?? "") : "";
            if (tip && tip !== parent) {
                log("exam dates: another run published while this one was reading; nothing published");
                return { outcome: "overtaken", summary, parent: tip };
            }
            throw new Error(`read (${summary}) but not published - the push to ${remote} was refused: ${refusal(pushed)}`);
        }
        if (tracking) {
            await git(["update-ref", tracking, commit]);
        }
        log(`exam dates: published on ${branch} (${commit.slice(0, 7)}): ${summary}`);
        return { outcome: "published", summary, commit, parent };
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

function option(args, name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    publish({
        dryRun: args.includes("--dry-run"),
        evenIfFresh: args.includes("--even-if-fresh"),
        source: option(args, "--source"),
        remote: option(args, "--remote"),
        branch: option(args, "--branch"),
    }).catch((error) => {
        console.error(`exam dates: ${error.message}`);
        process.exit(1);
    });
}
