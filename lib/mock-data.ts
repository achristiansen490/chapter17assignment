import type { Customer, PriorityQueueRow } from "./types";

export const mockCustomers: Customer[] = [
  { id: "CUST-1001", fullName: "Maya Bennett", email: "maya@example.com" },
  { id: "CUST-1002", fullName: "Noah Patel", email: "noah@example.com" },
  { id: "CUST-1003", fullName: "Ava Kim", email: "ava@example.com" },
  { id: "CUST-1004", fullName: "Liam Turner", email: "liam@example.com" },
];

export const mockPriorityQueue: PriorityQueueRow[] = [
  {
    orderId: "ORD-9001",
    customerId: "CUST-1002",
    customerName: "Noah Patel",
    lateDeliveryProbability: 0.86,
    scoredAt: new Date().toISOString(),
  },
  {
    orderId: "ORD-9002",
    customerId: "CUST-1001",
    customerName: "Maya Bennett",
    lateDeliveryProbability: 0.82,
    scoredAt: new Date().toISOString(),
  },
];

export const mockProducts = [
  { id: "PROD-2001", name: "Wireless Mouse", price: 24.99 },
  { id: "PROD-2002", name: "USB-C Charger", price: 19.5 },
  { id: "PROD-2003", name: "Keyboard", price: 44.0 },
  { id: "PROD-2004", name: "Laptop Stand", price: 36.25 },
];

