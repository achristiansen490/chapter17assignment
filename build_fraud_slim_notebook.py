"""Generate fraud_model_slim_train.ipynb — run once."""
import json
import textwrap
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "fraud_model_slim_train.ipynb"

SLIM_SQL = r'''
# --- Slim SQL: only columns needed for manifest `raw_feature_columns_in_X` (+ order_datetime, is_fraud) ---
# Omits o.*, risk_score, ship_ship_datetime, ship_shipment_id, oi_concat_skus, and other unused fields.

SLIM_ORDER_FEATURES_SQL = """
SELECT
  o.order_datetime,
  o.billing_zip,
  o.shipping_zip,
  o.shipping_state,
  o.payment_method,
  o.device_type,
  o.ip_country,
  o.promo_used,
  o.promo_code,
  o.order_subtotal,
  o.shipping_fee,
  o.tax_amount,
  o.order_total,
  o.is_fraud,
  c.full_name AS cust_full_name,
  c.email AS cust_email,
  c.gender AS cust_gender,
  c.birthdate AS cust_birthdate,
  c.created_at AS cust_created_at,
  c.city AS cust_city,
  c.state AS cust_state,
  c.zip_code AS cust_zip,
  c.customer_segment AS cust_customer_segment,
  c.loyalty_tier AS cust_loyalty_tier,
  c.is_active AS cust_is_active,
  s.carrier AS ship_carrier,
  s.shipping_method AS ship_shipping_method,
  s.distance_band AS ship_distance_band,
  s.promised_days AS ship_promised_days,
  basket.oi_n_line_rows AS n_lines,
  basket.oi_n_distinct_order_item_ids,
  basket.oi_min_order_item_id,
  basket.oi_max_order_item_id,
  basket.oi_sum_quantity AS total_quantity,
  basket.oi_avg_quantity_per_line,
  basket.oi_min_line_quantity,
  basket.oi_max_line_quantity,
  basket.oi_avg_unit_price,
  basket.oi_min_unit_price,
  basket.oi_max_unit_price,
  basket.oi_sum_line_total AS sum_line_total,
  basket.oi_avg_line_total,
  basket.oi_min_line_total,
  basket.oi_max_line_total,
  basket.oi_n_distinct_products AS n_distinct_products,
  basket.oi_n_distinct_categories AS n_distinct_categories,
  basket.oi_n_distinct_skus,
  basket.oi_sum_qty_times_product_cost,
  basket.oi_sum_qty_times_product_list_price,
  basket.oi_avg_product_list_price,
  basket.oi_min_product_list_price,
  basket.oi_max_product_list_price,
  basket.oi_avg_product_cost,
  basket.oi_min_product_is_active,
  basket.oi_max_product_is_active,
  basket.oi_concat_categories,
  basket.oi_concat_product_names,
  rev.rev_n_reviews,
  rev.rev_avg_rating,
  rev.rev_min_rating,
  rev.rev_max_rating,
  rev.rev_min_review_datetime,
  rev.rev_max_review_datetime,
  rev.rev_sum_text_length,
  rev.rev_review_text_concat
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN shipments s ON o.order_id = s.order_id
LEFT JOIN (
  SELECT
    oi.order_id,
    COUNT(*) AS oi_n_line_rows,
    COUNT(DISTINCT oi.order_item_id) AS oi_n_distinct_order_item_ids,
    MIN(oi.order_item_id) AS oi_min_order_item_id,
    MAX(oi.order_item_id) AS oi_max_order_item_id,
    SUM(oi.quantity) AS oi_sum_quantity,
    AVG(oi.quantity) AS oi_avg_quantity_per_line,
    MIN(oi.quantity) AS oi_min_line_quantity,
    MAX(oi.quantity) AS oi_max_line_quantity,
    AVG(oi.unit_price) AS oi_avg_unit_price,
    MIN(oi.unit_price) AS oi_min_unit_price,
    MAX(oi.unit_price) AS oi_max_unit_price,
    SUM(oi.line_total) AS oi_sum_line_total,
    AVG(oi.line_total) AS oi_avg_line_total,
    MIN(oi.line_total) AS oi_min_line_total,
    MAX(oi.line_total) AS oi_max_line_total,
    COUNT(DISTINCT oi.product_id) AS oi_n_distinct_products,
    COUNT(DISTINCT p.category) AS oi_n_distinct_categories,
    COUNT(DISTINCT p.sku) AS oi_n_distinct_skus,
    SUM(oi.quantity * COALESCE(p.cost, 0)) AS oi_sum_qty_times_product_cost,
    SUM(oi.quantity * COALESCE(p.price, 0)) AS oi_sum_qty_times_product_list_price,
    AVG(p.price) AS oi_avg_product_list_price,
    MIN(p.price) AS oi_min_product_list_price,
    MAX(p.price) AS oi_max_product_list_price,
    AVG(p.cost) AS oi_avg_product_cost,
    MIN(p.is_active) AS oi_min_product_is_active,
    MAX(p.is_active) AS oi_max_product_is_active,
    GROUP_CONCAT(DISTINCT p.category) AS oi_concat_categories,
    GROUP_CONCAT(DISTINCT p.product_name) AS oi_concat_product_names
  FROM order_items oi
  LEFT JOIN products p ON oi.product_id = p.product_id
  GROUP BY oi.order_id
) basket ON o.order_id = basket.order_id
LEFT JOIN (
  SELECT
    o.order_id,
    COUNT(pr.review_id) AS rev_n_reviews,
    AVG(pr.rating) AS rev_avg_rating,
    MIN(pr.rating) AS rev_min_rating,
    MAX(pr.rating) AS rev_max_rating,
    MIN(pr.review_datetime) AS rev_min_review_datetime,
    MAX(pr.review_datetime) AS rev_max_review_datetime,
    SUM(LENGTH(COALESCE(pr.review_text, ''))) AS rev_sum_text_length,
    SUBSTR(GROUP_CONCAT(COALESCE(pr.review_text, ''), ' | '), 1, 8000) AS rev_review_text_concat
  FROM orders o
  INNER JOIN order_items oi ON o.order_id = oi.order_id
  INNER JOIN product_reviews pr
    ON pr.product_id = oi.product_id
    AND pr.customer_id = o.customer_id
    AND pr.review_datetime <= o.order_datetime
  GROUP BY o.order_id
) rev ON o.order_id = rev.order_id
"""
'''.strip()

# Code cell: paths + manifest
CELL_MANIFEST = textwrap.dedent(r'''
from pathlib import Path
import json
import sqlite3

import numpy as np
import pandas as pd

# Use notebook kernel working directory = project folder (contains shop.db, manifest, joblib).
PROJECT_ROOT = Path.cwd()
DB_PATH = PROJECT_ROOT / "shop.db"
MANIFEST_PATH = PROJECT_ROOT / "fraud_model_manifest.json"
JOBLIB_PATH = PROJECT_ROOT / "fraud_order_pipeline.joblib"

assert DB_PATH.exists(), f"Missing {DB_PATH} — open this notebook from Chapter17Assignment or chdir there."
assert MANIFEST_PATH.exists(), f"Missing {MANIFEST_PATH} — run the full CRISP-DM notebook §9 once."

with open(MANIFEST_PATH, encoding="utf-8") as f:
    MANIFEST = json.load(f)

MS = MANIFEST["model_selection"]
IC = MANIFEST["input_contract_for_scoring_api"]

FEATURE_COLS = IC["raw_feature_columns_in_X"]
NUM_COLS = IC["numeric_column_names"]
CAT_COLS = IC["categorical_column_names"]

print("Champion (from manifest):", MS["cv_winner_key"])
print("Tuned params:", MS["tuned_best_params"])
print("Features (n=%d):" % len(FEATURE_COLS), FEATURE_COLS[:6], "...")
''')

CELL_SQL = SLIM_SQL + "\n\n" + textwrap.dedent("""
conn = sqlite3.connect(DB_PATH)
df = pd.read_sql_query(SLIM_ORDER_FEATURES_SQL, conn)
conn.close()

df["order_datetime"] = pd.to_datetime(df["order_datetime"], errors="coerce")
print(df.shape)
df.head(2)
""")

CELL_FE = textwrap.dedent(r'''
# Calendar + fe_* — same rules as crisp_dm_Juypyer_notebook_predicting_is_fraud.ipynb
from sklearn.model_selection import train_test_split


def _safe_div(num, den):
    num = pd.to_numeric(num, errors="coerce")
    den = pd.to_numeric(den, errors="coerce").replace(0, np.nan)
    return (num / den).replace([np.inf, -np.inf], np.nan)


df_ml = df.copy()
dt = pd.to_datetime(df_ml["order_datetime"], errors="coerce")
df_ml["order_year"] = dt.dt.year
df_ml["order_month"] = dt.dt.month
df_ml["order_day_of_month"] = dt.dt.day
df_ml["order_day_of_week"] = dt.dt.dayofweek
df_ml["order_hour"] = dt.dt.hour
df_ml["order_minute"] = dt.dt.minute
df_ml["order_dayofyear"] = dt.dt.dayofyear
df_ml["order_is_weekend"] = (dt.dt.dayofweek >= 5).astype(int)
df_ml = df_ml.drop(columns=["order_datetime"])

if {"billing_zip", "shipping_zip"}.issubset(df_ml.columns):
    _bz = df_ml["billing_zip"].fillna("").astype(str).str.strip()
    _sz = df_ml["shipping_zip"].fillna("").astype(str).str.strip()
    df_ml["fe_addr_billing_shipping_zip_mismatch"] = (_bz != _sz).astype(int)

if {"shipping_state", "cust_state"}.issubset(df_ml.columns):
    df_ml["fe_addr_ship_state_neq_cust_state"] = (
        df_ml["shipping_state"].fillna("").astype(str).str.upper().str.strip()
        != df_ml["cust_state"].fillna("").astype(str).str.upper().str.strip()
    ).astype(int)

if {"order_total", "order_subtotal"}.issubset(df_ml.columns):
    df_ml["fe_money_total_over_subtotal"] = _safe_div(df_ml["order_total"], df_ml["order_subtotal"])

if {"tax_amount", "order_subtotal"}.issubset(df_ml.columns):
    df_ml["fe_money_tax_proxy_of_subtotal"] = _safe_div(df_ml["tax_amount"], df_ml["order_subtotal"])

if {"shipping_fee", "order_total"}.issubset(df_ml.columns):
    df_ml["fe_money_shipping_fee_share_of_total"] = _safe_div(df_ml["shipping_fee"], df_ml["order_total"])

if "order_total" in df_ml.columns:
    df_ml["fe_log1p_order_total"] = np.log1p(df_ml["order_total"].clip(lower=0))

if {"sum_line_total", "n_lines"}.issubset(df_ml.columns):
    df_ml["fe_basket_avg_line_value"] = _safe_div(df_ml["sum_line_total"], df_ml["n_lines"].clip(lower=1))

if {"total_quantity", "n_lines"}.issubset(df_ml.columns):
    df_ml["fe_basket_units_per_line"] = _safe_div(df_ml["total_quantity"], df_ml["n_lines"].clip(lower=1))

if {"promo_used", "n_lines"}.issubset(df_ml.columns):
    df_ml["fe_interact_promo_used_x_n_lines"] = (
        pd.to_numeric(df_ml["promo_used"], errors="coerce").fillna(0)
        * pd.to_numeric(df_ml["n_lines"], errors="coerce").fillna(0)
    )

y = df_ml["is_fraud"].astype(int)
X = df_ml.reindex(columns=FEATURE_COLS)
missing = [c for c in FEATURE_COLS if c not in df_ml.columns]
if missing:
    raise ValueError("Manifest expects columns not produced by SQL/FE: " + str(missing))

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
X_train.shape, X_test.shape
''')

CELL_MODEL = textwrap.dedent(r'''
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import (
    RandomForestClassifier,
    HistGradientBoostingClassifier,
    GradientBoostingClassifier,
)
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

numeric_pipe = Pipeline(
    steps=[("imputer", SimpleImputer(strategy="median"))]
)
categorical_pipe = Pipeline(
    steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ]
)
preprocess = ColumnTransformer(
    transformers=[
        ("num", numeric_pipe, NUM_COLS),
        ("cat", categorical_pipe, CAT_COLS),
    ]
)

# Map manifest champion → estimator; merge tuned params (strip `model__` prefix).
_tuned = {k.replace("model__", "", 1): v for k, v in MS["tuned_best_params"].items()}
_key = MS["cv_winner_key"]

if _key == "log_reg":
    _defaults = dict(max_iter=3000, class_weight="balanced", random_state=42)
    _defaults.update(_tuned)
    estimator = LogisticRegression(**_defaults)
elif _key == "random_forest":
    _defaults = dict(n_estimators=200, class_weight="balanced_subsample", random_state=42, n_jobs=-1)
    _defaults.update(_tuned)
    estimator = RandomForestClassifier(**_defaults)
elif _key == "hist_gboost":
    _defaults = dict(random_state=42)
    _defaults.update(_tuned)
    estimator = HistGradientBoostingClassifier(**_defaults)
elif _key == "grad_boost":
    _defaults = dict(random_state=42)
    _defaults.update(_tuned)
    estimator = GradientBoostingClassifier(**_defaults)
elif _key == "xgboost":
    from xgboost import XGBClassifier
    _defaults = dict(random_state=42, n_jobs=-1, eval_metric="logloss")
    _defaults.update(_tuned)
    estimator = XGBClassifier(**_defaults)
else:
    raise ValueError(f"Unknown cv_winner_key in manifest: {_key}")

slim_pipeline = Pipeline([("preprocess", preprocess), ("model", estimator)])
slim_pipeline.fit(X_train, y_train)

y_pred = slim_pipeline.predict(X_test)
y_proba = slim_pipeline.predict_proba(X_test)[:, 1]
print(classification_report(y_test, y_pred, digits=4))
print("ROC-AUC:", roc_auc_score(y_test, y_proba))
''')

CELL_COMPARE = textwrap.dedent(r'''
# Optional: compare to frozen `fraud_order_pipeline.joblib` (includes RFE + possibly different inner model).
import joblib

if JOBLIB_PATH.exists():
    frozen = joblib.load(JOBLIB_PATH)
    y_proba_f = frozen.predict_proba(X_test)[:, 1]
    print("Frozen pipeline ROC-AUC:", roc_auc_score(y_test, y_proba_f))
else:
    print("No joblib at", JOBLIB_PATH)
''')

def src_lines(s: str):
    if not s.endswith("\n"):
        s += "\n"
    return [s]

def md_cell(text: str):
    return {"cell_type": "markdown", "metadata": {}, "source": src_lines(text), "id": str(uuid.uuid4())[:8]}

def code_cell(text: str):
    return {
        "cell_type": "code",
        "metadata": {},
        "outputs": [],
        "source": src_lines(text),
        "id": str(uuid.uuid4())[:8],
    }

nb = {
    "cells": [
        md_cell(
            "# Fraud model — slim data + manifest-driven training\n\n"
            "This notebook **only queries columns needed** for `raw_feature_columns_in_X` in "
            "`fraud_model_manifest.json`, then rebuilds calendar and `fe_*` features like the main CRISP-DM notebook.\n\n"
            "**Model & hyperparameters** come from the manifest (`cv_winner_key`, `tuned_best_params`). "
            "After you change features in the main notebook, refresh the manifest (§9), then either edit "
            "`SLIM_ORDER_FEATURES_SQL` here or run `python build_fraud_slim_notebook.py` to regenerate this file.\n\n"
            "**Note:** `fraud_order_pipeline.joblib` may include **RFE** and differ slightly from this "
            "`preprocess + model` retrain. The optional last cell loads the joblib for comparison / production parity."
        ),
        code_cell(CELL_MANIFEST),
        code_cell(CELL_SQL),
        code_cell(CELL_FE),
        code_cell(CELL_MODEL),
        code_cell(CELL_COMPARE),
    ],
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.11.0"},
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Wrote", OUT)
