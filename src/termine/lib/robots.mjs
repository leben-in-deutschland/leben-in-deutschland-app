// robots.txt, read the way RFC 9309 describes it: the group that names this
// crawler wins over "*", the longest matching rule decides, "Allow" wins a
// tie, "*" matches any characters and "$" the end of the path. A centre that
// does not want its pages read says so there, and the sync leaves it alone.
import { AGENT_NAME, get, HttpError } from "./http.mjs";

/** Groups of a robots.txt: [{ agents: ["*"], rules: [{ allow, path }] }]. */
export function parseRobots(text) {
    const groups = [];
    let group = null;
    let lastWasAgent = false;
    for (const raw of String(text ?? "").split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, "").trim();
        const colon = line.indexOf(":");
        if (colon < 0) {
            continue;
        }
        const field = line.slice(0, colon).trim().toLowerCase();
        const value = line.slice(colon + 1).trim();
        if (field === "user-agent") {
            if (!lastWasAgent) {
                group = { agents: [], rules: [] };
                groups.push(group);
            }
            group.agents.push(value.toLowerCase());
            lastWasAgent = true;
            continue;
        }
        lastWasAgent = false;
        if (group && (field === "allow" || field === "disallow") && value !== "") {
            group.rules.push({ allow: field === "allow", path: value });
        }
    }
    return groups;
}

function matchLength(rule, path) {
    const anchored = rule.endsWith("$");
    const body = anchored ? rule.slice(0, -1) : rule;
    const pattern = body
        .split("*")
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
    return new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(path) ? rule.length : -1;
}

/**
 * True when robots.txt lets `agent` read `url`. An empty or missing file
 * allows everything.
 */
export function isAllowed(robotsText, url, agent = AGENT_NAME) {
    const groups = parseRobots(robotsText);
    const name = agent.toLowerCase();
    const own = groups.filter((group) => group.agents.some((entry) => entry !== "*" && name.includes(entry)));
    const rules = (own.length > 0 ? own : groups.filter((group) => group.agents.includes("*"))).flatMap((group) => group.rules);
    const target = new URL(url);
    const path = `${target.pathname}${target.search}`;
    let best = { length: -1, allow: true };
    for (const rule of rules) {
        const length = matchLength(rule.path, path);
        if (length > best.length || (length === best.length && rule.allow && length >= 0)) {
            best = { length, allow: rule.allow };
        }
    }
    return best.allow;
}

/**
 * The robots.txt of the site `url` belongs to: its text, "" when the site
 * has none (4xx), or null when it could not be read (network, 5xx) - then
 * the caller must not read the site in this run.
 */
export async function fetchRobots(url) {
    try {
        const response = await get(new URL("/robots.txt", url).href, { accept: "text/plain,*/*", maxBytes: 500_000, retries: 0 });
        return /html/i.test(response.contentType) ? "" : new TextDecoder("utf-8").decode(response.buffer);
    } catch (error) {
        if (error instanceof HttpError && error.status !== null && error.status >= 400 && error.status < 500) {
            return "";
        }
        return null;
    }
}
