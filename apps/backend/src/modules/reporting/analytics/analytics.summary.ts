import { prisma } from "../../../lib/prisma.js";
import { buildRevenueSeries, computeAnalyticsKpis } from "./analytics.domain.js";
import type { AnalyticsRange } from "./analytics.types.js";

export async function getAnalyticsSummary(merchantId: number, range: AnalyticsRange) {
  const [ordersInRange, totalMembers, newMembers] = await prisma.$transaction([
    prisma.order.findMany({
      where: { merchantId, status: { in: ["PAID", "REFUND_PENDING", "REFUNDED"] }, paidAt: { gte: range.startAt, lt: range.endExclusive } },
      select: { memberId: true, status: true, total: true, paidAt: true },
    }),
    prisma.merchantMembership.count({ where: { merchantId } }),
    prisma.merchantMembership.count({ where: { merchantId, createdAt: { gte: range.startAt, lt: range.endExclusive } } }),
  ]);
  const qualifying = ordersInRange.filter((order) => order.status === "PAID" || order.status === "REFUND_PENDING");
  const memberIds = [...new Set(qualifying.map((order) => order.memberId))];
  const lifetime = memberIds.length ? await prisma.order.groupBy({
    by: ["memberId"], where: { merchantId, memberId: { in: memberIds }, status: { in: ["PAID", "REFUND_PENDING"] } },
    orderBy: { memberId: "asc" }, _count: { _all: true },
  }) : [];
  return {
    range: { from: range.from, to: range.to, granularity: range.granularity, timezone: range.timezone },
    kpis: computeAnalyticsKpis({ ordersInRange, totalMembers, newMembers, returningCustomers: lifetime.filter((row) => row._count._all >= 2).length }),
    revenueSeries: buildRevenueSeries(range, qualifying),
  };
}
