"""
Production-style scoring: load the notebook's saved pipeline once, then predict on new orders.

Build each row with the same raw columns as training `X` (see `fraud_model_manifest.json`:
`raw_feature_columns_in_X`). Reuse the same feature-engineering rules as the notebook
(`fe_*`, `order_*` calendar fields, etc.) before calling `predict_fraud_row`.

Usage:
    from score_fraud_order import load_pipeline, predict_fraud_row
    pipe = load_pipeline()
    out = predict_fraud_row({"billing_zip": "...", ...})  # one dict = one order
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import joblib
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent
MODEL_PATH = PROJECT_ROOT / "fraud_order_pipeline.joblib"

_pipeline = None


def load_pipeline():
    """Load `fraud_order_pipeline.joblib` once; reuse the same object for many requests."""
    global _pipeline
    if _pipeline is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Missing {MODEL_PATH}. Run the notebook once with FORCE_FULL_TRAIN=True "
                "to train and save the pipeline."
            )
        _pipeline = joblib.load(MODEL_PATH)
    return _pipeline


def predict_fraud_row(row: dict[str, Any]) -> dict[str, Any]:
    """
    Score a single order. `row` keys must match the training feature columns (no `is_fraud`).

    Returns JSON-friendly dict: predicted class, class order, and per-class probabilities.
    """
    pipe = load_pipeline()
    X = pd.DataFrame([row])
    proba = pipe.predict_proba(X)[0]
    pred = int(pipe.predict(X)[0])
    clf = pipe.named_steps["model"]
    classes = clf.classes_
    return {
        "predicted_class": pred,
        "class_order": classes.tolist(),
        "probabilities": {int(classes[i]): float(proba[i]) for i in range(len(classes))},
    }
