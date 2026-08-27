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
| 2026-08-27 | 874775c6 | gpt-5.6-sol (GitHub Copilot CLI) | n/a (not exposed) | n/a | Sync the adapted PULSE control plane through template/main at 47aa161 and activate the complete skill pack. |
| 2026-08-27 | b23d822d | gpt-5.6-sol, gpt-5.4-mini (GitHub Copilot CLI) | n/a in / 167,220 main out + 2,433,542 subagent total (interim live; 15:46:44 CEST) | n/a | Remediate 41 Dependabot alerts, publish only the verified Android bundle, and fix the release-only Capacitor permission crash. |
