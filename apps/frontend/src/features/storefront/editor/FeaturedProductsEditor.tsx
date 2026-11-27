import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Checkbox, Empty, Flex, Input, Tag, Typography } from "antd";
import type { ProductDto } from "../../../api/commerce-types";
import { CmsCard } from "../../merchant/cms";

type Props = {
  productIds: number[];
  products: ProductDto[];
  onToggle: (productId: number) => void;
};

export function FeaturedProductsEditor({ productIds, products, onToggle }: Props) {
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query)
        || (product.sku ?? "").toLowerCase().includes(query),
    );
  }, [products, search]);

  return (
    <CmsCard
      title="Sản phẩm nổi bật"
      extra={<Tag color={productIds.length >= 6 ? "warning" : "green"} className="m-0">{productIds.length}/6 đã chọn</Tag>}
    >
      <div className="space-y-4">
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Typography.Text type="secondary" className="text-sm">
            Chọn tối đa 6 sản phẩm hiển thị trên trang chủ.
          </Typography.Text>
          {products.length > 0 ? (
            <Input
              allowClear
              aria-label="Tìm sản phẩm nổi bật"
              prefix={<MagnifyingGlass size={15} className="text-[#68776d]" />}
              placeholder="Tìm theo tên hoặc SKU..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full sm:max-w-xs"
            />
          ) : null}
        </Flex>
        {!products.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Chưa có sản phẩm đang bán để chọn làm sản phẩm nổi bật."
          />
        ) : !filteredProducts.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không tìm thấy sản phẩm phù hợp."
          />
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const selected = productIds.includes(product.id);
              return (
                <label
                  key={product.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition ${
                    selected ? "border-[#335e3d] bg-[#edf4e9]" : "border-[#e5ece3] bg-white hover:border-[#c8d8c4]"
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    onChange={() => onToggle(product.id)}
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
      </div>
    </CmsCard>
  );
}
