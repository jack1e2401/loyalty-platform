import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button, Empty, Input, Select, type TableColumnsType } from "antd";
import { ArrowClockwise, MagnifyingGlass } from "@phosphor-icons/react";
import { createRefundsClient } from "../../../api/refunds-client";
import type { RefundRequestListItemDto, RefundRequestStatus } from "../../../api/refunds-types";
import { useResource } from "../../../api/useResource";
import { ErrorState } from "../../../components/ui";
import { MerchantPagination } from "../cms/MerchantPagination";
import { CmsDataTable, CmsFilterBar, CmsPageHeader, CmsStatusTag } from "../cms";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";
import { useToken } from "../merchant-page-support";
import { MerchantRefundReviewDetail } from "./MerchantRefundReviewDetail";

const api = createRefundsClient();
const states: (RefundRequestStatus | "ALL")[] = ["ALL", "PENDING_MERCHANT", "COMPLETED", "REJECTED"];

function statusTone(status: RefundRequestStatus) {
  if (status === "COMPLETED") return "success" as const;
  if (status === "REJECTED" || status === "FAILED") return "error" as const;
  if (status === "PENDING_MERCHANT") return "warning" as const;
  return "info" as const;
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("vi-VN");
}

export function MerchantRefundRequestsPage() {
  const token = useToken();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<RefundRequestStatus | "ALL">("PENDING_MERCHANT");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [decision, setDecision] = useState<RefundRequestStatus | null>(null);
  const requestIdParam = searchParams.get("requestId");
  const parsedRequestId = Number(requestIdParam);
  const requestId = Number.isSafeInteger(parsedRequestId) && parsedRequestId > 0 ? parsedRequestId : null;
  const invalidRequestId = requestIdParam !== null && requestId === null;

  const resource = useResource(
    () => requestId !== null || invalidRequestId
      ? Promise.resolve(null)
      : api.listMerchantRefundRequests({ status: status === "ALL" ? "" : status, page, limit }, token),
    [status, page, limit, token, requestId, invalidRequestId],
  );
  const rawItems = resource.data?.items ?? [];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const items = normalizedQuery
    ? rawItems.filter((item) => {
        const haystack = `#${item.id} #${item.orderId} ${item.memberEmail} ${item.reason}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
    : rawItems;
  const pagination = resource.data?.pagination;

  function openRequest(id: number) {
    setSearchParams((current) => {
      current.set("requestId", String(id));
      return current;
    });
  }

  function closeDetail() {
    setSearchParams((current) => {
      current.delete("requestId");
      return current;
    });
  }

  const columns: TableColumnsType<RefundRequestListItemDto> = [
    { title: "Yêu cầu", dataIndex: "id", key: "id", width: 100, render: (id: number) => `#${id}` },
    {
      title: "Đơn hàng",
      dataIndex: "orderId",
      key: "orderId",
      width: 115,
      render: (id: number) => <Link to={`/merchant/orders?orderId=${id}`}>Đơn #{id}</Link>,
    },
    {
      title: "Thành viên",
      dataIndex: "memberEmail",
      key: "memberEmail",
      width: 210,
      ellipsis: true,
      render: (email: string, item) => (
        <Link to={`/merchant/customers/${item.memberId}`} className="text-[#20392a] hover:underline">
          {email}
        </Link>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "orderTotalVnd",
      key: "orderTotalVnd",
      width: 145,
      align: "right",
      render: (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 190,
      render: (value: RefundRequestStatus) => (
        <CmsStatusTag label={refundRequestStatusLabel(value)} tone={statusTone(value)} />
      ),
    },
    { title: "Lý do", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "Ngày gửi",
      dataIndex: "requestedAt",
      key: "requestedAt",
      width: 175,
      render: dateTime,
    },
    {
      title: "Thao tác",
      key: "action",
      width: 140,
      fixed: "right",
      render: (_value, item) => (
        <Button type="link" className="!px-0" onClick={() => openRequest(item.id)}>
          {isRefundAwaitingMerchant(item.status) ? "Xem & Duyệt" : "Chi tiết"}
        </Button>
      ),
    },
  ];

  if (requestId !== null) {
    return (
      <MerchantRefundReviewDetail
        key={requestId}
        requestId={requestId}
        token={token}
        onClose={closeDetail}
        onUpdated={(result) => {
          setDecision(result);
          closeDetail();
        }}
      />
    );
  }

  if (invalidRequestId) {
    return <Empty description="Mã yêu cầu hoàn tiền không hợp lệ" />;
  }

  return (
    <div className="space-y-4">
      <CmsPageHeader
        title="Yêu cầu hoàn tiền"
        description="Xem lý do, kiểm tra tác động dự kiến rồi chọn cách xử lý."
      />
      {decision ? (
        <Alert
          type="success"
          showIcon
          closable
          onClose={() => setDecision(null)}
          title={`Đã cập nhật: ${refundRequestStatusLabel(decision)}`}
        />
      ) : null}
      <CmsFilterBar label="Lọc yêu cầu hoàn tiền">
        <Input
          aria-label="Tìm yêu cầu hoàn tiền"
          placeholder="Tìm mã yêu cầu, mã đơn, email hoặc lý do..."
          prefix={<MagnifyingGlass size={16} className="text-[#7d8a80]" />}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="h-9 min-w-[240px] flex-1 sm:max-w-xs"
          allowClear
        />
        <Select
          aria-label="Lọc trạng thái"
          value={status}
          options={states.map((value) => ({
            value,
            label: value === "ALL" ? "Tất cả trạng thái" : refundRequestStatusLabel(value),
          }))}
          onChange={(value: RefundRequestStatus | "ALL") => {
            setStatus(value);
            setPage(1);
            setDecision(null);
          }}
          className="min-w-56"
        />
        {(searchQuery !== "" || status !== "PENDING_MERCHANT") && (
          <Button
            onClick={() => {
              setSearchQuery("");
              setStatus("PENDING_MERCHANT");
              setPage(1);
              setDecision(null);
            }}
          >
            Đặt lại
          </Button>
        )}
        <Button
          icon={<ArrowClockwise size={16} />}
          loading={resource.loading}
          onClick={resource.reload}
          aria-label="Làm mới danh sách hoàn tiền"
        >
          Làm mới
        </Button>
      </CmsFilterBar>
      {resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        <>
        <CmsDataTable
          label="Yêu cầu hoàn tiền"
          rows={items}
          columns={columns}
          rowKey="id"
          loading={resource.loading}
          emptyText={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu hoàn tiền ở trạng thái này" />}
          pagination={false}
        />
        {pagination && <MerchantPagination page={pagination.page} limit={pagination.limit}
          totalItems={pagination.totalItems} onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }} />}
        </>

      )}
    </div>
  );
}
