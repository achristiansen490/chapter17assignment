#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-shop.db}"
OUT_DIR="${2:-./supabase/import}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required but not installed."
  exit 1
fi

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database file not found: $DB_PATH"
  exit 1
fi

mkdir -p "$OUT_DIR"

tables=(
  customers
  products
  orders
  order_items
  product_reviews
  shipments
)

for table in "${tables[@]}"; do
  echo "Exporting $table -> $OUT_DIR/$table.csv"
  sqlite3 -header -csv "$DB_PATH" "SELECT * FROM $table;" > "$OUT_DIR/$table.csv"
done

echo "Done. CSV files are in $OUT_DIR"
