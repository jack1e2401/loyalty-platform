import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Flex, Input, Segmented, Select, Spin, Typography } from "antd";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { OrderDto } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState } from "../../../components/ui";
import { MerchantPagination } from "../cms/MerchantPagination";
import { MerchantRewardQueue } from "../MerchantRewardQueue";
import { CmsFilterBar, CmsPageHeader } from "../cms";
import { MerchantPurchaseOrdersTable } from "./MerchantPurchaseOrdersTable";
import { MerchantPurchaseOrderDetail } from "./MerchantPurchaseOrderDetail";
import { api, useToken } from "../merchant-page-support";

export function MerchantOrders() {
  const [params, setParams] = useSearchParams();
  const orderId = Number(params.get("orderId"));
  const selectedOrderId = Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null;
  const voucherId = Number(params.get("voucherId"));
  const selectedVoucherId = Number.isSafeInteger(voucherId) && voucherId > 0 ? voucherId : null;
  const tab = selectedVoucherId !== null || params.get("tab") === "rewards" ? "rewards" : "orders";
  return (
    <div className="grid min-w-0 gap-6">
      <CmsPageHeader title="Đơn hàng" />
      <div className="min-w-0 overflow-x-auto pb-1">
        <Segmented
          aria-label="Chế độ xem đơn hàng"
          style={{ background: "#e9f0e9", border: "1px solid #d7e4d8", padding: 4 }}
          value={tab}
          onChange={(value) => setParams(value === "orders" ? {} : { tab: String(value) })}
          options={[
            { label: "Đơn mua hàng", value: "orders" },
            { label: "Quà đổi thưởng", value: "rewards" },
          ]}
        />
      </div>
      {tab === "rewards" && selectedOrderId === null && (
        <section aria-labelledby="merchant-order-rewards" className="grid min-w-0 gap-4">
          <Typography.Title level={4} id="merchant-order-rewards" style={{ margin: 0 }}>
            Quà đổi thưởng
          </Typography.Title>
          {selectedVoucherId !== null && (
            <Button className="mb-3" onClick={() => setParams({ tab: "rewards" })}>
              Tất cả quà đổi thưởng
            </Button>
          )}
          <MerchantRewardQueue key={selectedVoucherId ?? "all"} voucherId={selectedVoucherId ?? undefined} />
        </section>
      )}
      {tab === "orders" && selectedVoucherId === null && (
        <section aria-labelledby="merchant-purchase-orders" className="grid min-w-0 gap-4">
          <Typography.Title level={4} id="merchant-purchase-orders" style={{ margin: 0 }}>
            Đơn mua hàng
          </Typography.Title>
          {selectedOrderId !== null ? (
            <MerchantPurchaseOrders key={selectedOrderId} orderId={selectedOrderId} />
          ) : (
            <MerchantPurchaseOrders key="all" orderId={null} />
          )}
        </section>
      )}
    </div>
  );
}

function MerchantPurchaseOrders({ orderId }: { orderId: number | null }) {
  const token = useToken();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [itemPage, setItemPage] = useState(1);
  const [itemLimit, setItemLimit] = useState(20);
  const resource = useResource<{
    orders: (OrderDto & { memberEmail?: string })[];
    pagination?: { page: number; limit: number; totalItems: number; totalPages: number };
    itemPagination?: { page: number; limit: number; totalItems: number; totalPages: number };
  }>(
    () => orderId === null
      ? api.listMerchantOrders(token, { page, limit, q: query.trim(), status: status === "ALL" ? "" : status }).then((response) => ({ ...response, itemPagination: undefined }))
      : api.getMerchantOrder(orderId, token, { page: itemPage, limit: itemLimit }).then(({ order, itemPagination }) => ({ orders: [order], pagination: undefined, itemPagination })),
    [token, orderId, page, limit, query, status, itemPage, itemLimit],
  );
  const orders = resource.data?.orders ?? [];

  if (orderId !== null) {
    if (resource.loading) return <Flex justify="center" className="py-10"><Spin description="Đang tải đơn hàng…" /></Flex>;
    if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
    const order = orders[0];
    return order ? <MerchantPurchaseOrderDetail order={order} pagination={resource.data?.itemPagination}
      onPageChange={(page, limit) => { setItemPage(page); setItemLimit(limit); }} /> : <EmptyState title="Chưa có đơn hàng" description="Không tìm thấy đơn hàng." />;
  }

  return (
    <div className="grid gap-4">
      <CmsFilterBar label="Lọc đơn hàng" className="mb-0">
        <Input
          aria-label="Tìm đơn hàng"
          placeholder="Mã đơn hoặc email thành viên..."
          prefix={<MagnifyingGlass size={16} className="text-[#7d8a80]" />}
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          className="h-9 min-w-[260px] flex-1 sm:max-w-xs"
          allowClear
        />
        <Select
          aria-label="Lọc trạng thái đơn hàng"
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          className="h-9 min-w-[170px]"
          options={[
            { value: "ALL", label: "Trạng thái: Tất cả" },
            { value: "PENDING", label: "Chờ thanh toán" },
            { value: "PAID", label: "Đã thanh toán" },
            { value: "FAILED", label: "Thất bại" },
            { value: "CANCELLED", label: "Đã hủy" },
            { value: "REFUND_PENDING", label: "Đang hoàn tiền" },
            { value: "REFUNDED", label: "Đã hoàn tiền" },
          ]}
        />
      </CmsFilterBar>
      {resource.loading ? <Flex justify="center" className="py-10"><Spin description="Đang tải đơn hàng…" /></Flex>
        : resource.error ? <ErrorState message={resource.error} retry={resource.reload} />
        : <MerchantPurchaseOrdersTable orders={orders} />}
      {resource.data?.pagination && <MerchantPagination page={resource.data.pagination.page} limit={resource.data.pagination.limit}
        totalItems={resource.data.pagination.totalItems} onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }} />}
    </div>
  );
}
