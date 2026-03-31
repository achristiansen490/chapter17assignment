# Suggested Plan: CRISP-DM Notebook — Predicting `is_fraud` (Part 2 only)

This document supports **Part 2: CRISP-DM Jupyter Notebook — Predicting `is_fraud`** only: business framing through deployment, using `**shop.db**`, optional **Supabase** integration, and a **denormalized** modeling table.

**Local database path (authoritative):**  
`C:\Users\casey\Documents\OneDrive\IS jr\455\Chapter17Assignment\shop.db`

**Notebook:** `crips_dm_Juypyer_notebook_predicting_is_fraud.ipynb`

---

## 0. Setup and prerequisites

### Environment

- Use a consistent Python environment (conda/venv) with at least: **pandas**, **numpy**, **scikit-learn**, **sqlalchemy** and/or **sqlite3**, **matplotlib** / **seaborn**, **joblib** (or pickle) for serialization.
- For **Supabase:** install the official client, e.g. `pip install supabase` (and optionally `**psycopg2-binary`** or `**sqlalchemy**` if you connect with the Postgres connection string from the Supabase dashboard).

### Supabase (you referred to this as “soupabase” — this is the usual product)

Supabase is a hosted **PostgreSQL** backend with a dashboard, auth, and APIs. For this assignment you can use it in either or both of these ways:

1. **Mirror / store the modeling table**
  After you build a denormalized dataframe in Python (or SQL), write it to a table in Supabase (`pandas.to_sql` with a SQLAlchemy engine using the **connection string** from *Project Settings → Database*, or upload CSV via the Table Editor). Then you can load from Supabase for consistency checks or to show “cloud” integration.
2. **Query from the notebook**
  - **Postgres URL:** `create_engine(SUPABASE_DB_URL)` and `pd.read_sql("SELECT * FROM ml_orders_features", engine)`.  
  - **REST / client:** `supabase.table("ml_orders_features").select("*").execute()` — fine for small pulls; for large pulls, prefer SQL + pandas.

**Security:** Put the Supabase URL and keys in **environment variables** or a `.env` file that is **gitignored**; never commit secrets.

### Notebook structure

- One **markdown** cell per CRISP-DM phase (and subsections), then code cells underneath.

---

## 0b. What’s in `shop.db` (for denormalization)

These tables exist in the provided database (use this to plan joins and aggregates):


| Table                 | Role                                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**orders`**          | Primary grain: one row per order. Contains `**is_fraud**` (target) and order-level attributes (`order_datetime`, payment, device, amounts, `risk_score`, etc.). |
| `**customers**`       | One row per customer; join on `**customer_id**`.                                                                                                                |
| `**order_items**`     | Many rows per order; **aggregate** to order level (sums, counts, price stats).                                                                                  |
| `**products`**        | Join via `order_items.product_id`; aggregate categories / price bands at order level.                                                                           |
| `**shipments**`       | Join on `**order_id**` (often one row per order—confirm in EDA).                                                                                                |
| `**product_reviews**` | Join on `customer_id` / `product_id`; **watch for leakage** (only use signals knowable at order time unless reviews are strictly before `order_datetime`).      |


---

## 1. Business Understanding

**Goal:** Frame fraud detection as supervised classification on order-level labels.

- **Problem statement:** Predict `**is_fraud`** from order, customer, basket, and shipment-related inputs.
- **Stakeholders:** Fraud/risk, operations, customers (false positives vs. missed fraud).
- **Success criteria:** For imbalance, emphasize **precision/recall**, **F1**, **ROC-AUC**, or **PR-AUC**; tie metrics to business language (e.g. catching fraud vs. blocking legitimate orders).
- **Constraints:** Explainability, latency at scoring, course expectations.

*Deliverable:* Short prose + bullets; optional simple diagram.

---

## 2. Data Understanding

**Goal:** Understand raw tables, then the **denormalized** modeling frame (see §).3

- **SQLite:** Connect to the path above; confirm row counts, keys, and `**orders.is_fraud`** distribution.
- **Ch. 6 — Feature-level exploration (on the final modeling table):** dtypes, missingness, categoricals, class balance.
- **Ch. 8 — Relationships:** correlations / grouped rates vs. `**is_fraud`**; note redundancy and **leakage** (e.g. `risk_score` if it is a post-hoc fraud score—justify keep/drop).

*Deliverable:* EDA plots + brief interpretation; document any columns dropped for leakage.

---

## 3. Data Preparation — Denormalization + ML pipeline

**Goal:** One **order-level** row per `**order_id`** with rich features, then clean and pipeline (Ch. 7).

### Step A — Denormalize in SQL or pandas

Build a single table (conceptually `ml_orders` or similar) at the **same grain as `orders`**:

1. **Start from `orders`** — keep `**order_id**`, features you will use, and `**is_fraud**` as `y` (drop `y` from `X` in code, not necessarily from the SQL select until you split).
2. **Join `customers`** on `customer_id` — add demographics/location/segment (`gender`, `city`, `state`, `customer_segment`, `loyalty_tier`, etc.). Avoid duplicate column names (prefix e.g. `cust_`).
3. **Roll up `order_items` (+ `products` if needed)** per `order_id`:
  - Examples: `item_count`, `line_count`, `total_quantity`, `sum_line_total`, `mean_unit_price`, `n_distinct_products`, `n_distinct_categories`, dominant `category`, max `product` price, etc.
4. **Join `shipments`** on `order_id` — carrier, `distance_band`, `late_delivery`, `promised_days` vs `actual_days`, etc. (Handle multiple shipments per order if present: max/avg/sum as needed.)
5. `**product_reviews**` — only include if **temporally valid** (e.g. reviews with `review_datetime < order_datetime`); otherwise skip or use very conservative aggregates to avoid leakage.
6. **Result:** Either `pd.read_sql(long_query, sqlite_conn)` or merge/aggregate in pandas; then optional `**df.to_sql(..., supabase_engine)`** to persist a copy in Supabase.

### Step B — Wrangling and sklearn `Pipeline`

- Impute, encode, dates, outliers — same as course (Ch. 2–4).
- **Stratified** train/validation/test on `**is_fraud`**.
- `**Pipeline` + `ColumnTransformer`:** numeric vs. categorical columns; **do not** pass `is_fraud` into preprocessors as a feature.
- **Reproducibility:** `random_state` everywhere.

*Deliverable:* Documented denormalization logic + fitted preprocessing pipeline(s).

---

## 4. Modeling

**Goal:** Classification + **ensembles** (Ch. 13–14).

- Baselines (e.g. logistic regression, shallow tree).
- Ensembles: Random Forest, `HistGradientBoostingClassifier`, or XGBoost/LightGBM if allowed.
- Imbalance: `class_weight`, threshold tuning, or resampling—justify choices.

---

## 5. Evaluation & tuning (Ch. 15) and feature selection (Ch. 16)

- Metrics aligned with Business Understanding; **validation/CV** for model comparison.
- `**GridSearchCV` / `RandomizedSearchCV`** on training data (per course rules).
- **Feature selection (Ch. 16):** e.g. RFE, `SelectFromModel`, importance-based—compare to full feature set on validation.
- **Single final evaluation** on the held-out **test** set.

---

## 6. Deployment (Ch. 17)

- `**joblib.dump`** the **full fitted sklearn `Pipeline`** (preprocessing + model).
- Demo: `**joblib.load**`, then `predict` / `predict_proba` on new rows matching denormalized column layout.
- Short narrative: batch scoring vs. API; if Supabase holds feature rows, scoring could read inputs from Postgres and write predictions back—optional stretch for the write-up.

---

## 7. Notebook polish (Part 2 only)

- Headings for all six phases; **phase summaries** after major sections.
- Captions on figures; one-line rationale for modeling choices.

---

## 8. Suggested order of work (checklist)


| Step | Task                                                                           |
| ---- | ------------------------------------------------------------------------------ |
| 1    | Open `shop.db` at the path above; confirm tables and `**orders.is_fraud`**     |
| 2    | (Optional) Create Supabase project; store DB URL in env; test connection       |
| 3    | Design denormalization (joins + aggregates); build `ml_orders`-style dataframe |
| 4    | (Optional) Push denormalized table to Supabase; document table name            |
| 5    | Business Understanding (markdown)                                              |
| 6    | EDA on modeling table + relationship / leakage notes                           |
| 7    | Train/val/test split; `Pipeline` + feature lists                               |
| 8    | Train baselines + ensembles; CV or validation comparison                       |
| 9    | Tune; optional feature selection                                               |
| 10   | Final test metrics; save pipeline; load + predict demo                         |
| 11   | Proofread CRISP-DM story (Part 2 scope only)                                   |


---

## Scope reminder

This plan is **only** for **Part 2** (CRISP-DM notebook, `is_fraud`, SQLite + optional Supabase + denormalization + modeling through serialized pipeline). Other assignment parts are out of scope here.