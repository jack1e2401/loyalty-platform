import { Link } from "react-router-dom";
import { Sparkle } from "@phosphor-icons/react";
import type { OrderDto, PointTransactionType } from "../../../api/commerce-types";
import { refundRequestStatusLabel } from "../../refunds/refund-status";
import { orderStatusLabel, orderStatusTone } from "../../orders/order-status";
import { Button, BusyLabel, Card, StatusText } from "../../../components/ui";
import { memberTierLabel } from "../MemberLoyaltyPolicyDialog";
import { OrderLoyaltyPolicySnapshot } from "../../orders/OrderLoyaltyPolicySnapshot";

const money = (value: string | bigint) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
    typeof value === "bigint" ? value : Number(value),
  );

function transactionTypeLabel(type: PointTransactionType) {
  switch (type) {
    case "EARN":
      return "Tích điểm";
    case "REDEEM_DISCOUNT":
      return "Đổi ưu đãi";
    case "REDEEM_REWARD":
      return "Đổi quà";
    case "EARN_REVERSAL":
      return "Thu hồi tích điểm";
    case "REDEMPTION_REVERSAL":
      return "Hoàn điểm đổi thưởng";
    case "ADMIN_ADJUSTMENT":
      return "Điều chỉnh quản trị";
    case "LEGACY_BACKFILL":
      return "Khởi tạo ban đầu";
    default:
      return type;
  }
}

type Props = {
  order: OrderDto;
  basePath: string;
  busy: boolean;
  actionError: string;
  canCancel: boolean;
  cancelling: boolean;
  remainingSeconds: number | null;
  remainingLabel: string | null;
  onPay: () => void;
  onRequestCancel: () => void;
  onRequestRefund: () => void;
};

export function OrderDetailCard({
  order,
  basePath,
  busy,
  actionError,
  canCancel,
  cancelling,
  remainingSeconds,
  remainingLabel,
  onPay,
  onRequestCancel,
  onRequestRefund,
}: Props) {
  const activeRefundRequest = order.refundRequest;
  const canRequestRefund =
    order.actions?.canRequestRefund ??
    (order.status === "PAID" && !order.refundStatus && !activeRefundRequest);
  return (
    <Card className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusText tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</StatusText>
        {order.refundStatus === "PENDING_PROVIDER" && (
          <StatusText tone="amber">Chờ xác nhận hoàn tiền</StatusText>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {order.items.map((item) => (
          <div key={item.productId} className="flex justify-between gap-3 text-sm">
            <span className="min-w-0 break-words">
              {item.productName} × {item.quantity}
            </span>
            <span className="shrink-0 font-bold tabular-nums break-words">{money(item.lineTotal)}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 border-t border-[#e5ece3] pt-5 text-sm">
        <div className="flex justify-between gap-3">
          <span className="muted">Tạm tính</span>
          <span className="shrink-0 tabular-nums break-words">{money(order.subtotal)}</span>
        </div>
        {order.discountAmount !== "0" && (
          <div className="flex justify-between gap-3 text-[#357044]">
            <span className="muted">Voucher giảm giá</span>
            <span className="shrink-0 tabular-nums break-words">−{money(order.discountAmount)}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-between border-t border-[#e5ece3] pt-4 font-extrabold">
        <span>Tổng cộng</span>
        <span className="shrink-0 tabular-nums break-words">{money(order.total)}</span>
      </div>
      {actionError && (
        <div role="alert" className="mt-4 rounded-xl bg-[#fee2e2] p-3 text-sm text-[#a4473a]">
          <p className="break-words">{actionError}</p>
        </div>
      )}
      {activeRefundRequest ? (
        <div className="mt-5 rounded-2xl bg-[#fff9e9] p-4" role="status">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Yêu cầu hoàn tiền</h2>
            <StatusText
              tone={
                activeRefundRequest.status === "REJECTED"
                  ? "red"
                  : activeRefundRequest.status === "COMPLETED"
                    ? "green"
                    : "amber"
              }
            >
              {refundRequestStatusLabel(activeRefundRequest.status)}
            </StatusText>
          </div>
          <p className="mt-2 text-sm">Lý do: {activeRefundRequest.reason}</p>
          {activeRefundRequest.status === "REJECTED" &&
            (activeRefundRequest.merchantDecisionReason || activeRefundRequest.adminDecisionReason) && (
              <p className="mt-2 text-sm text-[#a4473a]">
                Lý do từ chối:{" "}
                {activeRefundRequest.adminDecisionReason || activeRefundRequest.merchantDecisionReason}
              </p>
            )}
          <p className="mt-2 text-xs muted">
            Gửi lúc {new Date(activeRefundRequest.requestedAt).toLocaleString("vi-VN")}
            {activeRefundRequest.merchantReviewedAt &&
              ` · Cửa hàng xử lý ${new Date(activeRefundRequest.merchantReviewedAt).toLocaleString("vi-VN")}`}
            {activeRefundRequest.adminReviewedAt &&
              ` · Admin đã xử lý ở luồng cũ ${new Date(activeRefundRequest.adminReviewedAt).toLocaleString("vi-VN")}`}
          </p>
        </div>
      ) : canRequestRefund ? (
        <Button className="mt-5" variant="outline" onClick={() => onRequestRefund()}>
          Yêu cầu hoàn tiền
        </Button>
      ) : null}
      {order.status === "PENDING" ? (
        <div className="mt-5 rounded-xl bg-[#fff1d6] p-4">
          <p className="text-xs leading-5 text-[#97682a] break-words">
            Đơn đang chờ thanh toán. Điểm được cập nhật sau khi máy chủ xác nhận thanh toán.
          </p>
          {remainingLabel && (
            <p
              className="mt-1 text-xs text-[#97682a]"
              role="timer"
              aria-label={`Thời gian giữ sản phẩm còn ${remainingLabel}`}
            >
              {remainingSeconds === 0 ? (
                "Thời gian giữ sản phẩm đã hết."
              ) : (
                <>
                  Thời gian giữ sản phẩm còn <span className="font-bold tabular-nums">{remainingLabel}</span>.
                </>
              )}
            </p>
          )}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              className="w-full sm:w-auto"
              disabled={busy || remainingSeconds === 0}
              onClick={onPay}
            >
              {busy ? <BusyLabel>Đang xác nhận thanh toán</BusyLabel> : "Thanh toán (mô phỏng)"}
            </Button>
            {canCancel && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={busy || cancelling}
                onClick={() => onRequestCancel()}
              >
                Hủy đơn
              </Button>
            )}
          </div>
        </div>
      ) : order.status === "CANCELLED" ? (
        <div className="mt-5 rounded-xl bg-[#f0f4ee] p-4 text-[#3c5243]">
          <div role="status">
            <p className="text-sm font-semibold">Đơn hàng đã được hủy.</p>
            <p className="mt-1 text-xs text-[#527353] break-words">
              Voucher và hạn mức điểm liên quan đã được giải phóng an toàn.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
            <Link to={basePath}>Tiếp tục mua hàng</Link>
          </Button>
        </div>
      ) : order.status === "REFUNDED" ? (
        <div className="mt-5 rounded-2xl bg-[#edf1ea] p-4 text-[#294a32] sm:p-5">
          <div role="status">
            <p className="text-sm font-bold">Đơn hàng đã hoàn tiền.</p>
            <p className="mt-1 text-xs muted break-words">Giao dịch hoàn tiền đã được xử lý thành công.</p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={`${basePath}/wallet`}>Xem ví điểm</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={basePath}>Tiếp tục mua sắm</Link>
            </Button>
          </div>
        </div>
      ) : order.status === "REFUND_PENDING" ? (
        <div className="mt-5 rounded-xl bg-[#fff1d6] p-4">
          <div role="status">
            <p className="text-sm font-semibold text-[#97682a]">Đang xử lý hoàn tiền</p>
            <p className="mt-1 text-xs leading-5 text-[#97682a] break-words">
              Yêu cầu hoàn tiền đang được xử lý.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
            <Link to={`${basePath}/wallet`}>Xem ví điểm</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-[#e8f1e2] p-4 text-[#294a32] sm:p-5">
          <div role="status">
            <p className="text-sm">Thanh toán đã được máy chủ xác nhận.</p>
            {order.earnedPointsExact !== "0" && order.earnedPointsExact ? (
              <p className="mt-2 text-xl font-extrabold break-words">
                Bạn vừa nhận +{order.earnedPointsExact} điểm
              </p>
            ) : (
              <p className="mt-2 text-sm">Đơn này không phát sinh điểm.</p>
            )}
            {order.promotedToTier && (
              <p className="mt-3 flex items-center gap-2 font-bold break-words">
                <Sparkle aria-hidden="true" size={18} weight="fill" className="shrink-0" />
                Chúc mừng! Bạn đã lên hạng {memberTierLabel[order.promotedToTier]}.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={`${basePath}/wallet`}>Xem ví điểm</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to={basePath}>Tiếp tục mua sắm</Link>
            </Button>
          </div>
        </div>
      )}
      {order.loyaltyEvents && order.loyaltyEvents.length > 0 && (
        <div className="mt-6 border-t border-[#e5ece3] pt-5">
          <h3 className="text-sm font-extrabold text-[#294a32]">Lịch sử điểm của đơn hàng</h3>
          <div className="mt-3 divide-y divide-[#edf1ea] rounded-xl border border-[#e5ece3] bg-[#fcfdfa]">
            {order.loyaltyEvents.map((event) => {
              const isNeg = event.delta.startsWith("-");
              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-1.5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#294a32] break-words">{event.reason}</p>
                    <p className="mt-0.5 text-[#637269] break-words">
                      {transactionTypeLabel(event.type)} · {new Date(event.createdAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:block sm:text-right">
                    <span
                      className={`font-extrabold tabular-nums break-words ${isNeg ? "text-[#a4473a]" : "text-[#357044]"}`}
                    >
                      {isNeg ? event.delta : `+${event.delta}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {order.status !== "PENDING" && order.status !== "CANCELLED" && (
        <div className="mt-6 border-t border-[#e5ece3] pt-5">
          <OrderLoyaltyPolicySnapshot policy={order.appliedLoyaltyPolicy ?? null} />
        </div>
      )}
    </Card>
  );
}
