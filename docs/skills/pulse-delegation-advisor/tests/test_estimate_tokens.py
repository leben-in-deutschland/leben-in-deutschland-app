import importlib.util
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "estimate_tokens.py"
SPEC = importlib.util.spec_from_file_location("estimate_tokens", MODULE_PATH)
ESTIMATOR = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
sys.modules[SPEC.name] = ESTIMATOR
SPEC.loader.exec_module(ESTIMATOR)


def write_usage_log(path: Path, token_cells):
    rows = [
        "# Token Usage Log",
        "",
        "| Date | Session | Model(s) | Tokens used | Turns | Summary |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for index, (tokens, summary) in enumerate(token_cells, start=1):
        rows.append(
            f"| 2026-08-{index:02d} | session-{index} | model | "
            f"{tokens} | 1 | {summary} |"
        )
    path.write_text("\n".join(rows))


class EstimateTokensTests(unittest.TestCase):
    def test_parser_prefers_total_tokens(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "usage.md"
            write_usage_log(
                path,
                [
                    (
                        "1,000 in / 500 out / 1,500 total",
                        "Add API validation",
                    ),
                    ("900 out", "Write documentation"),
                ],
            )
            records = ESTIMATOR.parse_usage_log(path)
            self.assertEqual(records[0].tokens, 1500)
            self.assertEqual(records[0].basis, "total")
            self.assertEqual(records[1].tokens, 900)
            self.assertEqual(records[1].basis, "output")

    def test_outlier_does_not_dominate_estimate(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "usage.md"
            write_usage_log(
                path,
                [
                    ("10,000 out", "Add API endpoint"),
                    ("12,000 out", "Update API endpoint"),
                    ("14,000 out", "Test API endpoint"),
                    ("16,000 out", "Document API endpoint"),
                    ("8,000,000 out", "Large unrelated migration"),
                ],
            )
            profile = ESTIMATOR.TaskProfile(
                files=3,
                risk="medium",
                novelty="medium",
                ambiguity="low",
                reversibility="easy",
                external_state=False,
            )
            result = ESTIMATOR.analyze("Add API endpoint", profile, path)
            self.assertLess(result["estimate"]["central"], 100_000)
            self.assertGreater(result["estimate"]["outliers_capped"], 0)

    def test_baseline_does_not_mix_token_bases(self):
        records = [
            ESTIMATOR.HistoryRecord(1_000, "total", "Add API validation"),
            ESTIMATOR.HistoryRecord(1_200, "total", "Test API validation"),
            ESTIMATOR.HistoryRecord(900_000, "output", "Large migration"),
        ]
        baseline, basis, usable, _, _ = ESTIMATOR.historical_baseline(
            "Add API validation", records
        )
        self.assertEqual(basis, "total")
        self.assertEqual(usable, 2)
        self.assertLess(baseline, 10_000)

    def test_critical_external_state_is_human_led(self):
        profile = ESTIMATOR.TaskProfile(
            files=2,
            risk="critical",
            novelty="low",
            ambiguity="low",
            reversibility="hard",
            external_state=True,
        )
        result = ESTIMATOR.analyze(
            "Change production database",
            profile,
            Path("/missing/usage-log.md"),
        )
        self.assertEqual(result["recommendation"], "human-led")

    def test_budget_can_change_agent_to_hybrid(self):
        profile = ESTIMATOR.TaskProfile(
            files=3,
            risk="low",
            novelty="low",
            ambiguity="low",
            reversibility="easy",
            external_state=False,
        )
        result = ESTIMATOR.analyze(
            "Update a small document",
            profile,
            Path("/missing/usage-log.md"),
            token_budget=1_000,
        )
        self.assertEqual(result["recommendation"], "hybrid")

    def test_human_cheaper_requires_supplied_economics(self):
        economics = ESTIMATOR.compare_economics(
            central_tokens=100_000,
            human_minutes=60,
            human_hourly_rate=Decimal("10"),
            agent_cost_per_million_tokens=Decimal("200"),
        )
        self.assertEqual(economics["status"], "human-likely-cheaper")

    def test_missing_economics_never_claims_cheaper(self):
        economics = ESTIMATOR.compare_economics(
            central_tokens=100_000,
            human_minutes=None,
            human_hourly_rate=None,
            agent_cost_per_million_tokens=None,
        )
        self.assertEqual(economics["status"], "not-compared")


if __name__ == "__main__":
    unittest.main()
