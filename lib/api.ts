import { supabase } from "./supabase";
import type {
  Customer,
  DashboardSummary,
  NewOrderInput,
  OrderHistoryRow,
  PriorityQueueRow,
  Product,
} from "./types";

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("customer_id, full_name, email")
    .order("full_name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.customer_id),
    fullName: row.full_name as string,
    email: row.email as string,
  }));
}

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("product_id, product_name, price")
    .eq("is_active", 1)
    .order("product_name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.product_id),
    name: row.product_name as string,
    price: Number(row.price),
  }));
}

export async function getCustomerDashboard(
  customerId: string
): Promise<DashboardSummary> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_id, order_total, order_datetime")
    .eq("customer_id", Number(customerId))
    .order("order_datetime", { ascending: false });

  if (error) throw new Error(error.message);

  const orders = data ?? [];

  return {
    customerId,
    totalOrders: orders.length,
    totalSpend: orders.reduce((sum, o) => sum + Number(o.order_total), 0),
    recentOrdersCount: Math.min(orders.length, 5),
    recentOrderDate: orders.length > 0 ? (orders[0].order_datetime as string) : null,
  };
}

export async function getOrderHistory(
  customerId: string
): Promise<OrderHistoryRow[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("order_id, customer_id, order_datetime, order_subtotal, shipping_fee, order_total, shipments(late_delivery)")
    .eq("customer_id", Number(customerId))
    .order("order_datetime", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const shipment = Array.isArray(row.shipments)
      ? row.shipments[0]
      : row.shipments;

    let status = "Processing";
    if (shipment) {
      status = (shipment as { late_delivery: number }).late_delivery === 1
        ? "Late Delivery"
        : "Delivered";
    }

    return {
      orderId: String(row.order_id),
      customerId: String(row.customer_id),
      orderDate: row.order_datetime as string,
      subtotal: Number(row.order_subtotal),
      shippingFee: Number(row.shipping_fee),
      totalAmount: Number(row.order_total),
      status,
    };
  });
}

export async function createOrder(
  payload: NewOrderInput
): Promise<{ ok: boolean; orderId: string }> {
  const productIds = payload.items.map((item) => Number(item.productId));
  const { data: products } = await supabase
    .from("products")
    .select("product_id, price")
    .in("product_id", productIds);

  const priceMap = new Map(
    (products ?? []).map((p) => [Number(p.product_id), Number(p.price)])
  );

  const subtotal = payload.items.reduce((sum, item) => {
    const price = priceMap.get(Number(item.productId)) ?? 0;
    return sum + price * item.quantity;
  }, 0);

  const shippingFee = 9.99;
  const taxAmount = Math.round(subtotal * 0.08 * 100) / 100;
  const orderTotal = Math.round((subtotal + shippingFee + taxAmount) * 100) / 100;

  const { data: orderRow, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: Number(payload.customerId),
      order_datetime: new Date().toISOString(),
      payment_method: "Credit Card",
      device_type: "Web",
      ip_country: "US",
      promo_used: 0,
      order_subtotal: subtotal,
      shipping_fee: shippingFee,
      tax_amount: taxAmount,
      order_total: orderTotal,
      risk_score: 0,
      is_fraud: 0,
    })
    .select("order_id")
    .single();

  if (orderError || !orderRow) {
    return { ok: false, orderId: "" };
  }

  const orderId = orderRow.order_id as number;

  const itemRows = payload.items.map((item) => {
    const unitPrice = priceMap.get(Number(item.productId)) ?? 0;
    return {
      order_id: orderId,
      product_id: Number(item.productId),
      quantity: item.quantity,
      unit_price: unitPrice,
      line_total: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  });

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(itemRows);

  if (itemsError) {
    return { ok: false, orderId: "" };
  }

  return { ok: true, orderId: String(orderId) };
}

export async function getPriorityQueue(): Promise<PriorityQueueRow[]> {
  const { data, error } = await supabase
    .from("shipments")
    .select("order_id, actual_days, promised_days, ship_datetime, orders(customer_id, customers(full_name))")
    .order("actual_days", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const promised = Number(row.promised_days) || 1;
    const actual = Number(row.actual_days) || 0;
    const probability = Math.min(actual / promised, 1.0);

    const rawOrder = row.orders;
    const order = (Array.isArray(rawOrder) ? rawOrder[0] : rawOrder) as
      | {
          customer_id?: number;
          customers?:
            | { full_name?: string }
            | { full_name?: string }[]
            | null;
        }
      | null
      | undefined;
    const rawCustomer = order?.customers;
    const customer = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
    const customerName = customer?.full_name ?? "Unknown";
    const customerId = order?.customer_id ?? 0;

    return {
      orderId: String(row.order_id),
      customerId: String(customerId),
      customerName,
      lateDeliveryProbability: Math.round(probability * 100) / 100,
      scoredAt: row.ship_datetime as string,
    };
  });
}

export async function runScoring(): Promise<{ ok: boolean; message: string }> {
  return { ok: true, message: "Scoring completed (placeholder — no ML endpoint wired yet)." };
}
