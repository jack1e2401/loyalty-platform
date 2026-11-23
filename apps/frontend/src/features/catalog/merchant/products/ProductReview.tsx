import { Card, Descriptions } from "antd";
import type { ProductCategoryDto } from "../../../../api/commerce-types";
import type { ProductFormState } from "./product-form";

type Props = {
  form: ProductFormState;
  categories: ProductCategoryDto[];
  isNew: boolean;
};

export function ProductReview({ form, categories, isNew }: Props) {
  return (
    <Card title="Kiểm tra thông tin" size="small">
      <Descriptions column={{ xs: 1, sm: 2 }} size="small">
        <Descriptions.Item label="Loại">
          {form.kind === "REWARD" ? "Chỉ đổi thưởng" : "Sản phẩm bán"}
        </Descriptions.Item>
        <Descriptions.Item label="Tên">{form.name.trim()}</Descriptions.Item>
        <Descriptions.Item label="SKU">{form.sku.trim() || "—"}</Descriptions.Item>
        <Descriptions.Item label="Danh mục">
          {categories.find((category) => String(category.id) === form.categoryId)?.name ?? "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Giá">{form.kind === "REWARD" ? "—" : `${form.price} ₫`}</Descriptions.Item>
        <Descriptions.Item label="Tồn kho ban đầu">
          {isNew ? form.initialQuantity : "Không thay đổi"}
        </Descriptions.Item>
        <Descriptions.Item label="Ngưỡng tồn kho thấp">{form.lowStockThreshold}</Descriptions.Item>
        <Descriptions.Item label="Trạng thái">
          {form.status === "ACTIVE" ? "Đang hoạt động" : "Đã ẩn"}
        </Descriptions.Item>
        <Descriptions.Item label="Ảnh" span="filled">
          {form.images.filter((image) => image.url.trim()).length}
        </Descriptions.Item>
        <Descriptions.Item label="Mô tả ngắn" span="filled">
          <div className="whitespace-pre-wrap break-words">{form.description || "—"}</div>
        </Descriptions.Item>
        <Descriptions.Item label="Mô tả chi tiết" span="filled">
          <div className="whitespace-pre-wrap break-words">{form.richDescription || "—"}</div>
        </Descriptions.Item>
      </Descriptions>
      <div className="flex flex-wrap gap-3">
        {form.images
          .filter((image) => image.url.trim())
          .map((image, index) => (
            <img
              key={index}
              src={image.url.trim()}
              alt={image.altText || `Ảnh sản phẩm ${index + 1}`}
              className="size-24 rounded-lg border border-[#e3e9e2] object-cover"
            />
          ))}
      </div>
    </Card>
  );
}
