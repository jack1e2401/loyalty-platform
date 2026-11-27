import { Link } from "react-router-dom";
import { ArrowCounterClockwise, ArrowRight, Clock, Gift, WarningCircle } from "@phosphor-icons/react";
import { Empty, Skeleton, Typography } from "antd";
import type { OrderDto } from "../../../api/commerce-types";
import { CmsCard, CmsStatusTag } from "../cms";
import { formatPrice, orderStatusLabel } from "../merchant-page-support";

export interface ActionQueueCounts {
  pendingOrders: number;
  pendingRefunds: number;
  pendingRewards: number;
  lowStock: number;
}

const statusTone = (status: OrderDto["status"]) => {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PENDING":
    case "REFUND_PENDING":
      return "warning" as const;
    case "FAILED":
      return "error" as const;
    case "REFUNDED":
      return "info" as const;
    default:
      return "neutral" as const;
  }
};

export function OverviewActionQueue({
  counts,
  loading,
}: {
  counts: ActionQueueCounts;
  loading: boolean;
}) {
  const items = [
    {
      label: "Đơn chờ thanh toán",
      count: counts.pendingOrders,
      to: "/merchant/orders",
      icon: <Clock size={18} className="text-[#97682a]" />,
      activeText: "Cần theo dõi",
    },
    {
      label: "Hoàn tiền chờ duyệt",
      count: counts.pendingRefunds,
      to: "/merchant/refund-requests",
      icon: <ArrowCounterClockwise size={18} className="text-[#a4473a]" />,
      activeText: "Duyệt yêu cầu",
    },
    {
      label: "Quà chờ trao",
      count: counts.pendingRewards,
      to: "/merchant/orders?tab=rewards",
      icon: <Gift size={18} className="text-[#28734d]" />,
      activeText: "Chuẩn bị trao quà",
    },
    {
      label: "Sản phẩm sắp hết hàng",
      count: counts.lowStock,
      to: "/merchant/analytics",
      icon: <WarningCircle size={18} className="text-[#97682a]" />,
      activeText: "Kiểm tra tồn kho",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const hasPending = item.count > 0;
        return (
          <Link
            key={item.label}
            to={item.to}
            className={`group flex items-center justify-between rounded-xl border p-3.5 transition-all hover:shadow-xs ${
              hasPending
                ? "border-[#e6d5b2] bg-[#fffcf5] hover:border-[#d5b87e]"
                : "border-[#e3e9e2] bg-white hover:border-[#c3d4c2]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  hasPending ? "bg-[#fef3c7]/70" : "bg-[#f3f6f2]"
                }`}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-[#607767]">{item.label}</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  {loading ? (
                    <Skeleton.Input active size="small" style={{ width: 42, height: 20 }} />
                  ) : (
                    <>
                      <span className="text-lg font-bold tabular-nums text-[#20392a]">{item.count}</span>
                      <span
                        className={`text-[11px] font-medium ${
                          hasPending ? "text-[#97682a]" : "text-[#7d8a80]"
                        }`}
                      >
                        {hasPending ? item.activeText : "Ổn định"}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <ArrowRight
              size={14}
              className="shrink-0 text-[#889a8d] transition-transform group-hover:translate-x-0.5 group-hover:text-[#20392a]"
            />
          </Link>
        );
      })}
    </div>
  );
}

export function OverviewRecentOrders({
  orders,
  loading,
}: {
  orders: (OrderDto & { memberEmail?: string })[] | null;
  loading: boolean;
}) {
  const recent = (orders ?? []).slice(0, 5);

  return (
    <CmsCard
      title="Đơn hàng gần nhất"
      description="5 giao dịch mới nhất tại cửa hàng"
      extra={
        <Link
          to="/merchant/orders"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#356b43] hover:text-[#20392a]"
        >
          Tất cả <ArrowRight size={13} />
        </Link>
      }
      className="h-full"
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : recent.length === 0 ? (
        <div className="flex h-56 items-center justify-center">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đơn hàng nào" />
        </div>
      ) : (
        <div className="divide-y divide-[#edf2eb]">
          {recent.map((order) => (
            <Link
              key={order.id}
              to={`/merchant/orders?orderId=${order.id}`}
              className="flex items-center justify-between gap-3 py-3 transition hover:bg-[#f7faf7] first:pt-1 last:pb-1"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#20392a]">#{order.id}</span>
                  <CmsStatusTag label={orderStatusLabel(order.status)} tone={statusTone(order.status)} />
                </div>
                <Typography.Text type="secondary" className="mt-0.5 block truncate text-xs">
                  {order.memberEmail ?? `Thành viên #${order.memberId}`}
                </Typography.Text>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-bold tabular-nums text-[#20392a]">{formatPrice(order.total)}</div>
                <div className="mt-0.5 text-[11px] text-[#7d8a80]">
                  {order.paidAt
                    ? new Date(order.paidAt).toLocaleDateString("vi-VN")
                    : `${order.items.length} sản phẩm`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CmsCard>
  );
}
