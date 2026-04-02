# Frontend Integration Handoff (Alex)

## Frontend Pages Completed

- `/` - Select Customer
- `/customers/[customerId]` - Customer Dashboard
- `/customers/[customerId]/orders` - Order History
- `/customers/[customerId]/new-order` - New Order form
- `/warehouse/priority-queue` - Late Delivery Priority Queue

All pages are mock-first and UI-complete for presentation/demo flow.

## Mock Placeholder Functions (`lib/api.ts`)

These still return mock data and should be wired to real backend/Supabase:

- `getCustomers()`
- `getCustomerDashboard(customerId)`
- `getOrderHistory(customerId)`
- `createOrder(payload)`
- `getPriorityQueue()`
- `runScoring()`

## Data Each Page Expects

- **Select Customer (`/`)**
  - Customer list (`id`, `fullName`, optional `email`)
- **Dashboard (`/customers/[customerId]`)**
  - Customer info + dashboard summary + recent order rows
- **Order History (`/customers/[customerId]/orders`)**
  - List of order rows for one customer
- **New Order (`/customers/[customerId]/new-order`)**
  - Customer lookup for context; submit result from `createOrder`
- **Priority Queue (`/warehouse/priority-queue`)**
  - Scored orders list + `runScoring()` status response

## Expected Shapes (from `lib/types.ts`)

- **Customer**
  - `{ id: string, fullName: string, email?: string }`
- **DashboardSummary**
  - `{ customerId: string, totalOrders: number, totalSpend: number, recentOrdersCount: number, recentOrderDate: string | null }`
- **OrderHistoryRow**
  - `{ orderId: string, customerId: string, orderDate: string, subtotal: number, shippingFee: number, totalAmount: number, status: string }`
- **NewOrderInput** (submit payload)
  - `{ customerId: string, items: { productId: string, productName: string, quantity: number }[] }`
- **PriorityQueueRow**
  - `{ orderId: string, customerId: string, customerName: string, lateDeliveryProbability: number, scoredAt: string }`
- **Run Scoring Result**
  - `{ ok: boolean, message: string }`

## Mock Sources To Replace (`lib/mock-data.ts`)

- `mockCustomers`
- `mockProducts` (currently used by New Order UI)
- `mockPriorityQueue`

## Current UI Assumptions

- Priority queue is displayed as top 50 sorted by `lateDeliveryProbability` (desc).
- Predicted late delivery is shown as `Yes` when probability `>= 0.5`, else `No`.
- Dates/timestamps are rendered from strings (`toLocaleString()` on queue timestamps).
- New Order form is UI/validation-first; successful submit currently uses placeholder order id from `createOrder`.

## Easy Swap Points for Backend Wiring

- Keep page code mostly unchanged; replace internals of functions in `lib/api.ts`.
- Preserve field names in `lib/types.ts` to avoid UI refactors.
- If backend field names differ, map them inside `lib/api.ts` before returning to pages.
- New Order can keep current payload shape; wire `createOrder(payload)` to Supabase insert path.
- Priority queue page already expects:
  1. `runScoring()` trigger result
  2. subsequent `getPriorityQueue()` refresh

