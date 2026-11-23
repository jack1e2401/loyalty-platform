import type { CustomerDetailDto } from "../../api/analytics-types";
import type { MemberVoucherStatus } from "../../api/commerce-types";
import { EmptyState, StatusText } from "../../components/ui";
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

export function CustomerHistorySections({
  customer,
}: {
  customer: Pick<CustomerDetailDto, "orders" | "pointLedger" | "vouchers">;
}) {
  return (
    <>
      <section aria-label="Lịch sử đơn hàng" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Lịch sử đơn hàng</h2>
        {customer.orders.length === 0 ? (
          <EmptyState title="Chưa có đơn hàng" description="Khách hàng chưa phát sinh đơn hàng nào." />
        ) : (
          <div className="surface overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Đơn hàng
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Sản phẩm
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Tổng thanh toán
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Điểm tích
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Thanh toán lúc
                  </th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map((order) => (
                  <tr key={order.id} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      #{order.id}
                    </th>
                    <td className="px-4 py-3.5">
                      <StatusText tone={orderStatusTone(order.status)}>
                        {orderStatusLabel(order.status)}
                      </StatusText>
                    </td>
                    <td className="px-4 py-3.5 text-xs muted">
                      {order.items.map((item) => `${item.productName} ×${item.quantity}`).join(", ")}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold tabular-nums">
                      {money(Number(order.total))}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{order.earnedPointsExact ?? "—"}</td>
                    <td className="px-4 py-3.5 text-xs muted">
                      {order.paidAt ? new Date(order.paidAt).toLocaleString("vi-VN") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Sổ biến động điểm" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Sổ biến động điểm</h2>
        {customer.pointLedger.length === 0 ? (
          <EmptyState title="Chưa có giao dịch điểm" description="Chưa ghi nhận biến động điểm nào." />
        ) : (
          <div className="surface overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Thời gian
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Loại
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Lý do
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Biến động
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Số dư sau
                  </th>
                </tr>
              </thead>
              <tbody>
                {customer.pointLedger.map((tx) => (
                  <tr key={tx.id} className="border-t border-[#edf1ea]">
                    <td className="px-5 py-3.5 text-xs muted">
                      {new Date(tx.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3.5 font-medium">{pointTransactionLabel(tx.type)}</td>
                    <td className="px-4 py-3.5">{tx.reason}</td>
                    <td
                      className={`px-4 py-3.5 text-right font-bold tabular-nums ${
                        tx.delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"
                      }`}
                    >
                      {formatPointDelta(tx.delta)}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{tx.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Lịch sử voucher" className="space-y-3">
        <h2 className="text-lg font-extrabold text-[#20392a]">Voucher đã đổi</h2>
        {customer.vouchers.length === 0 ? (
          <EmptyState title="Chưa đổi voucher" description="Khách hàng chưa đổi voucher hoặc quà nào." />
        ) : (
          <div className="surface overflow-x-auto rounded-3xl">
            <table className="w-full min-w-[680px] border-collapse text-left text-sm">
              <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Voucher
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Loại
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    Điểm đổi
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Ngày đổi
                  </th>
                </tr>
              </thead>
              <tbody>
                {customer.vouchers.map((voucher) => (
                  <tr key={voucher.id} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {voucher.title}
                    </th>
                    <td className="px-4 py-3.5">{voucher.type === "DISCOUNT" ? "Giảm giá" : "Quà tặng"}</td>
                    <td className="px-4 py-3.5">{voucherStatusLabel(voucher.status)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {voucher.pointsCost.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3.5 text-xs muted">
                      {new Date(voucher.redeemedAt).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
