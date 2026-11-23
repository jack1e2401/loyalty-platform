import { Link, useOutletContext } from "react-router-dom";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../../components/ui";
import { money, shortDate } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";

export function MemberOrders() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listMemberOrders(merchant.id), [merchant.id]);
  return (
    <>
      <PageHeader title="Đơn hàng của bạn" description={`Lịch sử mua sắm tại ${merchant.name}.`} />
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data?.length ? (
        <EmptyState
          title="Chưa có đơn hàng"
          description="Đơn hàng của bạn sẽ xuất hiện ở đây."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Khám phá cửa hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {resource.data.map((o) => (
            <Card key={o.id} className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs muted">
                    {shortDate(o.createdAt)} · {o.id}
                  </p>
                  <p className="mt-1 text-sm font-bold">
                    {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-extrabold">{money(o.total)}</p>
                    <p className="text-[11px] muted">
                      {o.status === "PAID" ? `+${o.earnedPoints} điểm` : "Chưa phát điểm"}
                    </p>
                  </div>
                  <StatusText tone={o.status === "PAID" ? "green" : "amber"}>
                    {o.status === "PAID" ? "PAID" : "PENDING"}
                  </StatusText>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
