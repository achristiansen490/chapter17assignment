"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createOrder, getCustomers } from "@/lib/api";
import { mockProducts } from "@/lib/mock-data";
import type { Customer } from "@/lib/types";

type NewOrderPageProps = {
  params: Promise<{ customerId: string }>;
};

type DraftItem = {
  productId: string;
  quantity: number;
};

export default function NewOrderPage({ params }: NewOrderPageProps) {
  const [customerId, setCustomerId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantityInput, setQuantityInput] = useState(1);
  const [items, setItems] = useState<DraftItem[]>([]);

  const [submitPending, setSubmitPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const resolved = await params;
        const id = resolved.customerId;
        setCustomerId(id);
        const customers = await getCustomers();
        setCustomer(customers.find((item) => item.id === id) ?? null);
      } catch {
        setError("Could not load customer information.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params]);

  const runningTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = mockProducts.find((p) => p.id === item.productId);
      if (!product) return sum;
      return sum + product.price * item.quantity;
    }, 0);
  }, [items]);

  const addItem = () => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!selectedProductId) {
      setSubmitError("Please select a product.");
      return;
    }

    if (quantityInput <= 0) {
      setSubmitError("Quantity must be greater than 0.");
      return;
    }

    const existing = items.find((item) => item.productId === selectedProductId);
    if (existing) {
      setItems((prev) =>
        prev.map((item) =>
          item.productId === selectedProductId
            ? { ...item, quantity: item.quantity + quantityInput }
            : item
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        { productId: selectedProductId, quantity: quantityInput },
      ]);
    }

    setSelectedProductId("");
    setQuantityInput(1);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");

    if (items.length === 0) {
      setSubmitError("At least one item is required.");
      return;
    }

    if (items.some((item) => item.quantity <= 0)) {
      setSubmitError("All item quantities must be greater than 0.");
      return;
    }

    try {
      setSubmitPending(true);
      const payload = {
        customerId,
        items: items.map((item) => {
          const product = mockProducts.find((p) => p.id === item.productId);
          return {
            productId: item.productId,
            productName: product?.name ?? "Unknown Product",
            quantity: item.quantity,
          };
        }),
      };

      const result = await createOrder(payload);
      if (!result.ok) {
        setSubmitError("Order failed. Please try again.");
        return;
      }

      setSubmitSuccess(`Order submitted (placeholder): ${result.orderId}`);
      setItems([]);
    } catch {
      setSubmitError("Something went wrong while submitting the order.");
    } finally {
      setSubmitPending(false);
    }
  };

  if (loading) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">New Order</h2>
        <p className="mt-2 text-sm text-slate-600">
          Build a simple order for the selected customer.
        </p>
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Loading customer details...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">New Order</h2>
        <p className="mt-2 text-sm text-slate-600">
          Build a simple order for the selected customer.
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
        <h2 className="text-xl font-semibold">New Order</h2>
        <p className="mt-2 text-sm text-slate-600">
          Build a simple order for the selected customer.
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
        <h2 className="text-xl font-semibold">New Order</h2>
        <p className="mt-2 text-sm text-slate-600">
          Build a simple order for the selected customer.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Selected customer: {customer.fullName}
        </p>
        <p className="text-sm text-slate-600">Customer ID: {customerId}</p>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Add Items</h3>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
          <label className="text-sm text-slate-700">
            Product
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="">Select a product...</option>
              {mockProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} (${product.price.toFixed(2)})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Quantity
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={quantityInput}
              onChange={(e) => setQuantityInput(Number(e.target.value))}
            />
          </label>

          <button
            type="button"
            onClick={addItem}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            Add Item
          </button>
        </div>

        <div className="mt-5">
          <h4 className="text-sm font-semibold text-slate-800">Order Items</h4>

          {items.length === 0 ? (
            <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              No items added yet.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b text-slate-600">
                  <tr>
                    <th className="px-2 py-2">Product</th>
                    <th className="px-2 py-2">Price</th>
                    <th className="px-2 py-2">Quantity</th>
                    <th className="px-2 py-2">Line Total</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const product = mockProducts.find(
                      (p) => p.id === item.productId
                    );
                    const lineTotal = (product?.price ?? 0) * item.quantity;

                    return (
                      <tr key={item.productId} className="border-b last:border-b-0">
                        <td className="px-2 py-2">{product?.name ?? "Unknown"}</td>
                        <td className="px-2 py-2">
                          ${(product?.price ?? 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-2">{item.quantity}</td>
                        <td className="px-2 py-2">${lineTotal.toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Running Total: <span className="font-semibold">${runningTotal.toFixed(2)}</span>
        </div>

        {submitError && (
          <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {submitError}
          </p>
        )}

        {submitSuccess && (
          <p className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            {submitSuccess}
          </p>
        )}

        <div className="mt-5">
          <button
            type="submit"
            disabled={submitPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitPending ? "Submitting..." : "Submit Order"}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/customers/${customerId}`}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
        >
          Back to Dashboard
        </Link>
        <Link
          href={`/customers/${customerId}/orders`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          View Order History
        </Link>
      </div>
    </section>
  );
}

