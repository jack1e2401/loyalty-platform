import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Segmented, Skeleton } from "antd";
import { ChartBar, ChartLineUp } from "@phosphor-icons/react";
import type { RevenueSeriesPointDto } from "../../api/analytics-types";
import type { OrderDto } from "../../api/commerce-types";
import { ErrorState } from "../../components/ui";
import { CmsCard } from "./cms";
import type { RevenueChartMode, RevenuePlotDay } from "./MerchantRevenuePlot";

const RevenuePlot = lazy(() => import("./MerchantRevenuePlot"));
const timeZone = "Asia/Ho_Chi_Minh";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("vi-VN", { timeZone, month: "2-digit", day: "2-digit" });
const vnd = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const dayMs = 24 * 60 * 60 * 1000;

function buildDaysFromOrders(orders: readonly OrderDto[]): {
  days: RevenuePlotDay[];
  totalVnd: bigint;
  paidCount: number;
  refundPendingCount: number;
  refundedVnd: bigint;
} {
  const now = Date.now();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * dayMs);
    return { key: dayKey.format(date), label: dayLabel.format(date), amount: 0, orderCount: 0 };
  });
  const daysByKey = new Map(days.map((day) => [day.key, day]));
  let paidCount = 0;
  let refundPendingCount = 0;
  let refundedVnd = 0n;
  let totalVnd = 0n;

  for (const order of orders) {
    if (!order.paidAt) continue;
    if (order.status === "REFUNDED") {
      refundedVnd += BigInt(order.total);
      continue;
    }
    if (order.status !== "PAID" && order.status !== "REFUND_PENDING") continue;
    const day = daysByKey.get(dayKey.format(new Date(order.paidAt)));
    if (!day) continue;
    const val = Number(order.total);
    day.amount += val;
    day.orderCount += 1;
    totalVnd += BigInt(order.total);
    paidCount += 1;
    if (order.status === "REFUND_PENDING") refundPendingCount += 1;
  }

  return { days, totalVnd, paidCount, refundPendingCount, refundedVnd };
}

export function MerchantRevenueChart({
  series,
  orders,
  rangeDays = 7,
  loading,
  error,
  retry,
  totalRevenueVnd,
  refundPendingCount,
  refundedRevenueVnd,
}: {
  series?: RevenueSeriesPointDto[];
  orders?: OrderDto[] | null;
  rangeDays?: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
  totalRevenueVnd?: string;
  refundPendingCount?: number;
  refundedRevenueVnd?: string;
}) {
  const [chartMode, setChartMode] = useState<RevenueChartMode>("bar");

  const fallback = !series && orders ? buildDaysFromOrders(orders) : null;
  const plotDays: RevenuePlotDay[] = series
    ? series.map((pt) => ({ label: pt.label, amount: Number(pt.revenueVnd), orderCount: pt.orderCount }))
    : fallback?.days ?? [];

  const totalAmount = totalRevenueVnd
    ? BigInt(totalRevenueVnd)
    : series
      ? series.reduce((sum, pt) => sum + BigInt(pt.revenueVnd), 0n)
      : fallback?.totalVnd ?? 0n;

  const totalOrdersCount = series
    ? series.reduce((sum, pt) => sum + pt.orderCount, 0)
    : fallback?.paidCount ?? 0;

  const pendingCount = refundPendingCount ?? fallback?.refundPendingCount ?? 0;
  const refundedAmount = refundedRevenueVnd ? BigInt(refundedRevenueVnd) : fallback?.refundedVnd ?? 0n;

  return (
    <CmsCard
      title="Doanh thu đơn đủ điều kiện"
      description={`${rangeDays} ngày gần nhất · Tính theo thời điểm thanh toán giờ Việt Nam`}
      extra={
        <div className="flex items-center gap-2">
          <Segmented<RevenueChartMode>
            size="small"
            value={chartMode}
            onChange={setChartMode}
            style={{ background: "#edf2ed", padding: 2 }}
            options={[
              { value: "bar", icon: <ChartBar size={14} />, label: "Cột" },
              { value: "area", icon: <ChartLineUp size={14} />, label: "Đường" },
            ]}
          />
          <Button size="small">
            <Link to="/merchant/analytics">Chi tiết</Link>
          </Button>
        </div>
      }
      className="h-full"
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : totalOrdersCount === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-[#20392a]">Chưa có đơn đã thanh toán trong {rangeDays} ngày qua</p>
          <p className="mt-1 text-xs text-[#607767]">Doanh thu sẽ hiển thị tự động khi có đơn hàng thanh toán thành công.</p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-2xl font-extrabold tabular-nums text-[#20392a]">{vnd.format(totalAmount)}</p>
            <span className="text-xs text-[#607767]">
              {totalOrdersCount} đơn hợp lệ · {pendingCount} đơn chờ hoàn · đã hoàn {vnd.format(refundedAmount)}
            </span>
          </div>
          <Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-[#f3f6f2]" />}>
            <RevenuePlot days={plotDays} mode={chartMode} />
          </Suspense>
        </>
      )}
    </CmsCard>
  );
}
