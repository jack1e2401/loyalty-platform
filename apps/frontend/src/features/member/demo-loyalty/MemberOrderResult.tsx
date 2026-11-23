import { Link, useOutletContext, useParams } from "react-router-dom";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, StatusText } from "../../../components/ui";
import { money, number } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";
import { MemberMascot } from "../MemberMascot";

export function MemberOrderResult() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const { orderId } = useParams();
  const api = useApi();
  const resource = useResource(() => api.listMemberOrders(merchant.id), [merchant.id]);
  const order = resource.data?.find((o) => o.id === orderId);
  return (
    <>
      {resource.loading ? (
        <LoadingState cards={1} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !order ? (
        <EmptyState
          title="Không tìm thấy đơn"
          description="Có thể đơn thuộc cửa hàng khác."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="mx-auto max-w-2xl">
          <Card className="overflow-hidden text-center">
            <div className={`p-8 sm:p-12 ${order.status === "PAID" ? "bg-[#eaf5e2]" : "bg-[#fff4df]"}`}>
              <div className="mx-auto h-36 w-36">
                <MemberMascot mood={order.status === "PAID" ? "success" : "idle"} />
              </div>
              <StatusText tone={order.status === "PAID" ? "green" : "amber"}>
                {order.status === "PAID" ? "Đã thanh toán" : "Đơn đang chờ xử lý"}
              </StatusText>
              <h1 className="serif mt-4 text-3xl text-[#294a32]">
                {order.status === "PAID" ? "Cảm ơn bạn đã mua sắm!" : "Đơn hàng đã được tạo"}
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 muted">
                {order.status === "PAID"
                  ? `Bạn nhận ${number(order.earnedPoints)} điểm tại ${merchant.name}.`
                  : "Đơn đang chờ xác nhận thanh toán. Điểm được cộng sau khi giao dịch hoàn tất."}
              </p>
            </div>
            <div className="p-6 text-left">
              <div className="flex justify-between border-b border-[#edf1ea] pb-4 text-sm">
                <span className="muted">Mã đơn</span>
                <span className="font-extrabold">{order.id}</span>
              </div>
              {order.items.map((i) => (
                <div key={i.productId} className="flex justify-between py-3 text-sm">
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <span className="font-bold">{money(i.price * i.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#edf1ea] pt-4 text-base">
                <span className="font-bold">Tổng cộng</span>
                <span className="font-extrabold">{money(order.total)}</span>
              </div>
              {order.status === "PAID" && (
                <div className="mt-4 flex justify-between rounded-xl bg-[#edf4e9] p-4 text-sm">
                  <span className="font-bold">Điểm đã xác nhận</span>
                  <span className="font-extrabold accent">+{number(order.earnedPoints)}</span>
                </div>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild>
                  <Link to={`/member/${merchant.id}/orders`}>Xem đơn hàng</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to={`/member/${merchant.id}`}>Tiếp tục khám phá</Link>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
