import type { FormEvent } from "react";
import { Button, Checkbox, Form, Input, Select } from "antd";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type {
  ProductCategoryDto,
  ProductKind,
  ProductSortOption,
  ProductStatus,
} from "../../../../api/commerce-types";
import { CmsFilterBar } from "../../../merchant/cms";

type Props = {
  qInput: string;
  onQInputChange(value: string): void;
  onSearchSubmit(event: FormEvent): void;
  categories: ProductCategoryDto[];
  categoryFilter: string;
  onCategoryFilterChange(value: string): void;
  statusFilter: "" | ProductStatus;
  onStatusFilterChange(value: "" | ProductStatus): void;
  kindFilter: "" | ProductKind;
  onKindFilterChange(value: "" | ProductKind): void;
  sort: ProductSortOption;
  onSortChange(value: ProductSortOption): void;
  lowStockOnly: boolean;
  onLowStockOnlyChange(value: boolean): void;
};

export function MerchantProductFiltersBar(props: Props) {
  return (
    <CmsFilterBar label="Lọc sản phẩm">
      <Form onSubmitCapture={props.onSearchSubmit} className="flex min-w-[17rem] flex-1 items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="mb-1.5 block text-xs font-semibold text-[#20392a]">Tìm kiếm sản phẩm</span>
          <Input
            aria-label="Tìm kiếm sản phẩm"
            placeholder="Tên sản phẩm hoặc SKU..."
            prefix={<MagnifyingGlass size={15} className="text-[#7d8a80]" />}
            value={props.qInput}
            onChange={(event) => props.onQInputChange(event.target.value)}
            allowClear
          />
        </label>
        <Button htmlType="submit" className="font-medium">Tìm</Button>
      </Form>
      <label className="min-w-[140px]">
        <span className="mb-1.5 block text-xs font-semibold text-[#20392a]">Danh mục</span>
        <Select
          aria-label="Lọc theo danh mục"
          className="w-full"
          value={props.categoryFilter}
          onChange={props.onCategoryFilterChange}
          options={[
            { value: "", label: "Tất cả danh mục" },
            ...props.categories.map((category) => ({ value: String(category.id), label: category.name })),
          ]}
        />
      </label>
      <label className="min-w-[130px]">
        <span className="mb-1.5 block text-xs font-semibold text-[#20392a]">Trạng thái</span>
        <Select
          aria-label="Lọc theo trạng thái"
          className="w-full"
          value={props.statusFilter}
          onChange={props.onStatusFilterChange}
          options={[
            { value: "", label: "Tất cả trạng thái" },
            { value: "ACTIVE", label: "Đang hoạt động" },
            { value: "HIDDEN", label: "Đã ẩn" },
          ]}
        />
      </label>
      <label className="min-w-[120px]">
        <span className="mb-1.5 block text-xs font-semibold text-[#20392a]">Loại</span>
        <Select
          aria-label="Lọc theo loại"
          className="w-full"
          value={props.kindFilter}
          onChange={props.onKindFilterChange}
          options={[
            { value: "", label: "Tất cả loại" },
            { value: "SALE", label: "Bán" },
            { value: "REWARD", label: "Đổi thưởng" },
          ]}
        />
      </label>
      <label className="min-w-[130px]">
        <span className="mb-1.5 block text-xs font-semibold text-[#20392a]">Sắp xếp</span>
        <Select
          aria-label="Sắp xếp"
          className="w-full"
          value={props.sort}
          onChange={props.onSortChange}
          options={[
            { value: "newest", label: "Mới nhất" },
            { value: "price_asc", label: "Giá tăng dần" },
            { value: "price_desc", label: "Giá giảm dần" },
            { value: "name_asc", label: "Tên A–Z" },
          ]}
        />
      </label>
      <div className="flex h-9 items-center pb-0.5">
        <Checkbox
          checked={props.lowStockOnly}
          onChange={(event) => props.onLowStockOnlyChange(event.target.checked)}
          className="text-xs font-medium text-[#20392a]"
        >
          Sắp hết hàng
        </Checkbox>
      </div>
    </CmsFilterBar>
  );
}
