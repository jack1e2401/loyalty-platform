import { useState } from "react";
import { Button, Card, Descriptions, Flex, Typography, type TableColumnsType } from "antd";
import { Printer } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { WalletTransactionDto } from "../../../api/contracts/loyalty";
import { MerchantPagination } from "../cms/MerchantPagination";
import { CmsDataTable, CmsDetailLayout, CmsStatusTag } from "../cms";
import { refundRequestStatusLabel } from "../../refunds/refund-status";
import { formatPrice, orderStatusLabel } from "../merchant-page-support";
import { OrderLoyaltyPolicySnapshot } from "../../orders/OrderLoyaltyPolicySnapshot";
import type { MerchantOrderRow } from "./MerchantPurchaseOrdersTable";

function statusTone(status: MerchantOrderRow["status"]) {
  if (status === "PAID") return "success" as const;
  if (status === "PENDING" || status === "REFUND_PENDING") return "warning" as const;
  if (status === "FAILED") return "error" as const;
  if (status === "REFUNDED") return "info" as const;
  return "neutral" as const;
}

function loyaltyEventLabel(type: WalletTransactionDto["type"]) {
  switch (type) {
    case "EARN": return "Tích điểm";
    case "REDEEM_DISCOUNT": return "Dùng điểm giảm giá";
    case "REDEEM_REWARD": return "Đổi quà";
    case "EARN_REVERSAL": return "Thu hồi điểm";
    case "REDEMPTION_REVERSAL": return "Hoàn điểm đổi";
    case "MERCHANT_ADJUSTMENT": return "Điều chỉnh";
    default: return type;
  }
}

export function MerchantPurchaseOrderDetail({
  order,
  pagination,
  onPageChange,
}: {
  order: MerchantOrderRow;
  pagination?: { page: number; limit: number; totalItems: number };
  onPageChange: (page: number, limit: number) => void;
}) {
  const [showPolicy, setShowPolicy] = useState(false);
  const itemColumns: TableColumnsType<MerchantOrderRow["items"][number]> = [
    { title: "Sản phẩm", dataIndex: "productName", key: "productName" },
    { title: "Số lượng", dataIndex: "quantity", key: "quantity", align: "right", width: 100 },
    { title: "Đơn giá", dataIndex: "unitPrice", key: "unitPrice", align: "right", render: formatPrice },
    { title: "Thành tiền", dataIndex: "lineTotal", key: "lineTotal", align: "right", render: formatPrice },
  ];
  const loyaltyEventColumns: TableColumnsType<WalletTransactionDto> = [
    { title: "Loại", dataIndex: "type", key: "type", width: 150, render: loyaltyEventLabel },
    {
      title: "Biến động",
      dataIndex: "delta",
      key: "delta",
      align: "right",
      width: 120,
      render: (delta: string) => {
        const numeric = Number(delta);
        const prefix = numeric > 0 ? "+" : "";
        return <Typography.Text strong>{prefix}{delta} điểm</Typography.Text>;
      },
    },
    { title: "Số dư sau", dataIndex: "balanceAfter", key: "balanceAfter", align: "right", width: 120, render: (v: string) => `${v} điểm` },
    { title: "Ghi chú", dataIndex: "reason", key: "reason" },
    { title: "Thời gian", dataIndex: "createdAt", key: "createdAt", width: 160, render: (v: string) => new Date(v).toLocaleString("vi-VN") },
  ];
  const action = (
    <Flex gap={8} wrap className="print:hidden">
      <Button icon={<Printer size={16} />} onClick={() => window.print()}>
        In đơn hàng
      </Button>
      {order.refundRequest?.status === "PENDING_MERCHANT" ? (
        <Button type="primary"><Link to={`/merchant/refund-requests?requestId=${order.refundRequest.id}`}>Xử lý yêu cầu hoàn tiền</Link></Button>
      ) : null}
    </Flex>
  );

  return (
    <CmsDetailLayout
      title={`Đơn #${order.id}`}
      backTo="/merchant/orders"
      backLabel="Quay lại đơn hàng"
      status={<CmsStatusTag label={orderStatusLabel(order.status)} tone={statusTone(order.status)} />}
      action={action}
    >
      <Card title="Thông tin đơn hàng" size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Thành viên">
            <Flex vertical gap={2}>
              <Link to={`/merchant/customers/${order.memberId}`} className="font-medium text-[#20392a] hover:underline">
                #{order.memberId}
              </Link>
              {order.memberEmail ? <Typography.Text type="secondary">{order.memberEmail}</Typography.Text> : null}
            </Flex>
          </Descriptions.Item>
          <Descriptions.Item label="Tạm tính">{formatPrice(order.subtotal)}</Descriptions.Item>
          <Descriptions.Item label="Voucher giảm giá">−{formatPrice(order.discountAmount)}</Descriptions.Item>
          <Descriptions.Item label="Tổng cộng"><Typography.Text strong>{formatPrice(order.total)}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Thanh toán">{order.paidAt ? new Date(order.paidAt).toLocaleString("vi-VN") : "—"}</Descriptions.Item>
          <Descriptions.Item label="Điểm tích lũy">
            {order.status === "PAID" && (order.earnedPointsExact != null || order.earnedPoints != null)
              ? `+${order.earnedPointsExact ?? order.earnedPoints?.toLocaleString("vi-VN")} điểm`
              : "—"}
          </Descriptions.Item>
          {order.paymentProvider ? (
            <Descriptions.Item label="Phương thức">{order.paymentProvider}</Descriptions.Item>
          ) : null}
          {order.paymentProviderReference ? (
            <Descriptions.Item label="Mã tham chiếu">{order.paymentProviderReference}</Descriptions.Item>
          ) : null}
          {order.paymentProviderTransactionNo ? (
            <Descriptions.Item label="Mã giao dịch">{order.paymentProviderTransactionNo}</Descriptions.Item>
          ) : null}
          {order.status === "PENDING" && order.stockReservedUntil ? (
            <Descriptions.Item label="Giữ tồn kho đến">{new Date(order.stockReservedUntil).toLocaleString("vi-VN")}</Descriptions.Item>
          ) : null}
          {order.promotedToTier ? (
            <Descriptions.Item label="Thăng hạng">
              <CmsStatusTag label={`Lên hạng ${order.promotedToTier}`} tone="success" />
            </Descriptions.Item>
          ) : null}
        </Descriptions>
        {order.refundStatus === "PENDING_PROVIDER" ? (
          <CmsStatusTag label="Chờ xác nhận hoàn tiền" tone="warning" />
        ) : null}
        {order.refundStatus === "COMPLETED" && order.status !== "REFUNDED" ? (
          <CmsStatusTag label="Đã hoàn tiền" tone="info" />
        ) : null}
      </Card>
      {order.refundRequest ? (
        <Card
          title="Yêu cầu hoàn tiền"
          size="small"
          extra={
            <Link to={`/merchant/refund-requests?requestId=${order.refundRequest.id}`} className="print:hidden text-xs font-medium text-[#20392a] hover:underline">
              Mở hàng đợi hoàn tiền
            </Link>
          }
        >
          <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Trạng thái">
              <CmsStatusTag
                label={refundRequestStatusLabel(order.refundRequest.status)}
                tone={order.refundRequest.status === "PENDING_MERCHANT" ? "warning" : order.refundRequest.status === "REJECTED" || order.refundRequest.status === "FAILED" ? "error" : "info"}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian gửi">
              {order.refundRequest.requestedAt ? new Date(order.refundRequest.requestedAt).toLocaleString("vi-VN") : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Lý do khách hàng" span={{ xs: 1, sm: 2 }}>
              {order.refundRequest.reason || "—"}
            </Descriptions.Item>
            {order.refundRequest.merchantReviewedAt ? (
              <Descriptions.Item label="Thời gian duyệt">
                {new Date(order.refundRequest.merchantReviewedAt).toLocaleString("vi-VN")}
              </Descriptions.Item>
            ) : null}
            {order.refundRequest.merchantDecisionReason ? (
              <Descriptions.Item label="Ghi chú cửa hàng">
                {order.refundRequest.merchantDecisionReason}
              </Descriptions.Item>
            ) : null}
          </Descriptions>
        </Card>
      ) : null}
      <Card title="Sản phẩm trong đơn" size="small">
        <CmsDataTable label="Sản phẩm trong đơn" rows={order.items} columns={itemColumns} rowKey="productId" />
        {pagination && <MerchantPagination {...pagination} onChange={onPageChange} />}
      </Card>
      {order.loyaltyEvents && order.loyaltyEvents.length > 0 ? (
        <Card title="Biến động điểm của đơn hàng" size="small">
          <CmsDataTable label="Biến động điểm của đơn hàng" rows={order.loyaltyEvents} columns={loyaltyEventColumns} rowKey="id" />
        </Card>
      ) : null}
      {order.paidAt ? (
        <Card
          title="Chính sách loyalty đã áp dụng"
          size="small"
          extra={<Button type="link" className="print:hidden" onClick={() => setShowPolicy((value) => !value)}>{showPolicy ? "Ẩn" : "Xem"}</Button>}
        >
          {showPolicy ? <OrderLoyaltyPolicySnapshot policy={order.appliedLoyaltyPolicy ?? null} /> : null}
        </Card>
      ) : null}
    </CmsDetailLayout>
  );
}
