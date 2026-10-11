// Minimal static file server for the exported app and the compose templates.
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".txt": "text/plain; charset=utf-8",
    ".mp4": "video/mp4",
};

function resolveFile(root, urlPath) {
    const clean = decodeURIComponent(urlPath.split("?")[0]);
    const candidates = [clean, `${clean}.html`, path.join(clean, "index.html")];
    for (const candidate of candidates) {
        const file = path.join(root, candidate);
        if (!file.startsWith(root)) {
            continue;
        }
        if (existsSync(file) && statSync(file).isFile()) {
            return file;
        }
    }
    return null;
}

/**
 * Serves `roots` as `{ "/": dir, "/__store/": otherDir }`; the longest matching
 * prefix wins. Resolves on `{ url, close }`.
 */
export function startServer(roots) {
    const mounts = Object.entries(roots)
        .map(([prefix, dir]) => [prefix, path.resolve(dir)])
        .sort((a, b) => b[0].length - a[0].length);
    const server = http.createServer((req, res) => {
        const url = req.url ?? "/";
        for (const [prefix, dir] of mounts) {
            if (!url.startsWith(prefix)) {
                continue;
            }
            const file = resolveFile(dir, url.slice(prefix.length - 1) || "/");
            if (!file) {
                break;
            }
            res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
            createReadStream(file).pipe(res);
            return;
        }
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found");
    });
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((done) => server.close(done)) });
        });
    });
}
