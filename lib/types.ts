export type Customer = {
  id: string;
  fullName: string;
  email?: string;
};

export type Product = {
  id: string;
  name: string;
  price: number;
};

export type DashboardSummary = {
  customerId: string;
  totalOrders: number;
  totalSpend: number;
  recentOrdersCount: number;
  recentOrderDate: string | null;
};

export type OrderHistoryRow = {
  orderId: string;
  customerId: string;
  orderDate: string;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  status: string;
};

export type NewOrderItemInput = {
  productId: string;
  productName: string;
  quantity: number;
};

export type NewOrderInput = {
  customerId: string;
  items: NewOrderItemInput[];
};

export type PriorityQueueRow = {
  orderId: string;
  customerId: string;
  customerName: string;
  lateDeliveryProbability: number;
  scoredAt: string;
};
