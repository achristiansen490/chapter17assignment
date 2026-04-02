## IS455 Chapter 17 App

Next.js app for customer/order workflows with Supabase integration.

This repository also contains a local SQLite dataset (`shop.db`) that you can migrate into Supabase for hosted use.

## Tech Stack

- Next.js (App Router)
- React
- Supabase (`@supabase/supabase-js`)
- SQLite (local source data for migration)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fdypupxmuuevlijadgqa.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_rx4XPHbuJYAH0qAAw5UR5g_sQDToeo2
VITE_SUPABASE_URL=https://fdypupxmuuevlijadgqa.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_rx4XPHbuJYAH0qAAw5UR5g_sQDToeo2
```

3. Run the app locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Migrate `shop.db` to Supabase

Current SQLite tables:

- `customers` (250 rows)
- `products` (100 rows)
- `orders` (5000 rows)
- `order_items` (15022 rows)
- `product_reviews` (3000 rows)
- `shipments` (5000 rows)

### 1. Replace filler schema/data in Supabase

Run `supabase/01_schema.sql` in Supabase SQL Editor.

This drops existing filler tables and recreates tables matching your SQLite structure.

### 2. Export CSV files from SQLite

From the project root:

```bash
./scripts/export-shopdb-csv.sh
```

This creates CSV files in `supabase/import/`.

### 3. Import CSVs into Supabase (order matters)

Use Supabase Studio (`Table Editor` -> table -> `Import data`) in this order:

1. `customers`
2. `products`
3. `orders`
4. `order_items`
5. `product_reviews`
6. `shipments`

If prompted, map CSV columns directly by name.

### 4. Verify row counts in Supabase

Run:

```sql
select 'customers' as table_name, count(*) from customers
union all
select 'products', count(*) from products
union all
select 'orders', count(*) from orders
union all
select 'order_items', count(*) from order_items
union all
select 'product_reviews', count(*) from product_reviews
union all
select 'shipments', count(*) from shipments;
```

Expected counts: `250, 100, 5000, 15022, 3000, 5000`.

## Deploy to Vercel

### 1. Push this repo to GitHub

Vercel will build from the connected GitHub repository.

### 2. Import project into Vercel

In Vercel dashboard:

1. `Add New` -> `Project`
2. Select this GitHub repository
3. Keep framework preset as `Next.js`

### 3. Set production environment variables in Vercel

Add these in `Project Settings` -> `Environment Variables`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Use the same values as local `.env.local` (or your updated production values).

### 4. Deploy

Trigger the first deployment from the dashboard (or by pushing to `main`).

If you change environment variables later, redeploy so the new values are applied.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Environment Variables Docs](https://vercel.com/docs/environment-variables/managing-environment-variables)
