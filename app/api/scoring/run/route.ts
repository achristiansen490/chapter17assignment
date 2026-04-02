import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

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

  const { error: deleteError } = await supabase
    .from("order_predictions")
    .delete()
    .gte("order_id", 0);

  if (deleteError) {
    throw new Error(
      `Could not clear order_predictions before scoring: ${deleteError.message}`
    );
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("order_predictions").insert(inserts);

    if (insertError) {
      const minimalInserts: MinimalOrderPredictionInsert[] = inserts.map(
        (row) => ({
          order_id: row.order_id,
          customer_id: row.customer_id,
          customer_name: row.customer_name,
          late_delivery_probability: row.late_delivery_probability,
          scored_at: row.scored_at,
        })
      );

      const { error: minimalInsertError } = await supabase
        .from("order_predictions")
        .insert(minimalInserts);

      if (minimalInsertError) {
        throw new Error(
          `Could not write scored predictions: ${minimalInsertError.message}. Confirm order_predictions schema exists.`
        );
      }
    }
  }

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

    const result = await runFallbackScoringJob();
    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected scoring error.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
