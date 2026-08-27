#!/usr/bin/env python3
"""Estimate task tokens and advise agent, human, or hybrid delegation."""

from __future__ import annotations

import argparse
import json
import re
import statistics
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple


STOPWORDS = {
    "about",
    "add",
    "after",
    "agent",
    "and",
    "change",
    "create",
    "docs",
    "for",
    "from",
    "into",
    "only",
    "pulse",
    "repository",
    "the",
    "this",
    "to",
    "update",
    "with",
}

FILE_MULTIPLIERS = (
    (1, 0.65),
    (3, 0.85),
    (6, 1.0),
    (12, 1.25),
    (25, 1.55),
)

RISK_MULTIPLIERS = {
    "low": 0.80,
    "medium": 1.0,
    "high": 1.30,
    "critical": 1.65,
}
NOVELTY_MULTIPLIERS = {"low": 0.85, "medium": 1.0, "high": 1.30}
AMBIGUITY_MULTIPLIERS = {"low": 0.85, "medium": 1.0, "high": 1.30}
REVERSIBILITY_MULTIPLIERS = {"easy": 0.85, "moderate": 1.0, "hard": 1.30}


@dataclass(frozen=True)
class HistoryRecord:
    tokens: int
    basis: str
    summary: str


@dataclass(frozen=True)
class TaskProfile:
    files: int
    risk: str
    novelty: str
    ambiguity: str
    reversibility: str
    external_state: bool


def parse_number(value: str) -> int:
    return int(value.replace(",", ""))


def parse_usage_log(path: Path) -> List[HistoryRecord]:
    if not path.exists():
        return []

    records: List[HistoryRecord] = []
    for line in path.read_text(errors="ignore").splitlines():
        if not line.startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if len(cells) < 6 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", cells[0]):
            continue

        token_cell = cells[3].lower()
        total_match = re.search(r"(\d[\d,]*)\s+total\b", token_cell)
        output_match = re.search(r"(\d[\d,]*)\s+out\b", token_cell)
        if total_match:
            tokens = parse_number(total_match.group(1))
            basis = "total"
        elif output_match:
            tokens = parse_number(output_match.group(1))
            basis = "output"
        else:
            continue

        if tokens > 0:
            records.append(HistoryRecord(tokens=tokens, basis=basis, summary=cells[5]))
    return records


def tokenize(text: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-z0-9]+", text.lower())
        if len(word) >= 3 and word not in STOPWORDS
    }


def similarity(left: str, right: str) -> float:
    left_words = tokenize(left)
    right_words = tokenize(right)
    if not left_words or not right_words:
        return 0.0
    return len(left_words & right_words) / len(left_words | right_words)


def cap_outliers(values: Sequence[int]) -> Tuple[List[int], int]:
    if len(values) < 3:
        return list(values), 0

    median = statistics.median(values)
    deviations = [abs(value - median) for value in values]
    mad = statistics.median(deviations)
    cap = median * 3 if mad == 0 else median + (6 * mad)
    capped = [min(value, max(1, int(cap))) for value in values]
    return capped, sum(original != adjusted for original, adjusted in zip(values, capped))


def file_multiplier(files: int) -> float:
    for limit, multiplier in FILE_MULTIPLIERS:
        if files <= limit:
            return multiplier
    return 1.90


def round_tokens(value: float) -> int:
    return max(500, int(round(value / 100.0) * 100))


def historical_baseline(
    task: str, records: Sequence[HistoryRecord]
) -> Tuple[float, str, int, int, int]:
    if not records:
        return 12_000.0, "output-equivalent heuristic", 0, 0, 0

    total_records = [record for record in records if record.basis == "total"]
    selected_records = total_records or [
        record for record in records if record.basis == "output"
    ]
    basis = "total" if total_records else "output-equivalent"

    raw_values = [record.tokens for record in selected_records]
    capped_values, capped_count = cap_outliers(raw_values)
    scored = [
        (similarity(task, record.summary), adjusted)
        for record, adjusted in zip(selected_records, capped_values)
    ]
    similar = sorted(
        [(score, value) for score, value in scored if score >= 0.05],
        key=lambda item: item[0],
        reverse=True,
    )[:5]

    median = float(statistics.median(capped_values))
    if similar:
        weighted_total = sum(value * (1 + score * 6) for score, value in similar)
        weight = sum(1 + score * 6 for score, _ in similar)
        similar_mean = weighted_total / weight
        baseline = (similar_mean * 0.7) + (median * 0.3)
    else:
        baseline = median

    return baseline, basis, len(selected_records), len(similar), capped_count


def confidence(usable_records: int, similar_records: int) -> str:
    if usable_records >= 12 and similar_records >= 4:
        return "high"
    if usable_records >= 5 and similar_records >= 1:
        return "medium"
    return "low"


def estimate_range(
    task: str, profile: TaskProfile, records: Sequence[HistoryRecord]
) -> Dict[str, object]:
    baseline, basis, usable, similar_count, capped_count = historical_baseline(
        task, records
    )
    multiplier = (
        file_multiplier(profile.files)
        * RISK_MULTIPLIERS[profile.risk]
        * NOVELTY_MULTIPLIERS[profile.novelty]
        * AMBIGUITY_MULTIPLIERS[profile.ambiguity]
        * REVERSIBILITY_MULTIPLIERS[profile.reversibility]
        * (1.20 if profile.external_state else 1.0)
    )
    central = round_tokens(baseline * multiplier)
    level = confidence(usable, similar_count)
    lower_factor, upper_factor = {
        "high": (0.75, 1.35),
        "medium": (0.65, 1.50),
        "low": (0.50, 1.80),
    }[level]
    return {
        "lower": round_tokens(central * lower_factor),
        "central": central,
        "upper": round_tokens(central * upper_factor),
        "basis": basis,
        "confidence": level,
        "usable_history_records": usable,
        "excluded_history_records": len(records) - usable,
        "similar_history_records": similar_count,
        "outliers_capped": capped_count,
        "profile_multiplier": round(multiplier, 3),
    }


def parse_positive_decimal(value: Optional[str], name: str) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"{name} must be a number") from error
    if parsed <= 0:
        raise ValueError(f"{name} must be greater than zero")
    return parsed


def compare_economics(
    central_tokens: int,
    human_minutes: Optional[int],
    human_hourly_rate: Optional[Decimal],
    agent_cost_per_million_tokens: Optional[Decimal],
    token_basis: str = "tokens",
) -> Dict[str, object]:
    supplied = (
        human_minutes is not None,
        human_hourly_rate is not None,
        agent_cost_per_million_tokens is not None,
    )
    if not all(supplied):
        return {
            "status": "not-compared",
            "reason": (
                "Tokens alone cannot determine monetary cost. Supply human "
                "minutes, human hourly rate, and agent cost per million tokens."
            ),
        }
    if human_minutes is None or human_minutes <= 0:
        raise ValueError("human-minutes must be greater than zero")

    human_cost = (Decimal(human_minutes) / Decimal(60)) * human_hourly_rate
    agent_cost = (
        Decimal(central_tokens) / Decimal(1_000_000)
    ) * agent_cost_per_million_tokens

    if agent_cost <= human_cost * Decimal("0.8"):
        status = "agent-likely-cheaper"
    elif human_cost <= agent_cost * Decimal("0.8"):
        status = "human-likely-cheaper"
    else:
        status = "similar"

    return {
        "status": status,
        "human_estimate": round(float(human_cost), 2),
        "agent_estimate": round(float(agent_cost), 2),
        "reason": (
            "Comparison uses only the values supplied for this run and applies "
            f"the agent rate to the {token_basis} estimate."
        ),
    }


def delegation_recommendation(
    profile: TaskProfile,
    estimate: Dict[str, object],
    token_budget: Optional[int],
    economics: Dict[str, object],
) -> Tuple[str, List[str]]:
    reasons: List[str] = []

    if profile.risk == "critical":
        recommendation = "human-led"
        reasons.append("Critical-risk work requires human ownership.")
    elif profile.external_state and (
        profile.risk == "high" or profile.reversibility == "hard"
    ):
        recommendation = "human-led"
        reasons.append("High-risk external state is hard to reverse safely.")
    elif profile.risk == "high" or profile.reversibility == "hard":
        recommendation = "hybrid"
        reasons.append("Risk or reversibility needs human checkpoints.")
    elif profile.ambiguity == "high" or profile.novelty == "high":
        recommendation = "hybrid"
        reasons.append("Novel or ambiguous work benefits from human direction.")
    else:
        recommendation = "agent-led"
        reasons.append("The task is clear, scoped, and reasonably reversible.")

    upper = int(estimate["upper"])
    if token_budget is not None and upper > token_budget:
        if recommendation == "agent-led":
            recommendation = "hybrid"
        reasons.append(
            f"The upper estimate ({upper:,}) exceeds the token budget ({token_budget:,})."
        )

    economics_status = str(economics["status"])
    if economics_status == "human-likely-cheaper":
        recommendation = "human-led"
        reasons.append("The supplied economics indicate human work is likely cheaper.")
    elif economics_status == "agent-likely-cheaper":
        reasons.append("The supplied economics indicate agent work is likely cheaper.")

    return recommendation, reasons


def analyze(
    task: str,
    profile: TaskProfile,
    history_path: Path,
    token_budget: Optional[int] = None,
    human_minutes: Optional[int] = None,
    human_hourly_rate: Optional[Decimal] = None,
    agent_cost_per_million_tokens: Optional[Decimal] = None,
) -> Dict[str, object]:
    records = parse_usage_log(history_path)
    estimate = estimate_range(task, profile, records)
    economics = compare_economics(
        int(estimate["central"]),
        human_minutes,
        human_hourly_rate,
        agent_cost_per_million_tokens,
        str(estimate["basis"]),
    )
    recommendation, reasons = delegation_recommendation(
        profile, estimate, token_budget, economics
    )

    limitations = []
    if not records:
        limitations.append("No usable history was found; the range uses a generic heuristic.")
    elif estimate["basis"] == "output-equivalent":
        limitations.append(
            "Most historical rows expose output tokens only, so this is not a full-token forecast."
        )
    elif estimate["excluded_history_records"]:
        limitations.append(
            "Output-only rows were excluded so the forecast keeps a consistent total-token basis."
        )
    if estimate["confidence"] == "low":
        limitations.append("Confidence is low because similar local history is limited.")
    limitations.append("The recommendation does not override PULSE safety or approval rules.")

    return {
        "task": task,
        "profile": asdict(profile),
        "estimate": estimate,
        "token_budget": token_budget,
        "recommendation": recommendation,
        "reasons": reasons,
        "economics": economics,
        "limitations": limitations,
        "history_path": str(history_path),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Estimate token usage and advise agent, human, or hybrid delegation."
    )
    parser.add_argument("--task", required=True, help="Plain-language task description.")
    parser.add_argument(
        "--history",
        default="docs/usage/usage-log.md",
        help="Path to the PULSE token usage log.",
    )
    parser.add_argument("--files", type=int, default=3, help="Likely files changed.")
    parser.add_argument("--risk", choices=RISK_MULTIPLIERS, default="medium")
    parser.add_argument("--novelty", choices=NOVELTY_MULTIPLIERS, default="medium")
    parser.add_argument("--ambiguity", choices=AMBIGUITY_MULTIPLIERS, default="medium")
    parser.add_argument(
        "--reversibility", choices=REVERSIBILITY_MULTIPLIERS, default="moderate"
    )
    parser.add_argument(
        "--external-state",
        action="store_true",
        help="Task changes deployments, data, or an external service.",
    )
    parser.add_argument(
        "--agent-token-budget",
        type=int,
        help="Optional upper token budget for agent work.",
    )
    parser.add_argument("--human-minutes", type=int)
    parser.add_argument("--human-hourly-rate")
    parser.add_argument("--agent-cost-per-million-tokens")
    parser.add_argument("--json", action="store_true", help="Print JSON output.")
    return parser


def validate_args(args: argparse.Namespace) -> None:
    if args.files < 0:
        raise ValueError("files must be zero or greater")
    if args.agent_token_budget is not None and args.agent_token_budget <= 0:
        raise ValueError("agent-token-budget must be greater than zero")
    economics_values = (
        args.human_minutes,
        args.human_hourly_rate,
        args.agent_cost_per_million_tokens,
    )
    if any(value is not None for value in economics_values) and not all(
        value is not None for value in economics_values
    ):
        raise ValueError(
            "human-minutes, human-hourly-rate, and "
            "agent-cost-per-million-tokens must be supplied together"
        )


def print_text(result: Dict[str, object]) -> None:
    estimate = result["estimate"]
    economics = result["economics"]
    print("PULSE delegation advisor")
    print(f"Recommendation : {str(result['recommendation']).upper()}")
    print(
        "Token estimate : "
        f"{int(estimate['lower']):,} - {int(estimate['upper']):,} "
        f"{estimate['basis']} tokens (central {int(estimate['central']):,})"
    )
    print(
        "Confidence     : "
        f"{str(estimate['confidence']).upper()} "
        f"({estimate['usable_history_records']} usable, "
        f"{estimate['similar_history_records']} similar history records)"
    )
    print("Why:")
    for reason in result["reasons"]:
        print(f"  - {reason}")

    print(f"Economics      : {economics['status']}")
    if economics["status"] == "not-compared":
        print(f"  - {economics['reason']}")
    else:
        print(
            f"  - Agent estimate: {economics['agent_estimate']}; "
            f"human estimate: {economics['human_estimate']} "
            "(user-supplied rates)"
        )
        print(f"  - {economics['reason']}")

    print("Limitations:")
    for limitation in result["limitations"]:
        print(f"  - {limitation}")


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        validate_args(args)
        profile = TaskProfile(
            files=args.files,
            risk=args.risk,
            novelty=args.novelty,
            ambiguity=args.ambiguity,
            reversibility=args.reversibility,
            external_state=args.external_state,
        )
        result = analyze(
            task=args.task,
            profile=profile,
            history_path=Path(args.history),
            token_budget=args.agent_token_budget,
            human_minutes=args.human_minutes,
            human_hourly_rate=parse_positive_decimal(
                args.human_hourly_rate, "human-hourly-rate"
            ),
            agent_cost_per_million_tokens=parse_positive_decimal(
                args.agent_cost_per_million_tokens,
                "agent-cost-per-million-tokens",
            ),
        )
    except ValueError as error:
        parser.error(str(error))

    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
    else:
        print_text(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
