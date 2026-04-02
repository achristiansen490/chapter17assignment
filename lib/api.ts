import { mockCustomers, mockPriorityQueue } from "./mock-data";
import type {
  Customer,
  DashboardSummary,
  NewOrderInput,
  OrderHistoryRow,
  PriorityQueueRow,
} from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCustomers(): Promise<Customer[]> {
  await delay(250);
  return mockCustomers;
}

export async function getCustomerDashboard(
  customerId: string
): Promise<DashboardSummary> {
  await delay(250);
  return {
    customerId,
    totalOrders: 8,
    totalSpend: 1240.5,
    recentOrdersCount: 3,
    recentOrderDate: "2026-03-20",
  };
}

export async function getOrderHistory(
  customerId: string
): Promise<OrderHistoryRow[]> {
  await delay(250);
  return [
    {
      orderId: "ORD-10001",
      customerId,
      orderDate: "2026-03-20",
      subtotal: 179.99,
      shippingFee: 10,
      totalAmount: 189.99,
      status: "Shipped",
    },
    {
      orderId: "ORD-10002",
      customerId,
      orderDate: "2026-03-15",
      subtotal: 66.25,
      shippingFee: 8,
      totalAmount: 74.25,
      status: "Delivered",
    },
    {
      orderId: "ORD-10003",
      customerId,
      orderDate: "2026-03-09",
      subtotal: 42.5,
      shippingFee: 7.5,
      totalAmount: 50,
      status: "Processing",
    },
  ];
}

export async function createOrder(payload: NewOrderInput): Promise<{
  ok: boolean;
  orderId: string;
}> {
  await delay(500);
  void payload;
  return {
    ok: true,
    orderId: `ORD-${Date.now()}`,
  };
}

export async function getPriorityQueue(): Promise<PriorityQueueRow[]> {
  await delay(250);
  return mockPriorityQueue;
}

export async function runScoring(): Promise<{ ok: boolean; message: string }> {
  await delay(600);
  return { ok: true, message: "Scoring completed (placeholder)." };
}

