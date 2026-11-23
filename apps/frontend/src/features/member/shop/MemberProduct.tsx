import { Link, useOutletContext, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, ShoppingCart } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import { Button, EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { money } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";
import { productStockDisplay } from "../../storefront/shared/storefront-stock";

export function MemberProduct() {
  const { productId } = useParams();
  const { merchant, addToCart } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const resource = useResource(() => api.listProducts(merchant.id), [merchant.id]);
  const product = resource.data?.find((p) => p.id === productId && p.active);
  return (
    <>
      {resource.loading ? (
        <LoadingState cards={2} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !product ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          description="Sản phẩm có thể đã được ẩn hoặc thuộc cửa hàng khác."
          action={
            <Button asChild>
              <Link to={`/member/${merchant.id}`}>Về gian hàng</Link>
            </Button>
          }
        />
      ) : (
        <div>
          <Link
            to={`/member/${merchant.id}`}
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold accent"
          >
            <ArrowLeft size={15} /> Quay lại gian hàng
          </Link>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-[2rem] bg-[#edf2e9]">
              {product.image && (
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-semibold text-[#527b56]">{product.category}</p>
              <h1 className="serif mt-5 text-4xl leading-tight text-[#294432] sm:text-5xl">{product.name}</h1>
              <p className="mt-4 text-2xl font-extrabold accent">{money(product.price)}</p>
              <p className="mt-7 text-sm leading-8 muted">{product.description}</p>
              <p
                className={`mt-5 inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${productStockDisplay(product.stock).badgeClass}`}
              >
                {productStockDisplay(product.stock).label}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" disabled={product.stock < 1} onClick={() => addToCart(product.id)}>
                  <ShoppingCart size={18} /> Thêm vào giỏ
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to={`/member/${merchant.id}/cart`}>
                    Xem giỏ hàng <ArrowRight size={16} />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
