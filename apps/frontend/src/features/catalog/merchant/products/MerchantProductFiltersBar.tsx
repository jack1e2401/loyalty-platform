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
      <Form onSubmitCapture={props.onSearchSubmit} className="flex min-w-[18rem] flex-1 items-center gap-2">
        <Input
          aria-label="Tìm kiếm sản phẩm"
          placeholder="Tìm theo tên sản phẩm hoặc SKU..."
          prefix={<MagnifyingGlass size={16} className="text-[#7d8a80]" />}
          value={props.qInput}
          onChange={(event) => props.onQInputChange(event.target.value)}
          allowClear
          className="h-9"
        />
        <Button htmlType="submit" className="h-9 px-4 font-medium text-[#20392a]">
          Tìm
        </Button>
      </Form>
      <Select
        aria-label="Lọc theo danh mục"
        className="h-9 min-w-[150px]"
        value={props.categoryFilter}
        onChange={props.onCategoryFilterChange}
        options={[
          { value: "", label: "Danh mục: Tất cả" },
          ...props.categories.map((category) => ({ value: String(category.id), label: category.name })),
        ]}
      />
      <Select
        aria-label="Lọc theo trạng thái"
        className="h-9 min-w-[140px]"
        value={props.statusFilter}
        onChange={props.onStatusFilterChange}
        options={[
          { value: "", label: "Trạng thái: Tất cả" },
          { value: "ACTIVE", label: "Đang hoạt động" },
          { value: "HIDDEN", label: "Đã ẩn" },
        ]}
      />
      <Select
        aria-label="Lọc theo loại"
        className="h-9 min-w-[125px]"
        value={props.kindFilter}
        onChange={props.onKindFilterChange}
        options={[
          { value: "", label: "Loại: Tất cả" },
          { value: "SALE", label: "Bán" },
          { value: "REWARD", label: "Đổi thưởng" },
        ]}
      />
      <Select
        aria-label="Sắp xếp"
        className="h-9 min-w-[135px]"
        value={props.sort}
        onChange={props.onSortChange}
        options={[
          { value: "newest", label: "Mới nhất" },
          { value: "price_asc", label: "Giá tăng dần" },
          { value: "price_desc", label: "Giá giảm dần" },
          { value: "name_asc", label: "Tên A–Z" },
        ]}
      />
      <div className="flex h-9 items-center pl-1">
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
