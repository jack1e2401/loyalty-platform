import { useEffect, useState } from "react";
import { Link, useParams, useOutletContext } from "react-router-dom";
import { ArrowLeft } from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../../api/auth-session";
import { createCommerceClient } from "../../../api/commerce-http";
import { createRefundsClient, translateRefundRequestError } from "../../../api/refunds-client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  BusyLabel,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Textarea,
} from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { OrderDetailCard } from "./OrderDetailCard";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const refunds = createRefundsClient();

interface MemberContext {
  merchantId: number;
  basePath?: string;
}

function useMerchantContext() {
  const ctx = useOutletContext<MemberContext>();
  return {
    ...ctx,
    basePath: ctx.basePath ?? `/member/${ctx.merchantId}`,
  };
}

function Unavailable({
  title,
  description,
  basePath,
}: {
  title: string;
  description: string;
  basePath: string;
}) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title="Chưa khả dụng"
        description={description}
        action={
          <Button asChild variant="outline">
            <Link to={`${basePath}/orders`}>Xem danh sách đơn hàng</Link>
          </Button>
        }
      />
    </>
  );
}

export function MemberOrderResult() {
  const { merchantId, basePath } = useMerchantContext();
  const { accessToken } = useAuthSession();
  const orderId = Number(useParams().orderId);
  const orderResource = useResource(
    () => commerce.getMemberOrder(orderId, accessToken!).then(({ order }) => order),
    [orderId, merchantId, accessToken],
  );
  const order = orderResource.data?.merchantId === merchantId ? orderResource.data : null;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [reservationExpiredDialogOpen, setReservationExpiredDialogOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundError, setRefundError] = useState("");

  useEffect(() => {
    if (order?.status !== "PENDING" || !order.stockReservedUntil) return;

    const expiresAt = new Date(order.stockReservedUntil).getTime();
    if (!Number.isFinite(expiresAt)) return;

    const now = Date.now();
    setCurrentTime(now);
    if (expiresAt <= now) {
      setReservationExpiredDialogOpen(true);
      return;
    }

    const intervalId = window.setInterval(() => {
      const tick = Date.now();
      setCurrentTime(tick);
      if (tick >= expiresAt) {
        setReservationExpiredDialogOpen(true);
        window.clearInterval(intervalId);
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [order?.status, order?.stockReservedUntil]);
  async function pay() {
    if (!order || !accessToken || busy || order.status !== "PENDING") return;
    setBusy(true);
    setActionError("");
    try {
      const response = await commerce.payMockOrder(order.id, accessToken);
      orderResource.setData(response.order);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể bắt đầu thanh toán");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelOrder() {
    if (!order || !accessToken || cancelling) return;
    setCancelling(true);
    setCancelError("");
    try {
      const result = await commerce.cancelOrder(order.id, accessToken);
      orderResource.setData(result.order);
      setCancelDialogOpen(false);
    } catch (reason) {
      setCancelError(reason instanceof Error ? reason.message : "Không thể hủy đơn hàng");
    } finally {
      setCancelling(false);
    }
  }

  async function submitRefundRequest() {
    if (!order || !accessToken || !refundReason.trim() || refundBusy) return;
    setRefundBusy(true);
    setRefundError("");
    try {
      const response = await refunds.createMemberRefundRequest(order.id, refundReason.trim(), accessToken);
      orderResource.setData({ ...order, refundRequest: response.refundRequest });
      setRefundDialogOpen(false);
      setRefundReason("");
    } catch (cause) {
      setRefundError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    } finally {
      setRefundBusy(false);
    }
  }

  const canCancel = order?.actions?.canCancel === true;
  const reservedUntil = order?.stockReservedUntil ? new Date(order.stockReservedUntil).getTime() : null;
  const remainingSeconds =
    reservedUntil === null ? null : Math.max(0, Math.ceil((reservedUntil - currentTime) / 1000));
  const remainingLabel =
    remainingSeconds === null
      ? null
      : `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  if (orderResource.loading) return <LoadingState cards={1} />;
  if (orderResource.error) return <ErrorState message={orderResource.error} retry={orderResource.reload} />;
  if (!order)
    return (
      <Unavailable
        title="Không tải được đơn hàng"
        description="Đơn không tồn tại hoặc không thuộc cửa hàng hiện tại."
        basePath={basePath}
      />
    );

  return (
    <>
      <Link
        to={`${basePath}/orders`}
        className="mb-5 inline-flex items-center gap-2 rounded text-sm font-bold text-[#335e3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
      >
        <ArrowLeft aria-hidden="true" size={16} /> Danh sách đơn hàng
      </Link>
      <PageHeader title={`Đơn #${order.id}`} />
      <OrderDetailCard
        order={order}
        basePath={basePath}
        busy={busy}
        actionError={actionError}
        canCancel={canCancel}
        cancelling={cancelling}
        remainingSeconds={remainingSeconds}
        remainingLabel={remainingLabel}
        onPay={() => void pay()}
        onRequestCancel={() => setCancelDialogOpen(true)}
        onRequestRefund={() => setRefundDialogOpen(true)}
      />

      <ConfirmActionDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Hủy đơn hàng"
        description="Bạn có chắc chắn muốn hủy đơn hàng này? Voucher và hạn mức điểm sẽ được giải phóng."
        confirmLabel="Xác nhận hủy"
        destructive
        busy={cancelling}
        error={cancelError}
        onConfirm={handleCancelOrder}
      />
      <Dialog.Root
        open={refundDialogOpen}
        onOpenChange={(open) => {
          setRefundDialogOpen(open);
          if (!open) setRefundError("");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            <Dialog.Title className="text-xl font-extrabold text-[#20392a]">Yêu cầu hoàn tiền</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 muted">
              Cho cửa hàng biết lý do bạn muốn hoàn tiền cho đơn #{order.id}.
            </Dialog.Description>
            <label htmlFor="refund-reason" className="mt-5 block text-sm font-semibold">
              Lý do hoàn tiền
            </label>
            <Textarea
              id="refund-reason"
              className="mt-2"
              required
              value={refundReason}
              onChange={(event) => setRefundReason(event.target.value)}
            />
            {refundError && (
              <p role="alert" className="mt-2 text-sm text-[#a4473a]">
                {refundError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={refundBusy}>
                  Đóng
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                disabled={!refundReason.trim() || refundBusy}
                onClick={() => void submitRefundRequest()}
              >
                {refundBusy ? <BusyLabel>Đang gửi</BusyLabel> : "Gửi yêu cầu"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root open={reservationExpiredDialogOpen} onOpenChange={setReservationExpiredDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            <Dialog.Title className="text-xl font-extrabold text-[#20392a]">
              Thời gian giữ sản phẩm đã hết
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 muted">
              Đơn này đã hết thời gian giữ sản phẩm. Quay lại cửa hàng để chọn sản phẩm và tạo đơn mới.
            </Dialog.Description>
            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Đóng
                </Button>
              </Dialog.Close>
              <Button asChild>
                <Link to={basePath}>Quay lại cửa hàng</Link>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
