"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCustomers, getOrderHistory } from "@/lib/api";
import type { Customer, OrderHistoryRow } from "@/lib/types";

type CustomerOrdersPageProps = {
  params: Promise<{ customerId: string }>;
};

type SortKey = "orderDate" | "subtotal" | "status";

export default function CustomerOrdersPage({ params }: CustomerOrdersPageProps) {
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<OrderHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("orderDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const resolved = await params;
        const id = resolved.customerId;
        setCustomerId(id);

        const [customers, history] = await Promise.all([
          getCustomers(),
          getOrderHistory(id),
        ]);

        setCustomer(customers.find((item) => item.id === id) ?? null);
        setOrders(history);
      } catch {
        setError("Could not load order history.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params]);

  const sortedOrders = useMemo(() => {
    const list = [...orders];

    list.sort((a, b) => {
      let compare = 0;

      if (sortKey === "orderDate") {
        compare =
          new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      } else if (sortKey === "subtotal") {
        compare = a.subtotal - b.subtotal;
      } else {
        compare = a.status.localeCompare(b.status);
      }

      return sortDirection === "asc" ? compare : -compare;
    });

    return list;
  }, [orders, sortDirection, sortKey]);

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Order History</h2>
        <p className="mt-2 text-sm text-slate-600">
          Full order list for this customer.
        </p>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Loading order history...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Order History</h2>
        <p className="mt-2 text-sm text-slate-600">
          Full order list for this customer.
        </p>
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Order History</h2>
        <p className="mt-2 text-sm text-slate-600">
          Full order list for this customer.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Viewing customer: {customer?.fullName ?? customerId}
        </p>
        <p className="text-sm text-slate-600">Customer ID: {customerId}</p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-700">
            Sort by
            <select
              className="ml-2 rounded-md border px-2 py-1 text-sm"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="orderDate">Date</option>
              <option value="subtotal">Subtotal</option>
              <option value="status">Status</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Direction
            <select
              className="ml-2 rounded-md border px-2 py-1 text-sm"
              value={sortDirection}
              onChange={(e) =>
                setSortDirection(e.target.value as "asc" | "desc")
              }
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>

        {sortedOrders.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            No orders found for this customer.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-600">
                <tr>
                  <th className="px-2 py-2">Order ID</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Subtotal</th>
                  <th className="px-2 py-2">Shipping Fee</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order) => (
                  <tr key={order.orderId} className="border-b last:border-b-0">
                    <td className="px-2 py-2">{order.orderId}</td>
                    <td className="px-2 py-2">{order.orderDate}</td>
                    <td className="px-2 py-2">${order.subtotal.toFixed(2)}</td>
                    <td className="px-2 py-2">${order.shippingFee.toFixed(2)}</td>
                    <td className="px-2 py-2">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/customers/${customerId}`}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
        >
          Back to Dashboard
        </Link>
        <Link
          href={`/customers/${customerId}/new-order`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Create New Order
        </Link>
      </div>
    </section>
  );
}

