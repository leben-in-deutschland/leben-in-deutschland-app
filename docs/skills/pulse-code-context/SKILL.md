---
name: pulse-code-context
description: Build and query a dependency-free local code-context index with BM25-style lexical search and file relationship graph results. Use when exploring an unfamiliar repository, locating implementation, tracing related files, or narrowing source reads before a change.
---

# PULSE Code Context

Use a local search map to find the small part of a repository that matters.
The map speeds up discovery; it never replaces the real source.

## Required Behavior

1. Prefer repository code intelligence or an available language server first.
2. Check whether the local context index exists and is fresh:

   ```bash
   go run docs/skills/pulse-code-context/code_context.go status --repo .
   ```

3. If the index is missing or stale, build the dependency-free index:

   ```bash
   go run docs/skills/pulse-code-context/code_context.go index \
     --repo .
   ```

4. Search before opening broad folders or many full files:

   ```bash
   go run docs/skills/pulse-code-context/code_context.go search \
     "where authentication tokens are refreshed" \
     --repo . \
     --json
   ```

5. Use graph neighbors when the task may cross file boundaries:

   ```bash
   go run docs/skills/pulse-code-context/code_context.go related \
     src/auth/session.py \
     --repo . \
     --json
   ```

6. Read the exact returned source ranges before editing. Re-run the search or
   rebuild the index after source changes when later reasoning depends on it.
7. Verify changes with the repository's real tests, build, lint, or other
   required checks.

## Runtime

- Uses only Go and the standard library.
- No Python, SQLite, Zvec, hosted service, model download, or network call.
- Supports `index`, `search`, `related`, and `status`.
- Useful flags include `--repo`, `--cache-dir`, `--chunk-lines`,
  `--overlap-lines`, `--max-file-bytes`, `--top-k`, and `--json`.

## Safety Rules

- Keep generated indexes outside the repository. By default the helper uses the
  operating system's user-cache directory, unless `PULSE_CODE_CONTEXT_HOME` or
  `--cache-dir` is set.
- Repository-local cache roots are rejected, including symlinked aliases that
  resolve back inside the repository.
- Do not index ignored, binary, oversized, generated, vendor, cache, symlink,
  or likely-secret files.
- `status` must be treated literally: `missing`, `stale`, or `ready`.
- Treat ranked chunks and graph edges as hints.
- Source verification is mandatory. The index narrows reads, but it is never
  the source of truth.
- Never make or approve a code change from indexed text alone.
