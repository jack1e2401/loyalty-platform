import type { ProductDto } from "../../../../api/commerce-types";
import type { GalleryDraft } from "./MerchantProductGalleryEditor";

export type ProductFormState = {
  kind: ProductDto["kind"];
  name: string;
  price: string;
  sku: string;
  categoryId: string;
  lowStockThreshold: string;
  description: string;
  richDescription: string;
  images: GalleryDraft[];
  status: ProductDto["status"];
  initialQuantity: string;
};

export function initialProductForm(product: ProductDto | null): ProductFormState {
  if (!product) {
    return {
      kind: "SALE",
      name: "",
      price: "",
      sku: "",
      categoryId: "",
      lowStockThreshold: "5",
      description: "",
      richDescription: "",
      images: [],
      status: "ACTIVE",
      initialQuantity: "0",
    };
  }

  const images = product.images?.length
    ? product.images.map(({ url, altText }) => ({ url, altText: altText ?? "" }))
    : product.imageUrl
      ? [{ url: product.imageUrl, altText: "" }]
      : [];

  return {
    kind: product.kind ?? "SALE",
    name: product.name,
    price: product.price,
    sku: product.sku ?? "",
    categoryId: product.categoryId ? String(product.categoryId) : "",
    lowStockThreshold: String(product.lowStockThreshold ?? 5),
    description: product.description ?? "",
    richDescription: product.richDescription ?? "",
    images,
    status: product.status,
    initialQuantity: "0",
  };
}

export function validateProductBasics(form: ProductFormState, isNew: boolean): string {
  if (!form.name.trim()) return "Nhập tên sản phẩm để tiếp tục.";
  if (form.kind === "SALE" && !/^[1-9][0-9]{0,14}$/.test(form.price.trim())) {
    return "Giá phải là số nguyên dương, tối đa 15 chữ số.";
  }
  const threshold = Number(form.lowStockThreshold);
  if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 100000) {
    return "Ngưỡng tồn kho phải là số nguyên từ 0 đến 100.000.";
  }
  if (isNew) {
    const quantity = Number(form.initialQuantity);
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 2147483647) {
      return "Số lượng ban đầu phải là số nguyên không âm.";
    }
  }
  return "";
}
