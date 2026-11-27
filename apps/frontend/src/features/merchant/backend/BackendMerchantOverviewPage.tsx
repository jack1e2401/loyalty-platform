import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowSquareOut, Plus } from "@phosphor-icons/react";
import { Button, Segmented } from "antd";
import { createAnalyticsClient } from "../../../api/analytics-client";
import { createRefundsClient } from "../../../api/refunds-client";
import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { CmsPageHeader, CmsStatCard } from "../cms";
import { MerchantRevenueChart } from "../MerchantRevenueChart";
import { api, formatPrice, useToken } from "../merchant-page-support";
import { OverviewActionQueue, OverviewRecentOrders } from "./MerchantOverviewWidgets";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const refundsApi = createRefundsClient();

const vnDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function buildRange(days: number) {
  const now = new Date();
  const to = vnDateFormatter.format(now);
  const toStart = new Date(`${to}T00:00:00+07:00`);
  const from = vnDateFormatter.format(new Date(toStart.getTime() - (days - 1) * 86_400_000));
  return { from, to };
}

export function MerchantOverview() {
  const token = useToken();
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);
  const range = useMemo(() => buildRange(rangeDays), [rangeDays]);

  const store = useResource(() => api.getOwnMerchant(token), [token]);
  const products = useResource(() => api.listOwnProducts(token, { limit: 100 }), [token]);
  const analytics = useResource(
    () => analyticsApi.getMerchantAnalytics({ ...range, granularity: "day" }, token),
    [token, range.from, range.to],
  );
  const recentOrders = useResource(
    () => api.listMerchantOrders(token, { page: 1, limit: 5 }),
    [token],
  );
  const pendingOrders = useResource(
    () => api.listMerchantOrders(token, { status: "PENDING", page: 1, limit: 1 }),
    [token],
  );
  const pendingRefunds = useResource(
    () => refundsApi.listMerchantRefundRequests({ status: "PENDING_MERCHANT", page: 1, limit: 1 }, token),
    [token],
  );
  const rewards = useResource(() => api.listMerchantRewards(token), [token]);

  if (store.loading && !store.data) return <LoadingState cards={3} />;
  if (store.error) {
    return <ErrorState message={store.error} retry={store.reload} />;
  }

  const merchant = store.data?.merchant;
  if (!merchant) {
    return (
      <EmptyState
        title="Chưa có cửa hàng"
        description="Chưa có cấu hình cửa hàng cho ứng dụng này."
      />
    );
  }

  const kpis = analytics.data?.kpis;
  const totalProducts = products.data?.pagination?.totalItems ?? products.data?.items.length ?? 0;
  const activeProducts =
    products.data?.items.filter((item) => item.status === "ACTIVE" && item.kind !== "REWARD").length ?? 0;

  const pendingRewardsCount = (rewards.data?.rewards ?? []).filter(
    (v) => v.status === "AVAILABLE" || v.status === "PENDING_FULFILLMENT",
  ).length;

  const actionCounts = {
    pendingOrders: pendingOrders.data?.pagination?.totalItems ?? pendingOrders.data?.orders.length ?? 0,
    pendingRefunds: pendingRefunds.data?.pagination?.totalItems ?? pendingRefunds.data?.items.length ?? 0,
    pendingRewards: pendingRewardsCount,
    lowStock: analytics.data?.lowStockProducts?.length ?? 0,
  };

  const queueLoading =
    pendingOrders.loading || pendingRefunds.loading || rewards.loading || analytics.loading;

  return (
    <div className="grid gap-5">
      <CmsPageHeader
        title={`Tổng quan · ${merchant.name}`}
        description={`Mã cửa hàng #${merchant.id} · Theo dõi vận hành và tăng trưởng theo thời gian thực`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<7 | 30>
              value={rangeDays}
              onChange={setRangeDays}
              style={{ background: "#e9f0e9", border: "1px solid #d7e4d8", padding: 3 }}
              options={[
                { label: "7 ngày qua", value: 7 },
                { label: "30 ngày qua", value: 30 },
              ]}
            />
            <Button type="primary" icon={<Plus size={14} />} className="bg-[#20392a] hover:!bg-[#2e523c]">
              <Link to="/merchant/products/new">Thêm sản phẩm</Link>
            </Button>
            <Button>
              <Link to="/merchant/vouchers">Voucher</Link>
            </Button>
            <Button>
              <Link to="/merchant/events">Sự kiện</Link>
            </Button>
            {merchant.slug && (
              <Button icon={<ArrowSquareOut size={14} />}>
                <Link to={`/s/${merchant.slug}`} target="_blank" rel="noreferrer">
                  Gian hàng
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {/* Actionable To-do Strip */}
      <OverviewActionQueue counts={actionCounts} loading={queueLoading} />

      {/* Core Business & Loyalty KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CmsStatCard
          label={`Doanh thu thuần (${rangeDays} ngày)`}
          value={analytics.loading ? "—" : formatPrice(kpis?.qualifyingOrderRevenueVnd ?? "0")}
          description={`${kpis?.paidOrderCount ?? 0} đơn đã thanh toán`}
        />
        <CmsStatCard
          label="Giá trị đơn trung bình (AOV)"
          value={analytics.loading ? "—" : formatPrice(kpis?.averageOrderValueVnd ?? "0")}
          description={`${kpis?.returningCustomers ?? 0} khách hàng quay lại`}
        />
        <CmsStatCard
          label="Thành viên Loyalty"
          value={analytics.loading ? "—" : (kpis?.totalMembers ?? 0).toLocaleString("vi-VN")}
          description={`+${kpis?.newMembers ?? 0} thành viên mới trong kỳ`}
        />
        <CmsStatCard
          label="Sản phẩm đang mở bán"
          value={products.loading ? "—" : `${activeProducts} / ${totalProducts}`}
          description="Hiển thị trên gian hàng công khai"
        />
      </div>

      {/* Main Workspace: Revenue Chart + Recent Orders */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <MerchantRevenueChart
            series={analytics.data?.revenueSeries}
            rangeDays={rangeDays}
            loading={analytics.loading}
            error={analytics.error}
            retry={analytics.reload}
            totalRevenueVnd={kpis?.qualifyingOrderRevenueVnd}
            refundPendingCount={kpis?.refundPendingOrderCount}
            refundedRevenueVnd={kpis?.refundedRevenueVnd}
          />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <OverviewRecentOrders
            orders={recentOrders.data?.orders ?? null}
            loading={recentOrders.loading}
          />
        </div>
      </div>
    </div>
  );
}
