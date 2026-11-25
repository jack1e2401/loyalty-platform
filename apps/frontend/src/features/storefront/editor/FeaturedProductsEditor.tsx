import { Card } from "../../../components/ui";
import type { ProductDto } from "../../../api/commerce-types";

type Props = {
  productIds: number[];
  products: ProductDto[];
  onToggle: (productId: number) => void;
};

export function FeaturedProductsEditor({ productIds, products, onToggle }: Props) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#20392a]">Sản phẩm nổi bật</h2>
        <span className="text-xs font-semibold muted">{productIds.length}/6 đã chọn</span>
      </div>
      <p className="text-sm muted">Chọn tối đa 6 sản phẩm hiển thị trên trang chủ.</p>
      {!products.length ? (
        <p className="text-sm muted">Chưa có sản phẩm đang bán để chọn làm sản phẩm nổi bật.</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const selected = productIds.includes(product.id);
            return (
              <label
                key={product.id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                  selected ? "border-[#335e3d] bg-[#edf4e9]" : "border-[#e5ece3] bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onToggle(product.id)}
                  className="size-4 accent-[#335e3d]"
                />
                <span className="min-w-0 flex-1 truncate font-bold text-[#24452f]">{product.name}</span>
                <span className="shrink-0 text-xs font-semibold text-[#53685a] tabular-nums">
                  {Number(product.price).toLocaleString("vi-VN")} ₫
                </span>
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}
