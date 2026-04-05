import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ShipmentRow = {
  order_id: number | string;
  actual_days: number | string | null;
  promised_days: number | string | null;
  ship_datetime: string | null;
  orders:
    | {
        customer_id?: number | string | null;
        risk_score?: number | string | null;
        customers?:
          | { full_name?: string | null }
          | { full_name?: string | null }[]
          | null;
      }
    | {
        customer_id?: number | string | null;
        risk_score?: number | string | null;
        customers?:
          | { full_name?: string | null }
          | { full_name?: string | null }[]
          | null;
      }[]
    | null;
};

type OrderPredictionInsert = {
  order_id: number;
  customer_id: number;
  customer_name: string;
  late_delivery_probability: number;
  predicted_late_delivery: boolean;
  scored_at: string;
  model_version: string;
  model_source: string;
};

type MinimalOrderPredictionInsert = {
  order_id: number;
  customer_id: number;
  customer_name: string;
  late_delivery_probability: number;
  scored_at: string;
};

type LegacyPredictionInsert = {
  order_id: number;
  customer_name: string;
  late_delivery_probability: number;
  scored_at: string;
};

type FraudPredictionInsert = {
  order_id: number;
  customer_id?: number;
  customer_name?: string;
  fraud_probability: number;
  scored_at: string;
};

type ProductRow = {
  sku?: string | null;
  category?: string | null;
  product_name?: string | null;
  price?: number | string | null;
  cost?: number | string | null;
  is_active?: number | string | null;
};

type OrderItemRow = {
  order_item_id?: number | string | null;
  product_id?: number | string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  line_total?: number | string | null;
  products?: ProductRow | ProductRow[] | null;
};

type CustomerRow = {
  full_name?: string | null;
  email?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  created_at?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  customer_segment?: string | null;
  loyalty_tier?: string | null;
  is_active?: number | string | null;
};

type OrderFeatureFetchRow = {
  order_id: number | string;
  customer_id: number | string | null;
  order_datetime: string | null;
  billing_zip?: string | null;
  shipping_zip?: string | null;
  shipping_state?: string | null;
  payment_method?: string | null;
  device_type?: string | null;
  ip_country?: string | null;
  promo_used?: number | string | null;
  promo_code?: string | null;
  order_subtotal?: number | string | null;
  shipping_fee?: number | string | null;
  tax_amount?: number | string | null;
  order_total?: number | string | null;
  customers?: CustomerRow | CustomerRow[] | null;
  shipments?:
    | {
        carrier?: string | null;
        shipping_method?: string | null;
        distance_band?: string | null;
        promised_days?: number | string | null;
      }
    | {
        carrier?: string | null;
        shipping_method?: string | null;
        distance_band?: string | null;
        promised_days?: number | string | null;
      }[]
    | null;
  order_items?: OrderItemRow[] | null;
};

type NotebookFeatureRow = {
  order_id: number;
  customer_id: number;
  customer_name: string;
  scored_at: string;
  [key: string]: string | number | null;
};

type NotebookScoringResult = {
  order_id: number;
  fraud_probability: number;
  predicted_class: number;
};

type NotebookScoringResponse = {
  ok: boolean;
  mode: "full" | "slim";
  model_version: string;
  results: NotebookScoringResult[];
};

function resolveSupabaseEnv() {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key };
}

function computeFallbackProbability(
  actualDays: number,
  promisedDays: number,
  riskScore: number
) {
  const deliveryRisk = Math.min(actualDays / Math.max(promisedDays, 1), 1);
  const fraudRisk = Math.min(Math.max(riskScore / 100, 0), 1);
  const combined = 0.55 * deliveryRisk + 0.45 * fraudRisk;
  return Math.round(Math.min(Math.max(combined, 0), 1) * 1000) / 1000;
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampProbability(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 1) * 1000) / 1000;
}

function safeDiv(
  numerator: string | number | null | undefined,
  denominator: string | number | null | undefined
) {
  const num = Number(numerator);
  const den = Number(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function toDateParts(iso: string | null) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return {
      order_year: null,
      order_month: null,
      order_day_of_month: null,
      order_day_of_week: null,
      order_hour: null,
      order_minute: null,
      order_dayofyear: null,
      order_is_weekend: null,
    };
  }
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const current = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const dayOfYear = Math.floor((current.getTime() - start.getTime()) / 86400000) + 1;
  const dow = date.getUTCDay();
  return {
    order_year: date.getUTCFullYear(),
    order_month: date.getUTCMonth() + 1,
    order_day_of_month: date.getUTCDate(),
    order_day_of_week: dow,
    order_hour: date.getUTCHours(),
    order_minute: date.getUTCMinutes(),
    order_dayofyear: dayOfYear,
    order_is_weekend: dow === 0 || dow === 6 ? 1 : 0,
  };
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function uniqueCsv(values: Array<string | null | undefined>) {
  const normalized = values
    .map((v) => (v ?? "").toString().trim())
    .filter((v) => v.length > 0);
  return Array.from(new Set(normalized)).join(", ") || null;
}

function buildFeatureRow(row: OrderFeatureFetchRow): NotebookFeatureRow {
  const customer = asSingle(row.customers);
  const shipment = asSingle(row.shipments);
  const items = row.order_items ?? [];
  const products = items.map((item) => asSingle(item.products));

  const quantities = items.map((item) => toNumber(item.quantity, 0));
  const unitPrices = items.map((item) => toNumber(item.unit_price, 0));
  const lineTotals = items.map((item) => toNumber(item.line_total, 0));
  const itemIds = items.map((item) => toNumber(item.order_item_id, 0)).filter((n) => n > 0);
  const productIds = items.map((item) => toNumber(item.product_id, 0)).filter((n) => n > 0);

  const categories = products.map((p) => p?.category ?? null);
  const productNames = products.map((p) => p?.product_name ?? null);
  const skus = products.map((p) => p?.sku ?? null);
  const productCosts = products.map((p) => toNumber(p?.cost, 0));
  const productListPrices = products.map((p) => toNumber(p?.price, 0));
  const productIsActive = products.map((p) => toNumber(p?.is_active, 0));

  const nLines = items.length;
  const totalQuantity = quantities.reduce((a, b) => a + b, 0);
  const sumLineTotal = lineTotals.reduce((a, b) => a + b, 0);
  const orderSubtotal = toNumber(row.order_subtotal, 0);
  const orderTotal = toNumber(row.order_total, 0);
  const taxAmount = toNumber(row.tax_amount, 0);
  const shippingFee = toNumber(row.shipping_fee, 0);

  const dateParts = toDateParts(row.order_datetime ?? null);
  const billingZip = (row.billing_zip ?? "").toString().trim();
  const shippingZip = (row.shipping_zip ?? "").toString().trim();
  const shippingState = (row.shipping_state ?? "").toString().trim().toUpperCase();
  const customerState = (customer?.state ?? "").toString().trim().toUpperCase();
  const promoUsed = toNumber(row.promo_used, 0);

  return {
    order_id: toNumber(row.order_id, 0),
    customer_id: toNumber(row.customer_id, 0),
    customer_name: customer?.full_name ?? "Unknown",
    scored_at: row.order_datetime ?? new Date().toISOString(),

    billing_zip: row.billing_zip ?? null,
    shipping_zip: row.shipping_zip ?? null,
    shipping_state: row.shipping_state ?? null,
    payment_method: row.payment_method ?? null,
    device_type: row.device_type ?? null,
    ip_country: row.ip_country ?? null,
    promo_used: promoUsed,
    promo_code: row.promo_code ?? null,
    order_subtotal: orderSubtotal,
    shipping_fee: shippingFee,
    tax_amount: taxAmount,
    order_total: orderTotal,

    cust_full_name: customer?.full_name ?? null,
    cust_email: customer?.email ?? null,
    cust_gender: customer?.gender ?? null,
    cust_birthdate: customer?.birthdate ?? null,
    cust_created_at: customer?.created_at ?? null,
    cust_city: customer?.city ?? null,
    cust_state: customer?.state ?? null,
    cust_zip: customer?.zip_code ?? null,
    cust_customer_segment: customer?.customer_segment ?? null,
    cust_loyalty_tier: customer?.loyalty_tier ?? null,
    cust_is_active: toNumber(customer?.is_active, 0),

    ship_carrier: shipment?.carrier ?? null,
    ship_shipping_method: shipment?.shipping_method ?? null,
    ship_distance_band: shipment?.distance_band ?? null,
    ship_promised_days: toNumber(shipment?.promised_days, 0),

    n_lines: nLines,
    oi_n_distinct_order_item_ids: new Set(itemIds).size,
    oi_min_order_item_id: itemIds.length ? Math.min(...itemIds) : 0,
    oi_max_order_item_id: itemIds.length ? Math.max(...itemIds) : 0,
    total_quantity: totalQuantity,
    oi_avg_quantity_per_line: nLines ? totalQuantity / nLines : 0,
    oi_min_line_quantity: quantities.length ? Math.min(...quantities) : 0,
    oi_max_line_quantity: quantities.length ? Math.max(...quantities) : 0,
    oi_avg_unit_price: unitPrices.length
      ? unitPrices.reduce((a, b) => a + b, 0) / unitPrices.length
      : 0,
    oi_min_unit_price: unitPrices.length ? Math.min(...unitPrices) : 0,
    oi_max_unit_price: unitPrices.length ? Math.max(...unitPrices) : 0,
    sum_line_total: sumLineTotal,
    oi_avg_line_total: lineTotals.length
      ? lineTotals.reduce((a, b) => a + b, 0) / lineTotals.length
      : 0,
    oi_min_line_total: lineTotals.length ? Math.min(...lineTotals) : 0,
    oi_max_line_total: lineTotals.length ? Math.max(...lineTotals) : 0,
    n_distinct_products: new Set(productIds).size,
    n_distinct_categories: new Set(categories.filter(Boolean)).size,
    oi_n_distinct_skus: new Set(skus.filter(Boolean)).size,
    oi_sum_qty_times_product_cost: quantities.reduce(
      (sum, qty, i) => sum + qty * (productCosts[i] ?? 0),
      0
    ),
    oi_sum_qty_times_product_list_price: quantities.reduce(
      (sum, qty, i) => sum + qty * (productListPrices[i] ?? 0),
      0
    ),
    oi_avg_product_list_price: productListPrices.length
      ? productListPrices.reduce((a, b) => a + b, 0) / productListPrices.length
      : 0,
    oi_min_product_list_price: productListPrices.length
      ? Math.min(...productListPrices)
      : 0,
    oi_max_product_list_price: productListPrices.length
      ? Math.max(...productListPrices)
      : 0,
    oi_avg_product_cost: productCosts.length
      ? productCosts.reduce((a, b) => a + b, 0) / productCosts.length
      : 0,
    oi_min_product_is_active: productIsActive.length ? Math.min(...productIsActive) : 0,
    oi_max_product_is_active: productIsActive.length ? Math.max(...productIsActive) : 0,
    oi_concat_categories: uniqueCsv(categories),
    oi_concat_product_names: uniqueCsv(productNames),

    // Lightweight/slim production path: review-derived features are left null/0.
    rev_n_reviews: 0,
    rev_avg_rating: null,
    rev_min_rating: null,
    rev_max_rating: null,
    rev_min_review_datetime: null,
    rev_max_review_datetime: null,
    rev_sum_text_length: 0,
    rev_review_text_concat: null,

    ...dateParts,
    fe_addr_billing_shipping_zip_mismatch:
      billingZip && shippingZip && billingZip !== shippingZip ? 1 : 0,
    fe_addr_ship_state_neq_cust_state:
      shippingState && customerState && shippingState !== customerState ? 1 : 0,
    fe_money_total_over_subtotal: safeDiv(orderTotal, orderSubtotal),
    fe_money_tax_proxy_of_subtotal: safeDiv(taxAmount, orderSubtotal),
    fe_money_shipping_fee_share_of_total: safeDiv(shippingFee, orderTotal),
    fe_log1p_order_total: Math.log1p(Math.max(orderTotal, 0)),
    fe_basket_avg_line_value: safeDiv(sumLineTotal, nLines),
    fe_basket_units_per_line: safeDiv(totalQuantity, nLines),
    fe_interact_promo_used_x_n_lines: promoUsed * nLines,
  };
}

function runPythonScoringProcess(
  pythonCommand: "python3" | "python",
  rows: NotebookFeatureRow[],
  mode: "full" | "slim"
): Promise<NotebookScoringResponse> {
  const scriptPath = path.join(process.cwd(), "score_fraud_batch.py");
  const payload = JSON.stringify({ rows, mode });

  return new Promise((resolve, reject) => {
    const child = spawn(pythonCommand, [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`${pythonCommand} spawn failed: ${error.message}`));
    });
    child.on("close", (code) => {
      try {
        const parsed = JSON.parse(stdout || "{}") as
          | NotebookScoringResponse
          | { ok?: boolean; error?: string };
        if (code !== 0 || !parsed.ok || !("results" in parsed)) {
          const errMsg =
            ("error" in parsed && parsed.error) ||
            stderr ||
            stdout ||
            `Python scorer exited with code ${code ?? "unknown"}.`;
          reject(new Error(errMsg));
          return;
        }
        resolve(parsed);
      } catch {
        reject(
          new Error(
            `Could not parse scorer output from ${pythonCommand}. stderr: ${stderr || "(none)"}`
          )
        );
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

async function runNotebookScoring(
  rows: NotebookFeatureRow[]
): Promise<NotebookScoringResponse> {
  const preferSlim = process.env.ML_SCORING_PREFER_SLIM !== "false";
  const modeOrder: Array<"full" | "slim"> = preferSlim
    ? ["slim", "full"]
    : ["full", "slim"];
  const pythonOrder: Array<"python3" | "python"> = ["python3", "python"];
  const errors: string[] = [];

  for (const mode of modeOrder) {
    for (const pythonCommand of pythonOrder) {
      try {
        return await runPythonScoringProcess(pythonCommand, rows, mode);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${pythonCommand} (${mode}): ${message}`);
      }
    }
  }
  throw new Error(`Notebook scoring failed. ${errors.join(" | ")}`);
}

async function buildNotebookFeatureRows() {
  const { url, key } = resolveSupabaseEnv();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_id, customer_id, order_datetime, billing_zip, shipping_zip, shipping_state, payment_method, device_type, ip_country, promo_used, promo_code, order_subtotal, shipping_fee, tax_amount, order_total, customers(full_name, email, gender, birthdate, created_at, city, state, zip_code, customer_segment, loyalty_tier, is_active), shipments(carrier, shipping_method, distance_band, promised_days), order_items(order_item_id, product_id, quantity, unit_price, line_total, products(sku, category, product_name, price, cost, is_active))"
    )
    .order("order_id", { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Could not fetch orders for notebook scoring: ${error.message}`);
  }

  const featureRows = ((data ?? []) as OrderFeatureFetchRow[]).map(buildFeatureRow);
  return { supabase, featureRows };
}

async function writePredictions(
  supabase: SupabaseClient,
  inserts: OrderPredictionInsert[]
) {
  const { error: deleteError } = await supabase
    .from("order_predictions")
    .delete()
    .gte("order_id", 0);

  if (deleteError) {
    throw new Error(
      `Could not clear order_predictions before scoring: ${deleteError.message}`
    );
  }

  if (inserts.length === 0) return;

  // Modern schema: includes customer_id + predicted_late_delivery + model metadata.
  const { error: fullInsertError } = await supabase
    .from("order_predictions")
    .insert(inserts);
  if (!fullInsertError) return;

  // Transitional schema: keep core queue fields, still includes customer_id.
  const minimalInserts: MinimalOrderPredictionInsert[] = inserts.map((row) => ({
    order_id: row.order_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    late_delivery_probability: row.late_delivery_probability,
    scored_at: row.scored_at,
  }));
  const { error: minimalInsertError } = await supabase
    .from("order_predictions")
    .insert(minimalInserts);
  if (!minimalInsertError) return;

  // Legacy schema without customer_id.
  const legacyInserts: LegacyPredictionInsert[] = inserts.map((row) => ({
    order_id: row.order_id,
    customer_name: row.customer_name,
    late_delivery_probability: row.late_delivery_probability,
    scored_at: row.scored_at,
  }));
  const { error: legacyInsertError } = await supabase
    .from("order_predictions")
    .insert(legacyInserts);
  if (!legacyInsertError) return;

  // Fraud-oriented schema variant used by some earlier notebook integrations.
  const fraudInsertsWithCustomerId: FraudPredictionInsert[] = inserts.map((row) => ({
    order_id: row.order_id,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    fraud_probability: row.late_delivery_probability,
    scored_at: row.scored_at,
  }));
  const { error: fraudWithCustomerIdError } = await supabase
    .from("order_predictions")
    .insert(fraudInsertsWithCustomerId);
  if (!fraudWithCustomerIdError) return;

  const fraudInsertsLegacy: FraudPredictionInsert[] = inserts.map((row) => ({
    order_id: row.order_id,
    customer_name: row.customer_name,
    fraud_probability: row.late_delivery_probability,
    scored_at: row.scored_at,
  }));
  const { error: fraudLegacyError } = await supabase
    .from("order_predictions")
    .insert(fraudInsertsLegacy);
  if (!fraudLegacyError) return;

  throw new Error(
    `Could not write scored predictions: ${fraudLegacyError.message}. order_predictions schema does not match expected columns (run supabase/01_schema.sql).`
  );
}

async function runFallbackScoringJob() {
  const { url, key } = resolveSupabaseEnv();
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("shipments")
    .select(
      "order_id, actual_days, promised_days, ship_datetime, orders(customer_id, risk_score, customers(full_name))"
    )
    .order("order_id", { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error(`Could not fetch shipments for scoring: ${error.message}`);
  }

  const rows = (data ?? []) as ShipmentRow[];
  const scoredAt = new Date().toISOString();

  const inserts: OrderPredictionInsert[] = rows.map((row) => {
    const rawOrder = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    const rawCustomer = rawOrder?.customers;
    const customer =
      rawCustomer && Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;

    const promisedDays = Number(row.promised_days) || 1;
    const actualDays = Number(row.actual_days) || 0;
    const riskScore = Number(rawOrder?.risk_score) || 0;
    const probability = computeFallbackProbability(
      actualDays,
      promisedDays,
      riskScore
    );

    return {
      order_id: Number(row.order_id),
      customer_id: Number(rawOrder?.customer_id ?? 0),
      customer_name: customer?.full_name ?? "Unknown",
      late_delivery_probability: probability,
      predicted_late_delivery: probability >= 0.5,
      scored_at: row.ship_datetime ?? scoredAt,
      model_version: "fallback-v1",
      model_source: "next-api",
    };
  });

  await writePredictions(supabase, inserts);

  return {
    updatedCount: inserts.length,
    message: `Scoring completed (${inserts.length} predictions refreshed via fallback scoring).`,
  };
}

export async function POST() {
  try {
    const externalEndpoint = process.env.ML_SCORING_ENDPOINT_URL;
    const externalToken = process.env.ML_SCORING_ENDPOINT_BEARER_TOKEN;

    if (externalEndpoint) {
      const response = await fetch(externalEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(externalToken
            ? { Authorization: `Bearer ${externalToken}` }
            : {}),
        },
        body: JSON.stringify({
          triggeredAt: new Date().toISOString(),
          source: "chapter17assignment-web",
        }),
        cache: "no-store",
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: `ML endpoint returned ${response.status}.`,
          },
          { status: 502 }
        );
      }

      let endpointMessage = "Scoring job triggered successfully.";
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload?.message) endpointMessage = payload.message;
      } catch {
        // Non-JSON responses are fine; return a generic success message.
      }

      return NextResponse.json({ ok: true, message: endpointMessage });
    }

    try {
      const { supabase, featureRows } = await buildNotebookFeatureRows();
      const scored = await runNotebookScoring(featureRows);
      const scoredAt = new Date().toISOString();
      const byOrderId = new Map<number, NotebookScoringResult>();
      for (const result of scored.results) {
        byOrderId.set(toNumber(result.order_id, 0), result);
      }

      const inserts: OrderPredictionInsert[] = featureRows.map((row) => {
        const prediction = byOrderId.get(row.order_id);
        const probability = clampProbability(prediction?.fraud_probability ?? 0);
        return {
          order_id: row.order_id,
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          late_delivery_probability: probability,
          predicted_late_delivery: probability >= 0.5,
          scored_at: row.scored_at ?? scoredAt,
          model_version: `${scored.model_version}:${scored.mode}`,
          model_source: "notebook-joblib",
        };
      });

      await writePredictions(supabase, inserts);
      return NextResponse.json({
        ok: true,
        message: `Scoring completed (${inserts.length} predictions using notebook ${scored.mode} mode).`,
      });
    } catch {
      const result = await runFallbackScoringJob();
      return NextResponse.json({
        ok: true,
        message: `${result.message} (fallback heuristic used)`,
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected scoring error.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
