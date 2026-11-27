import { Space, Tag, Tooltip, Typography, type TableColumnsType } from "antd";
import { Link } from "react-router-dom";
import type { OrderDto } from "../../../api/commerce-types";
import { formatPrice, orderStatusLabel } from "../merchant-page-support";
import { CmsDataTable, CmsStatusTag } from "../cms";
import { refundRequestStatusLabel } from "../../refunds/refund-status";

export type MerchantOrderRow = OrderDto & { memberEmail?: string };

const tone = (status: OrderDto["status"]) => {
  switch (status) {
    case "PAID": return "success" as const;
    case "PENDING":
    case "REFUND_PENDING": return "warning" as const;
    case "FAILED": return "error" as const;
    case "REFUNDED": return "info" as const;
    default: return "neutral" as const;
  }
};

function refundLabel(order: OrderDto): string[] {
  const labels: string[] = [];
  if (order.refundStatus === "PENDING_PROVIDER") labels.push("Chờ xác nhận hoàn tiền");
  if (order.refundStatus === "COMPLETED" && order.status !== "REFUNDED") labels.push("Đã hoàn tiền");
  if (order.refundRequest) labels.push(`Hoàn tiền: ${refundRequestStatusLabel(order.refundRequest.status)}`);
  return labels;
}

export function MerchantPurchaseOrdersTable({
  orders,
}: {
  orders: MerchantOrderRow[];
}) {
  const columns: TableColumnsType<MerchantOrderRow> = [
    {
      title: "Đơn hàng",
      dataIndex: "id",
      key: "id",
      width: 90,
      render: (_: unknown, order) => <Link to={`/merchant/orders?orderId=${order.id}`}>#{order.id}</Link>,
    },
    {
      title: "Thành viên",
      key: "member",
      width: 175,
      render: (_: unknown, order) => (
        <div className="min-w-0 break-words">
          <Link to={`/merchant/customers/${order.memberId}`} className="font-medium text-[#20392a] hover:underline">
            #{order.memberId}
          </Link>
          {order.memberEmail ? (
            <div>
              <Typography.Text type="secondary" className="text-xs">
                {order.memberEmail}
              </Typography.Text>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "Sản phẩm",
      key: "items",
      width: 210,
      render: (_: unknown, order) => {
        if (order.items.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;
        const preview = order.items.slice(0, 2).map((item) => `${item.productName} × ${item.quantity}`);
        const remaining = order.items.length - 2;
        const fullText = order.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ");
        return (
          <Tooltip title={remaining > 0 ? fullText : undefined}>
            <div className="flex flex-col gap-0.5 text-xs text-[#20392a]">
              {preview.map((line, index) => (
                <span key={index} className="truncate">
                  {line}
                </span>
              ))}
              {remaining > 0 && (
                <Tag className="w-fit rounded-md border-[#d7e4d8] bg-[#f4f7f4] text-[11px] text-[#4c6253]">
                  +{remaining} sản phẩm khác
                </Tag>
              )}
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 175,
      render: (status: OrderDto["status"], order) => (
        <Space orientation="vertical" size={4}>
          <CmsStatusTag label={orderStatusLabel(status)} tone={tone(status)} />
          {status === "PENDING" && order.stockReservedUntil ? (
            <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: "normal" }}>
              Giữ chỗ đến {new Date(order.stockReservedUntil).toLocaleString("vi-VN")}
            </Typography.Text>
          ) : null}
          {refundLabel(order).map((label) => (
            <Typography.Text key={label} type="secondary" style={{ fontSize: 12, whiteSpace: "normal" }}>{label}</Typography.Text>
          ))}
        </Space>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "total",
      key: "total",
      width: 120,
      align: "right",
      render: (value: string) => <Typography.Text strong>{formatPrice(value)}</Typography.Text>,
    },
    {
      title: "Điểm tích lũy",
      key: "earnedPoints",
      width: 120,
      render: (_: unknown, order) =>
        order.status === "PAID" && (order.earnedPointsExact != null || order.earnedPoints != null)
          ? `+${order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm`
          : "—",
    },
    {
      title: "Thanh toán",
      dataIndex: "paidAt",
      key: "paidAt",
      width: 145,
      render: (value: string | null) => value ? new Date(value).toLocaleString("vi-VN") : "—",
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 165,
      render: (_: unknown, order) => (
        <Space orientation="vertical" size={2}>
          <Link to={`/merchant/orders?orderId=${order.id}`} className="text-xs font-medium text-[#20392a] hover:underline">
            Xem chi tiết
          </Link>
          {order.refundRequest?.status === "PENDING_MERCHANT" ? (
            <Link to={`/merchant/refund-requests?requestId=${order.refundRequest.id}`} className="text-xs font-medium text-[#b54708] hover:underline">
              Xử lý yêu cầu hoàn tiền
            </Link>
          ) : null}
        </Space>
      ),
    },
  ];

  return <CmsDataTable label="Đơn mua hàng" rows={orders} columns={columns} rowKey="id" tableLayout="fixed" scroll={{ x: 1145 }} emptyText="Không tìm thấy đơn hàng phù hợp." />;
}
