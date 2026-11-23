import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, Minus, Plus, Trash } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../../components/ui";
import { money } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";

export function MemberCart() {
  const { merchant, cart, setQuantity } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const items = cart
    .map((i) => ({ ...i, product: resource.data?.find((p) => p.id === i.productId) }))
    .filter((i) => i.product);
  const subtotal = items.reduce((n, i) => n + (i.product?.price ?? 0) * i.quantity, 0);
  return (
    <>
      <PageHeader title={`Giỏ hàng · ${merchant.name}`} />
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !items.length ? (
        <EmptyState
          title="Giỏ hàng đang trống"
          description="Chọn vài món bạn thích để bắt đầu."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>
                Khám phá sản phẩm <ArrowRight size={16} />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_.7fr]">
          <Card className="divide-y divide-[#edf1ea] p-4 sm:p-6">
            {items.map(
              ({ product, quantity, productId }) =>
                product && (
                  <div key={productId} className="flex gap-4 py-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#edf2e9] sm:h-24 sm:w-24">
                      {product.image && (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold muted">{product.category}</p>
                      <h2 className="mt-1 text-sm font-extrabold">{product.name}</h2>
                      <p className="mt-2 text-sm font-bold accent">{money(product.price)}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex items-center rounded-full bg-[#f0f4ed]">
                          <button
                            aria-label="Giảm số lượng"
                            className="p-2"
                            onClick={() => setQuantity(productId, quantity - 1)}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-5 text-center text-xs font-bold">{quantity}</span>
                          <button
                            aria-label="Tăng số lượng"
                            className="p-2"
                            disabled={quantity >= product.stock}
                            onClick={() => setQuantity(productId, quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button
                          aria-label="Xóa sản phẩm"
                          onClick={() => setQuantity(productId, 0)}
                          className="text-[#a87870]"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm font-extrabold">{money(product.price * quantity)}</p>
                  </div>
                ),
            )}
          </Card>
          <Card className="h-fit p-6">
            <h2 className="text-lg font-extrabold">Tóm tắt giỏ hàng</h2>
            <div className="mt-5 flex justify-between text-sm">
              <span className="muted">Tạm tính</span>
              <span className="font-bold">{money(subtotal)}</span>
            </div>
            <div className="mt-5 border-t border-[#edf1ea] pt-5">
              <Button asChild className="w-full">
                <Link to={`/member/${merchant.id}/checkout`}>
                  Tiếp tục thanh toán <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
