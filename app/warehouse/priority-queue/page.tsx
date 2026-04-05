"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getPriorityQueue, runScoring } from "@/lib/api";
import type { PriorityQueueRow } from "@/lib/types";

export default function PriorityQueuePage() {
  const [rows, setRows] = useState<PriorityQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadQueue = async (mode: "initial" | "refresh" = "initial") => {
    try {
      if (mode === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");
      const data = await getPriorityQueue();
      const top50 = [...data]
        .sort((a, b) => b.lateDeliveryProbability - a.lateDeliveryProbability)
        .slice(0, 50);

      setRows(top50);
      setLastUpdated(new Date().toISOString());
    } catch {
      setError("Could not load priority queue.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadQueue("initial");
  }, []);

  const onRefresh = async () => {
    setSuccess("");
    await loadQueue("refresh");
  };

  const onRunScoring = async () => {
    try {
      setScoring(true);
      setError("");
      setSuccess("");

      const result = await runScoring();
      if (!result.ok) {
        setError(result.message || "Run Scoring failed.");
        return;
      }

      setSuccess(result.message);
      await loadQueue("refresh");
    } catch {
      setError("Run Scoring failed.");
    } finally {
      setScoring(false);
    }
  };

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return "Not updated yet";
    return new Date(lastUpdated).toLocaleString();
  }, [lastUpdated]);

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Late Delivery Priority Queue</h2>
        <p className="mt-2 text-sm text-slate-600">
          Lists top orders by predicted late-delivery risk.
        </p>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Loading priority queue...
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Late Delivery Priority Queue</h2>
        <p className="mt-2 text-sm text-slate-600">
          Lists top orders by predicted late-delivery risk.
        </p>
        <p className="mt-2 text-xs text-slate-500">Last updated: {updatedLabel}</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing || scoring}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={onRunScoring}
            disabled={scoring || refreshing}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scoring ? "Running Scoring..." : "Run Scoring"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {success && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            No scored orders yet. Click <strong>Run Scoring</strong> to generate
            the priority queue.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-600">
                <tr>
                  <th className="px-2 py-2">Order ID</th>
                  <th className="px-2 py-2">Customer Name</th>
                  <th className="px-2 py-2">Late Delivery Probability</th>
                  <th className="px-2 py-2">Predicted Late Delivery</th>
                  <th className="px-2 py-2">Prediction Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const predictedLate = row.lateDeliveryProbability >= 0.5;
                  return (
                    <tr key={row.orderId} className="border-b last:border-b-0">
                      <td className="px-2 py-2">{row.orderId}</td>
                      <td className="px-2 py-2">{row.customerName}</td>
                      <td className="px-2 py-2">
                        {(row.lateDeliveryProbability * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2">
                        {predictedLate ? "Yes" : "No"}
                      </td>
                      <td className="px-2 py-2">
                        {new Date(row.scoredAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <Link
          href="/"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
        >
          Back to Select Customer
        </Link>
      </div>
    </section>
  );
}
