# Token Usage Log

Per-session PULSE work-accounting ledger. Record only real token data exposed
by the active runner; never estimate missing values or copy rows from another
repository.

- Use `n/a (not exposed)` when the runner does not provide a field.
- Mark live values with a capture time and finalize them only when the runner
  exposes canonical shutdown totals.
- Run [`docs/scripts/usage.sh`](../scripts/usage.sh) for supported local logs.

| Date | Session | Model(s) | Tokens used | Turns | Summary |
| --- | --- | --- | --- | --- | --- |
| 2026-08-27 | cf2cccbc | gpt-5.6-sol (GitHub Copilot CLI) | n/a (not exposed) | n/a | Bootstrap the adapted PULSE control plane and complete canonical skill pack. |
