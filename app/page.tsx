"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCustomers } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { supabase } from "@/lib/supabase";

type Todo = {
  id: string | number;
  name: string;
};

export default function SelectCustomerPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [todos, setTodos] = useState<Todo[]>([]);
  const [todosError, setTodosError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        setTodosError("");
        const list = await getCustomers();
        setCustomers(list);

        const { data, error: supabaseError } = await supabase
          .from("todos")
          .select("id, name")
          .limit(10);

        if (supabaseError) {
          setTodosError("Could not load todos from Supabase.");
        } else if (data) {
          setTodos(data as Todo[]);
        }
      } catch {
        setError("Could not load customers.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const onContinue = () => {
    if (!selectedId) return;
    router.push(`/customers/${selectedId}`);
  };

  return (
    <section className="mx-auto max-w-xl rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-xl font-semibold">Select Customer</h2>
      <p className="mt-1 text-sm text-slate-600">
        Choose a customer to open their dashboard and order tools.
      </p>

      {loading && (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          Loading customers...
        </p>
      )}

      {!loading && error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {!loading && !error && customers.length === 0 && (
        <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          No customers found.
        </p>
      )}

      {!loading && !error && customers.length > 0 && (
        <div className="mt-4 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Customer
            <select
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select one...</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName} ({customer.id})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onContinue}
            disabled={!selectedId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open Dashboard
          </button>
        </div>
      )}

      {!loading && (
        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-semibold text-slate-900">Supabase Todos</h3>

          {todosError && (
            <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              {todosError}
            </p>
          )}

          {!todosError && todos.length === 0 && (
            <p className="mt-2 text-sm text-slate-600">
              No todos found in Supabase.
            </p>
          )}

          {!todosError && todos.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {todos.map((todo) => (
                <li key={todo.id}>{todo.name}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
