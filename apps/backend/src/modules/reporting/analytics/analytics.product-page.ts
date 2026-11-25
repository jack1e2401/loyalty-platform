import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import type { AnalyticsRange } from "./analytics.types.js";

export type AnalyticsProductTable = "top" | "slow" | "no-sales" | "low-stock";

type ProductRow = {
  productId: number;
  productName: string;
  sku: string | null;
  unitsSold: bigint | number | null;
  revenueVnd: Prisma.Decimal | string | null;
  availableQuantity: bigint | number | null;
  lowStockThreshold: number | null;
  lastSoldAt: Date | null;
};

export async function getProductTable(
  merchantId: number,
  range: AnalyticsRange,
  table: AnalyticsProductTable,
  page: number,
  limit: number,
) {
  const window90Start = new Date(range.endExclusive.getTime() - 90 * 86_400_000);
  const sales = Prisma.sql`SELECT oi.productId, SUM(oi.quantity) AS unitsSold, SUM(oi.lineTotal) AS revenueVnd,
    MIN(oi.id) AS firstItemId
    FROM \`OrderItem\` oi JOIN \`Order\` o ON o.id = oi.orderId
    WHERE o.merchantId = ${merchantId} AND o.status IN ('PAID', 'REFUND_PENDING')
      AND o.paidAt >= ${range.startAt} AND o.paidAt < ${range.endExclusive}
    GROUP BY oi.productId`;
  const availability = Prisma.sql`COALESCE(b.onHandQuantity - b.reservedQuantity, 0)`;
  const base = table === "top"
    ? Prisma.sql`FROM (${sales}) sales
        JOIN \`Product\` p ON p.id = sales.productId AND p.kind = 'SALE' AND p.merchantId = ${merchantId}
        JOIN \`OrderItem\` firstItem ON firstItem.id = sales.firstItemId`
    : Prisma.sql`FROM \`Product\` p
        LEFT JOIN \`InventoryBalance\` b ON b.productId = p.id
        LEFT JOIN (${sales}) sales ON sales.productId = p.id
        WHERE p.merchantId = ${merchantId} AND p.status = 'ACTIVE'
        ${table === "low-stock" ? Prisma.sql`AND ${availability} <= p.lowStockThreshold` : Prisma.sql`AND p.kind = 'SALE'`}
        ${table === "no-sales" ? Prisma.sql`AND NOT EXISTS (
          SELECT 1 FROM \`OrderItem\` oi JOIN \`Order\` o ON o.id = oi.orderId
          WHERE oi.productId = p.id AND o.merchantId = ${merchantId}
            AND o.status IN ('PAID', 'REFUND_PENDING') AND o.paidAt >= ${window90Start} AND o.paidAt < ${range.endExclusive}
        )` : Prisma.empty}`;
  const select = table === "top"
    ? Prisma.sql`p.id AS productId, firstItem.productName, p.sku, sales.unitsSold, sales.revenueVnd,
        0 AS availableQuantity, NULL AS lowStockThreshold, NULL AS lastSoldAt`
    : Prisma.sql`p.id AS productId, p.name AS productName, p.sku, COALESCE(sales.unitsSold, 0) AS unitsSold,
        COALESCE(sales.revenueVnd, 0) AS revenueVnd, ${availability} AS availableQuantity, p.lowStockThreshold,
        ${table === "no-sales" ? Prisma.sql`(SELECT MAX(o.paidAt) FROM \`OrderItem\` oi
          JOIN \`Order\` o ON o.id = oi.orderId
          WHERE oi.productId = p.id AND o.merchantId = ${merchantId}
          AND o.status IN ('PAID', 'REFUND_PENDING') AND o.paidAt < ${range.endExclusive})` : Prisma.sql`NULL`} AS lastSoldAt`;
  const order = table === "top" ? Prisma.sql`unitsSold DESC, revenueVnd DESC, p.id ASC`
    : table === "slow" ? Prisma.sql`unitsSold ASC, revenueVnd ASC, availableQuantity DESC, p.id ASC`
      : table === "no-sales" ? Prisma.sql`availableQuantity DESC, p.id ASC`
        : Prisma.sql`availableQuantity ASC, p.id ASC`;
  const [rows, counts] = await prisma.$transaction([
    prisma.$queryRaw<ProductRow[]>(Prisma.sql`SELECT ${select} ${base} ORDER BY ${order}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${base}`),
  ]);
  const totalItems = Number(counts[0]?.total ?? 0);
  return {
    items: rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      unitsSold: Number(row.unitsSold ?? 0),
      revenueVnd: String(row.revenueVnd ?? "0"),
      availableQuantity: Number(row.availableQuantity ?? 0),
      lowStockThreshold: row.lowStockThreshold ?? 0,
      lastSoldAt: row.lastSoldAt?.toISOString() ?? null,
    })),
    pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
  };
}
