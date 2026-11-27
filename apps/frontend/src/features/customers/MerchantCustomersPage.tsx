import { useState, type FormEvent } from "react";
import { ArrowClockwise, ArrowRight, MagnifyingGlass } from "@phosphor-icons/react";
import { Alert, Button, Empty, Input, Skeleton, Typography, type TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import { createAnalyticsClient } from "../../api/analytics-client";
import type { CustomerPurchaseStatus } from "../../api/analytics-types";
import { useAuthSession } from "../../api/auth-session";
import type { MemberTier } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { CmsCard, CmsDataTable, CmsFilterBar, CmsPageHeader, CmsStatusTag, type CmsStatusTone } from "../merchant/cms";
import { MerchantPagination } from "../merchant/cms/MerchantPagination";
import { money } from "../../lib/utils";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

function tierLabel(tier: MemberTier, names: Map<string, string>) {
  return tier === "UNRANKED" ? "Chưa xếp hạng" : names.get(tier) ?? tier;
}

function tierTone(tier: MemberTier): CmsStatusTone {
  switch (tier) {
    case "PLATINUM":
      return "success";
    case "GOLD":
      return "warning";
    case "SILVER":
    case "BRONZE":
      return "info";
    default:
      return "neutral";
  }
}

export function MerchantCustomersPage() {
  const { accessToken } = useAuthSession();
  const [draftQuery, setDraftQuery] = useState("");
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<MemberTier | "">("");
  const [purchaseStatus, setPurchaseStatus] = useState<CustomerPurchaseStatus>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const resource = useResource(
    () =>
      analyticsApi.listMerchantCustomers(
        {
          q,
          tier: tier || undefined,
          purchaseStatus,
          page,
          limit,
        },
        accessToken!,
      ),
    [accessToken, q, tier, purchaseStatus, page, limit],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQ(draftQuery.trim());
    setPage(1);
  }

  function resetFilters() {
    setDraftQuery("");
    setQ("");
    setTier("");
    setPurchaseStatus("all");
    setPage(1);
  }

  const items = resource.data?.items ?? [];
  const pagination = resource.data?.pagination ?? { page: 1, limit, totalItems: 0, totalPages: 0 };
  const tierNames = new Map((resource.data?.tiers ?? []).map((item) => [item.level, item.name]));
  const hasFilters = Boolean(q || tier || purchaseStatus !== "all");

  const columns: TableColumnsType<(typeof items)[number]> = [
    {
      title: "Khách hàng",
      key: "customer",
      width: 240,
      render: (_: unknown, item) => (
        <div className="min-w-0 break-all">
          <Link to={`/merchant/customers/${item.memberId}`} className="font-bold text-[#20392a] hover:text-[#356b43]">
            {item.name || item.email}
          </Link>
          {item.name ? <div className="mt-0.5 text-xs text-[#68776d]">{item.email}</div> : null}
          <div className="mt-0.5 text-xs text-[#68776d]">#{item.memberId}</div>
        </div>
      ),
    },
    {
      title: "Ngày tham gia",
      dataIndex: "joinedAt",
      key: "joinedAt",
      width: 120,
      render: (joinedAt: string) => (
        <time dateTime={joinedAt} className="text-xs text-[#68776d]">
          {new Date(joinedAt).toLocaleDateString("vi-VN")}
        </time>
      ),
    },
    {
      title: "Hạng",
      dataIndex: "tier",
      key: "tier",
      width: 130,
      render: (memberTier: MemberTier) => (
        <CmsStatusTag label={tierLabel(memberTier, tierNames)} tone={tierTone(memberTier)} />
      ),
    },
    {
      title: "Điểm khả dụng / Tích lũy",
      key: "points",
      align: "right",
      width: 170,
      render: (_: unknown, item) => (
        <div className="tabular-nums">
          <div className="font-bold text-[#20392a]">{item.availablePoints.toLocaleString("vi-VN")}</div>
          <div className="mt-0.5 text-xs text-[#68776d]">Tích lũy {item.netLifetimeEarned}</div>
          {item.pointDebt !== "0" ? (
            <div className="mt-1">
              <CmsStatusTag label={`Nợ ${item.pointDebt}`} tone="error" />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Đơn đã trả",
      key: "orders",
      align: "right",
      width: 130,
      render: (_: unknown, item) => (
        <div className="tabular-nums">
          <div className="font-semibold text-[#20392a]">{item.paidOrderCount}</div>
          {item.refundPendingOrderCount > 0 ? (
            <div className="mt-1">
              <CmsStatusTag label={`+${item.refundPendingOrderCount} chờ hoàn`} tone="warning" />
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Chi tiêu đủ điều kiện",
      key: "spend",
      align: "right",
      width: 160,
      render: (_: unknown, item) => (
        <div className="font-semibold text-[#20392a] tabular-nums">
          <div>{money(Number(item.netSpendVnd))}</div>
          {item.refundPendingOrderCount > 0 ? (
            <div className="mt-0.5 text-xs font-normal text-[#97682a]">
              Chờ hoàn {money(Number(item.refundPendingSpendVnd))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Mua gần nhất",
      dataIndex: "lastPurchaseAt",
      key: "lastPurchaseAt",
      width: 120,
      render: (lastPurchaseAt: string | null) =>
        lastPurchaseAt ? (
          <time dateTime={lastPurchaseAt} className="text-xs text-[#68776d]">
            {new Date(lastPurchaseAt).toLocaleDateString("vi-VN")}
          </time>
        ) : (
          <span className="text-xs text-[#68776d]">—</span>
        ),
    },
    {
      title: "Thao tác",
      key: "actions",
      align: "right",
      width: 110,
      render: (_: unknown, item) => (
        <Link to={`/merchant/customers/${item.memberId}`} aria-label={`Chi tiết ${item.email}`}>
          <Button size="small" icon={<ArrowRight size={14} />} iconPlacement="end">
            Chi tiết
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <section className="grid min-w-0 gap-5">
      <CmsPageHeader
        title="Khách hàng"
        description="Danh sách thành viên đã tham gia cửa hàng, điểm Loyalty và giá trị mua hàng."
        action={
          <Button icon={<ArrowClockwise size={15} />} loading={resource.loading} onClick={resource.reload}>
            Làm mới
          </Button>
        }
      />

      <form onSubmit={handleSearch}>
        <CmsFilterBar label="Bộ lọc khách hàng" className="mb-0">
          <Input
            allowClear
            type="search"
            placeholder="Tìm theo tên, email hoặc số điện thoại..."
            prefix={<MagnifyingGlass size={15} className="text-[#68776d]" />}
            value={draftQuery}
            maxLength={191}
            onChange={(event) => setDraftQuery(event.target.value)}
            className="min-w-[220px] flex-1"
          />
          <select
            aria-label="Hạng thành viên"
            value={tier}
            onChange={(event) => {
              setTier(event.target.value as MemberTier | "");
              setPage(1);
            }}
            className="h-8 min-w-[135px] rounded-lg border border-[#d9e0d7] bg-white px-2.5 text-xs font-medium text-[#20392a] outline-none focus:border-[#356b43]"
          >
            <option value="">Tất cả hạng</option>
            <option value="UNRANKED">Chưa xếp hạng</option>
            {(resource.data?.tiers ?? []).map((item) => <option key={item.level} value={item.level}>{item.name}</option>)}
          </select>
          <select
            aria-label="Trạng thái mua hàng"
            value={purchaseStatus}
            onChange={(event) => {
              setPurchaseStatus(event.target.value as CustomerPurchaseStatus);
              setPage(1);
            }}
            className="h-8 min-w-[145px] rounded-lg border border-[#d9e0d7] bg-white px-2.5 text-xs font-medium text-[#20392a] outline-none focus:border-[#356b43]"
          >
            <option value="all">Trạng thái: Tất cả</option>
            <option value="buyers">Đã có đơn</option>
            <option value="non_buyers">Chưa mua hàng</option>
          </select>
          <Button htmlType="submit">Tìm</Button>
          {hasFilters ? <Button onClick={resetFilters}>Đặt lại</Button> : null}
          <Typography.Text type="secondary" className="ml-auto text-xs tabular-nums">
            {pagination.totalItems.toLocaleString("vi-VN")} khách hàng
          </Typography.Text>
        </CmsFilterBar>
      </form>

      {resource.loading && !resource.data ? (
        <CmsCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </CmsCard>
      ) : resource.error && !resource.data ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Không tải được danh sách khách hàng"
          description={resource.error}
          action={
            <Button size="small" onClick={resource.reload}>
              Thử lại
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <CmsCard>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              hasFilters
                ? "Chưa có khách hàng phù hợp. Thử thay đổi bộ lọc tìm kiếm."
                : "Khách hàng sẽ xuất hiện khi thành viên ghé cửa hàng hoặc hoàn tất đơn hàng."
            }
          >
            {hasFilters ? <Button onClick={resetFilters}>Đặt lại bộ lọc</Button> : null}
          </Empty>
        </CmsCard>
      ) : (
        <CmsDataTable
          label="Danh sách khách hàng"
          rows={items}
          columns={columns}
          rowKey="memberId"
          loading={resource.loading}
          scroll={{ x: 960 }}
        />
      )}

      {resource.data ? (
        <MerchantPagination
          page={pagination.page}
          limit={pagination.limit}
          totalItems={pagination.totalItems}
          onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }}
        />
      ) : null}
    </section>
  );
}
