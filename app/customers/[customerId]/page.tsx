"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getCustomerDashboard,
  getCustomers,
  getOrderHistory,
} from "@/lib/api";
import type { Customer, DashboardSummary, OrderHistoryRow } from "@/lib/types";

type CustomerDashboardPageProps = {
  params: Promise<{ customerId: string }>;
};

export default function CustomerDashboardPage({
  params,
}: CustomerDashboardPageProps) {
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentOrders, setRecentOrders] = useState<OrderHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const resolved = await params;
        const id = resolved.customerId;
        setCustomerId(id);

        const [customers, dashboard, orders] = await Promise.all([
          getCustomers(),
          getCustomerDashboard(id),
          getOrderHistory(id),
        ]);

        const selectedCustomer = customers.find((item) => item.id === id) ?? null;
        setCustomer(selectedCustomer);
        setSummary(dashboard);
        setRecentOrders(orders.slice(0, 5));
      } catch {
        setError("Could not load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params]);

  const totalSpent = useMemo(() => {
    return summary?.totalSpend ? `$${summary.totalSpend.toFixed(2)}` : "$0.00";
  }, [summary]);

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Customer Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quick summary for this customer.
        </p>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Loading dashboard...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Customer Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quick summary for this customer.
        </p>
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      </section>
    );
  }

  if (!customer) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Customer Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quick summary for this customer.
        </p>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Customer not found.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">Customer Dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Quick summary for this customer.
        </p>
        <p className="mt-2 text-sm text-slate-600">Customer ID: {customer.id}</p>
        <p className="text-sm text-slate-700">{customer.fullName}</p>
        {customer.email && (
          <p className="text-sm text-slate-700">Email: {customer.email}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Total Orders</p>
          <p className="mt-1 text-2xl font-semibold">{summary?.totalOrders ?? 0}</p>
        </article>
        <article className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Total Spent</p>
          <p className="mt-1 text-2xl font-semibold">{totalSpent}</p>
        </article>
        <article className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">Recent Order Date</p>
          <p className="mt-1 text-2xl font-semibold">
            {summary?.recentOrderDate ?? "N/A"}
          </p>
        </article>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Recent Orders</h3>
          <Link
            href={`/customers/${customerId}/orders`}
            className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            View Full History
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            No recent orders available.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b text-slate-600">
                <tr>
                  <th className="px-2 py-2">Order ID</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Total</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.orderId} className="border-b last:border-b-0">
                    <td className="px-2 py-2">{order.orderId}</td>
                    <td className="px-2 py-2">{order.orderDate}</td>
                    <td className="px-2 py-2">${order.totalAmount.toFixed(2)}</td>
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
          href={`/customers/${customerId}/orders`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Order History
        </Link>
        <Link
          href={`/customers/${customerId}/new-order`}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
        >
          New Order
        </Link>
        <Link
          href="/warehouse/priority-queue"
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
        >
          Priority Queue
        </Link>
      </div>
    </section>
  );
}

