---
name: pulse-delegation-advisor
description: Estimate likely token usage from the repository's PULSE usage history and recommend agent-led, human-led, or hybrid execution. Use before delegating a task or when comparing agent effort with human work.
---

# PULSE Delegation Advisor

Estimate token usage from real local history, then combine the estimate with
risk, ambiguity, novelty, reversibility, and external-state impact.

## Required Behavior

1. Read the task and identify:
   - likely files changed
   - risk
   - novelty
   - ambiguity
   - reversibility
   - external or persisted state
2. Run the included `estimate_tokens.py` script from this skill's directory.
3. Point `--history` at `docs/usage/usage-log.md` when it exists.
4. Report the lower, central, and upper estimate, token basis, confidence,
   recommendation, reasons, and limitations.
5. Recommend:
   - **agent-led** for clear, reversible, low/medium-risk work within budget
   - **hybrid** for high novelty, ambiguity, broad scope, or uncertain estimates
   - **human-led** for critical risk, hard-to-reverse production/data state, or
     when supplied economics clearly favor human work
6. Do not claim which option is cheaper in money unless the user supplies:
   - estimated human minutes
   - human hourly rate
   - agent cost per million tokens
7. Never store supplied financial values in the usage ledger.
8. Treat the result as advice, not permission to bypass PULSE rollback,
   security, production, data, or approval rules.

## Example

```bash
python3 estimate_tokens.py \
  --history docs/usage/usage-log.md \
  --task "Add a documented API endpoint with tests" \
  --files 4 \
  --risk medium \
  --novelty medium \
  --ambiguity low \
  --reversibility easy
```

Optional economics:

```bash
python3 estimate_tokens.py \
  --task "Update a small internal report" \
  --human-minutes 45 \
  --human-hourly-rate 80 \
  --agent-cost-per-million-tokens 12
```

## Report

Lead with the recommendation, then show the estimate and confidence. Explain
which task signals and history records drove the result. If economics inputs
are missing, say that tokens alone cannot determine monetary cost.

Decision source:
<https://github.com/manishtiwari25/pulse/blob/main/docs/decisions/ADR-006-token-aware-delegation-advice.md>
