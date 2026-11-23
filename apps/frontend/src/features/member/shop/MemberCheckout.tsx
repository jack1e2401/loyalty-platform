import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { ArrowRight, ShoppingCart, Ticket } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
} from "../../../components/ui";
import { money } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";

export function MemberCheckout() {
  const { merchant, cart, clearCart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const navigate = useNavigate();
  const products = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const vouchers = useResource(() => api.listMemberVouchers(merchant.id), [merchant.id]);
  const [voucherId, setVoucherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const items = cart
    .map((i) => ({ ...i, product: products.data?.find((p) => p.id === i.productId) }))
    .filter((i) => i.product);
  async function submit() {
    if (busy || !items.length) return;
    setBusy(true);
    setError("");
    try {
      const order = await api.createOrder({
        merchantId: merchant.id,
        items: cart,
        voucherId: voucherId || undefined,
      });
      clearCart();
      navigate(`/member/${merchant.id}/orders/${order.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tạo đơn hàng");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title="Xác nhận đơn hàng" />
      {products.loading || vouchers.loading ? (
        <LoadingState cards={2} />
      ) : products.error || vouchers.error ? (
        <ErrorState
          message={products.error ?? vouchers.error ?? "Lỗi tải checkout"}
          retry={() => {
            products.reload();
            vouchers.reload();
          }}
        />
      ) : !items.length ? (
        <EmptyState
          title="Chưa có sản phẩm"
          description="Giỏ hàng trống hoặc sản phẩm không còn khả dụng."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <div className="space-y-5">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f1e2] accent">
                  <ShoppingCart size={20} />
                </span>
                <div>
                  <h2 className="font-extrabold">Sản phẩm</h2>
                  <p className="text-xs muted">{merchant.name}</p>
                </div>
              </div>
              <div className="mt-5 divide-y divide-[#edf1ea]">
                {items.map((i) => (
                  <div key={i.productId} className="flex justify-between gap-3 py-3 text-sm">
                    <span>
                      {i.product?.name} × {i.quantity}
                    </span>
                    <span className="font-bold">{money((i.product?.price ?? 0) * i.quantity)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff1dc] text-[#ab7a3e]">
                  <Ticket size={20} />
                </span>
                <h2 className="font-extrabold">Voucher giảm giá</h2>
              </div>
              <Select
                aria-label="Chọn voucher"
                value={voucherId}
                onChange={(e) => setVoucherId(e.target.value)}
              >
                <option value="">Không dùng voucher</option>
                {vouchers.data
                  ?.filter((v) => v.kind === "DISCOUNT" && v.status === "AVAILABLE")
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
              </Select>
              <p className="mt-3 text-xs leading-5 muted">Chỉ dùng voucher tại {merchant.name}.</p>
            </Card>
          </div>
          <Card className="h-fit p-6">
            <h2 className="text-lg font-extrabold">Đơn hàng của bạn</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span className="muted">Tạm tính</span>
              <span className="font-bold">
                {money(items.reduce((n, i) => n + (i.product?.price ?? 0) * i.quantity, 0))}
              </span>
            </div>
            {error && (
              <p role="alert" className="mt-4 rounded-xl bg-[#fae7e3] p-3 text-xs text-[#a4473a]">
                {error}
              </p>
            )}
            <Button className="mt-5 w-full" disabled={busy} onClick={submit}>
              {busy ? (
                <BusyLabel>Đang tạo đơn</BusyLabel>
              ) : (
                <>
                  Tạo đơn <ArrowRight size={16} />
                </>
              )}
            </Button>
          </Card>
        </div>
      )}
    </>
  );
}
