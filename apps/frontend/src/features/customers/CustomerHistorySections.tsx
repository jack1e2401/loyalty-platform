import { Tabs, type TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import type { CustomerDetailDto } from "../../api/analytics-types";
import type { MemberVoucherStatus } from "../../api/commerce-types";
import { CmsCard, CmsDataTable, CmsStatusTag, type CmsStatusTone } from "../merchant/cms";
import { MerchantPagination } from "../merchant/cms/MerchantPagination";
import { formatPointDelta, pointTransactionLabel } from "../member/LoyaltyWalletContent";
import { orderStatusLabel, orderStatusTone } from "../orders/order-status";
import { money } from "../../lib/utils";

function voucherStatusLabel(status: MemberVoucherStatus): string {
  switch (status) {
    case "AVAILABLE":
      return "Khả dụng";
    case "RESERVED":
      return "Đang giữ";
    case "USED":
      return "Đã dùng";
    case "PENDING_FULFILLMENT":
      return "Chờ trao quà";
    case "FULFILLED":
      return "Đã trao";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

function voucherStatusTone(status: MemberVoucherStatus): CmsStatusTone {
  switch (status) {
    case "AVAILABLE":
    case "FULFILLED":
      return "success";
    case "RESERVED":
    case "PENDING_FULFILLMENT":
      return "warning";
    case "CANCELLED":
      return "error";
    default:
      return "neutral";
  }
}

function mapOrderTone(tone: ReturnType<typeof orderStatusTone>): CmsStatusTone {
  switch (tone) {
    case "green":
      return "success";
    case "amber":
      return "warning";
    case "red":
      return "error";
    default:
      return "neutral";
  }
}

type OrderRow = CustomerDetailDto["orders"][number];
type PointRow = CustomerDetailDto["pointLedger"][number];
type VoucherRow = CustomerDetailDto["vouchers"][number];

export function CustomerHistorySections({
  customer,
  onPageChange,
}: {
  customer: Pick<CustomerDetailDto, "orders" | "pointLedger" | "vouchers" | "pagination">;
  onPageChange: (key: "orders" | "pointLedger" | "vouchers", page: number, limit: number) => void;
}) {
  const orderColumns: TableColumnsType<OrderRow> = [
    {
      title: "Đơn hàng",
      dataIndex: "id",
      key: "id",
      width: 110,
      render: (id: number) => (
        <Link to="/merchant/orders" className="font-bold text-[#20392a] hover:text-[#356b43]">
          #{id}
        </Link>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 150,
      render: (status: OrderRow["status"]) => (
        <CmsStatusTag label={orderStatusLabel(status)} tone={mapOrderTone(orderStatusTone(status))} />
      ),
    },
    {
      title: "Sản phẩm",
      key: "items",
      render: (_: unknown, order) => (
        <span className="text-xs text-[#68776d]">
          {order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}
        </span>
      ),
    },
    {
      title: "Tổng thanh toán",
      dataIndex: "total",
      key: "total",
      align: "right",
      width: 140,
      render: (total: string) => <span className="font-semibold tabular-nums">{money(Number(total))}</span>,
    },
    {
      title: "Điểm tích",
      dataIndex: "earnedPointsExact",
      key: "earnedPointsExact",
      align: "right",
      width: 110,
      render: (value: string | null | undefined) => <span className="tabular-nums">{value ?? "—"}</span>,
    },
    {
      title: "Thanh toán lúc",
      dataIndex: "paidAt",
      key: "paidAt",
      width: 170,
      render: (paidAt: string | null) => (
        <span className="text-xs text-[#68776d]">
          {paidAt ? new Date(paidAt).toLocaleString("vi-VN") : "—"}
        </span>
      ),
    },
  ];

  const pointColumns: TableColumnsType<PointRow> = [
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (createdAt: string) => (
        <span className="text-xs text-[#68776d]">{new Date(createdAt).toLocaleString("vi-VN")}</span>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 150,
      render: (type: PointRow["type"]) => <span className="font-medium">{pointTransactionLabel(type)}</span>,
    },
    {
      title: "Lý do",
      dataIndex: "reason",
      key: "reason",
    },
    {
      title: "Biến động",
      dataIndex: "delta",
      key: "delta",
      align: "right",
      width: 120,
      render: (delta: string) => (
        <span className={`font-bold tabular-nums ${delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"}`}>
          {formatPointDelta(delta)}
        </span>
      ),
    },
    {
      title: "Số dư sau",
      dataIndex: "balanceAfter",
      key: "balanceAfter",
      align: "right",
      width: 120,
      render: (balanceAfter: string) => <span className="tabular-nums">{balanceAfter}</span>,
    },
  ];

  const voucherColumns: TableColumnsType<VoucherRow> = [
    {
      title: "Voucher",
      dataIndex: "title",
      key: "title",
      render: (title: string) => <strong className="text-[#20392a]">{title}</strong>,
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      width: 120,
      render: (type: VoucherRow["type"]) => (type === "DISCOUNT" ? "Giảm giá" : "Quà tặng"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 140,
      render: (status: MemberVoucherStatus) => (
        <CmsStatusTag label={voucherStatusLabel(status)} tone={voucherStatusTone(status)} />
      ),
    },
    {
      title: "Điểm đổi",
      dataIndex: "pointsCost",
      key: "pointsCost",
      align: "right",
      width: 110,
      render: (pointsCost: number) => <span className="tabular-nums">{pointsCost.toLocaleString("vi-VN")}</span>,
    },
    {
      title: "Ngày đổi",
      dataIndex: "redeemedAt",
      key: "redeemedAt",
      width: 170,
      render: (redeemedAt: string) => (
        <span className="text-xs text-[#68776d]">{new Date(redeemedAt).toLocaleString("vi-VN")}</span>
      ),
    },
  ];

  const orderCount = customer.pagination?.orders?.totalItems ?? customer.orders.length;
  const pointCount = customer.pagination?.pointLedger?.totalItems ?? customer.pointLedger.length;
  const voucherCount = customer.pagination?.vouchers?.totalItems ?? customer.vouchers.length;

  return (
    <CmsCard>
      <Tabs
        defaultActiveKey="orders"
        items={[
          {
            key: "orders",
            label: `Lịch sử đơn hàng (${orderCount})`,
            forceRender: true,
            children: (
              <div className="space-y-4">
                <CmsDataTable
                  label="Lịch sử đơn hàng"
                  rows={customer.orders}
                  columns={orderColumns}
                  rowKey="id"
                  emptyText="Khách hàng chưa phát sinh đơn hàng nào."
                  scroll={{ x: 740 }}
                />
                {customer.pagination?.orders ? (
                  <MerchantPagination
                    {...customer.pagination.orders}
                    onChange={(page, limit) => onPageChange("orders", page, limit)}
                  />
                ) : null}
              </div>
            ),
          },
          {
            key: "pointLedger",
            label: `Sổ biến động điểm (${pointCount})`,
            forceRender: true,
            children: (
              <div className="space-y-4">
                <CmsDataTable
                  label="Sổ biến động điểm"
                  rows={customer.pointLedger}
                  columns={pointColumns}
                  rowKey="id"
                  emptyText="Chưa ghi nhận biến động điểm nào."
                  scroll={{ x: 700 }}
                />
                {customer.pagination?.pointLedger ? (
                  <MerchantPagination
                    {...customer.pagination.pointLedger}
                    onChange={(page, limit) => onPageChange("pointLedger", page, limit)}
                  />
                ) : null}
              </div>
            ),
          },
          {
            key: "vouchers",
            label: `Voucher đã đổi (${voucherCount})`,
            forceRender: true,
            children: (
              <div className="space-y-4">
                <CmsDataTable
                  label="Voucher đã đổi"
                  rows={customer.vouchers}
                  columns={voucherColumns}
                  rowKey="id"
                  emptyText="Khách hàng chưa đổi voucher hoặc quà nào."
                  scroll={{ x: 680 }}
                />
                {customer.pagination?.vouchers ? (
                  <MerchantPagination
                    {...customer.pagination.vouchers}
                    onChange={(page, limit) => onPageChange("vouchers", page, limit)}
                  />
                ) : null}
              </div>
            ),
          },
        ]}
      />
    </CmsCard>
  );
}
