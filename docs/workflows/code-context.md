# Workflow - Local Code Context Retrieval

Use this workflow to find relevant source quickly without treating a generated
index as authoritative code.

## 1. Choose the Best Available Map

1. Prefer repository code intelligence or a language server for exact symbols
   and references.
2. Use `pulse-code-context` when repeated exploration, broad wording, or
   cross-file relationships make a reusable local index useful.

Do not build an index for a small lookup that existing tools can answer directly.

## 2. Check Freshness

```bash
go run docs/skills/pulse-code-context/code_context.go status --repo .
```

- **ready:** search the existing index.
- **stale:** rebuild before relying on the results.
- **missing:** decide whether the task is large enough to justify setup.

## 3. Build Locally

Run from source with Go:

```bash
go run docs/skills/pulse-code-context/code_context.go index \
  --repo .
```

When a trusted checksummed release binary is already available for the current
platform, it may be used instead of `go run`. Do not download or execute a
binary without a separate explicit task and checksum verification.

The helper:

- reads Git-visible text files once
- skips ignored, binary, oversized, generated, and likely-secret paths
- writes generated state to the user's external cache
- stages a new index before replacing the previous generated index
- stops if repository files change during the build

The helper uses Go's standard library and a persisted BM25-style index. It
does not download a model or send source to a hosted service. Adding hosted
or local embeddings requires a separate privacy and architecture decision.

## 4. Search and Follow Relationships

```bash
go run docs/skills/pulse-code-context/code_context.go search \
  "where access tokens are renewed" \
  --repo . \
  --json

go run docs/skills/pulse-code-context/code_context.go related \
  path/to/result.py \
  --repo . \
  --json
```

Use the returned paths, line ranges, symbols, and graph neighbors to choose a
small source-reading set.

## 5. Verify Against Source

Before planning a change or editing:

1. Open the exact returned source ranges.
2. Follow language-server references when available.
3. Read nearby tests, interfaces, and configuration that control the behavior.
4. Confirm the index is not stale.

After editing, use the repository's real checks. Rebuild the index only when a
later task needs current retrieval.

## 6. Handle Failure Safely

- A missing Go toolchain requires a trusted release binary; it is not a reason
  to claim indexing succeeded.
- An unsupported binary target is reported explicitly.
- A failed staged rebuild must not replace the previous generated index.
- An unsupported language may still have text search but limited symbol and graph data.
- If a cache path resolves inside the repository, stop and choose an external path.

If the task's own tracked changes fail verification, use
[`rollback.md`](rollback.md). Generated context data is disposable and must
never be used as the only recovery source.
