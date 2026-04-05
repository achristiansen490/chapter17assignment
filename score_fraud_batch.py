"""
Batch fraud scoring bridge for Next.js API.

Reads JSON from stdin:
{
  "rows": [{...feature columns..., "order_id": 123}, ...],
  "mode": "full" | "slim"
}

Writes JSON to stdout:
{
  "ok": true,
  "mode": "full",
  "model_version": "fraud_order_pipeline.joblib",
  "results": [
    {"order_id": 123, "fraud_probability": 0.42, "predicted_class": 0}
  ]
}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

from score_fraud_order import load_pipeline

PROJECT_ROOT = Path(__file__).resolve().parent
MANIFEST_PATH = PROJECT_ROOT / "fraud_model_manifest.json"


def _read_manifest() -> dict[str, Any]:
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"Missing manifest file: {MANIFEST_PATH}")
    with open(MANIFEST_PATH, encoding="utf-8") as f:
        return json.load(f)


def _normalize_rows(
    raw_rows: list[dict[str, Any]],
    raw_feature_columns: list[str],
    optional_drop: list[str],
    mode: str,
) -> list[dict[str, Any]]:
    slim = mode == "slim"
    normalized: list[dict[str, Any]] = []
    for row in raw_rows:
        out: dict[str, Any] = {}
        for col in raw_feature_columns:
            out[col] = row.get(col)
        if slim:
            for col in optional_drop:
                if col in out:
                    out[col] = None
        normalized.append(out)
    return normalized


def _to_fraud_probability(proba_row: Any, classes: list[Any]) -> float:
    if 1 in classes:
        idx = classes.index(1)
        return float(proba_row[idx])
    return float(max(proba_row))


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        rows = payload.get("rows", [])
        mode = payload.get("mode", "full")
        if mode not in {"full", "slim"}:
            raise ValueError("Invalid mode. Expected 'full' or 'slim'.")
        if not isinstance(rows, list):
            raise ValueError("'rows' must be a list.")

        manifest = _read_manifest()
        input_contract = manifest.get("input_contract_for_scoring_api", {})
        raw_feature_columns = input_contract.get("raw_feature_columns_in_X", [])
        optional_drop = input_contract.get("optional_drop_for_frequent_inference", [])

        if not raw_feature_columns:
            raise ValueError(
                "Manifest missing input_contract_for_scoring_api.raw_feature_columns_in_X."
            )

        pipeline = load_pipeline()
        normalized_rows = _normalize_rows(rows, raw_feature_columns, optional_drop, mode)
        X = pd.DataFrame(normalized_rows, columns=raw_feature_columns)

        preds = pipeline.predict(X)
        proba = pipeline.predict_proba(X)
        model = pipeline.named_steps["model"]
        classes = list(model.classes_)

        results = []
        for idx, row in enumerate(rows):
            results.append(
                {
                    "order_id": row.get("order_id"),
                    "fraud_probability": _to_fraud_probability(proba[idx], classes),
                    "predicted_class": int(preds[idx]),
                }
            )

        out = {
            "ok": True,
            "mode": mode,
            "model_version": "fraud_order_pipeline.joblib",
            "results": results,
        }
        print(json.dumps(out))
        return 0
    except Exception as exc:
        err = {"ok": False, "error": str(exc)}
        print(json.dumps(err))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
