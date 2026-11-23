import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Flex, Form, Input, InputNumber, Select, Steps } from "antd";
import { createCommerceClient, translateApiError } from "../../../../api/commerce-http";
import type { ProductCategoryDto, ProductDto } from "../../../../api/commerce-types";
import { CmsPageHeader } from "../../../merchant/cms";
import { MerchantProductGalleryEditor } from "./MerchantProductGalleryEditor";
import { ProductReview } from "./ProductReview";
import { initialProductForm, validateProductBasics, type ProductFormState } from "./product-form";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MerchantProductWizard({
  product,
  categories,
  token,
  onCancel,
  onSaved,
}: {
  product: ProductDto | null;
  categories: ProductCategoryDto[];
  token: string;
  onCancel(): void;
  onSaved(saved: ProductDto, isNew: boolean): void;
}) {
  const isNew = product === null;
  const [form, setForm] = useState(() => initialProductForm(product));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (patch: Partial<ProductFormState>) => setForm((current) => ({ ...current, ...patch }));

  function changeStep(next: number) {
    if (busy) return;
    const problem = next > step ? validateProductBasics(form, isNew) : "";
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep(next);
  }

  const nextStep = () => changeStep(Math.min(2, step + 1));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step < 2) {
      nextStep();
      return;
    }
    const problem = validateProductBasics(form, isNew);
    if (problem) {
      setStep(0);
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    const images = form.images
      .map((image, index) => ({
        url: image.url.trim(),
        altText: image.altText.trim() || null,
        sortOrder: index,
      }))
      .filter((image) => image.url.length > 0);
    const categoryId = form.categoryId ? Number(form.categoryId) : null;
    const sku = form.sku.trim() || null;
    const richDescription = form.richDescription.trim() ? form.richDescription : null;
    const threshold = Number(form.lowStockThreshold || "5");
    try {
      if (isNew) {
        const base = {
          name: form.name.trim(),
          description: form.description || null,
          imageUrl: images[0]?.url ?? null,
          ...(images.length ? { images } : {}),
          ...(richDescription !== null ? { richDescription } : {}),
          ...(sku ? { sku } : {}),
          ...(categoryId !== null ? { categoryId } : {}),
          ...(threshold !== 5 ? { lowStockThreshold: threshold } : {}),
          initialQuantity: Number(form.initialQuantity || "0"),
        };
        const result = await api.createProduct(
          form.kind === "REWARD" ? { ...base, kind: "REWARD" } : { ...base, price: form.price.trim() },
          token,
        );
        onSaved(result.product, true);
      } else if (product) {
        const result = await api.updateProduct(
          product.id,
          {
            name: form.name.trim(),
            description: form.description || null,
            richDescription,
            sku,
            categoryId,
            lowStockThreshold: threshold,
            images,
            ...(form.kind === "SALE" ? { price: form.price.trim() } : {}),
            status: form.status,
          },
          token,
        );
        onSaved(result.product, false);
      }
    } catch (reason) {
      setError(translateApiError(reason instanceof Error ? reason.message : "Không thể lưu sản phẩm."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-6">
      <CmsPageHeader title={isNew ? "Thêm sản phẩm" : `Chỉnh sửa sản phẩm #${product.id}`} />
      <Card styles={{ body: { padding: "clamp(16px, 3vw, 32px)" } }}>
        <Steps
          current={step}
          onChange={changeStep}
          responsive
          items={[{ title: "Thông tin" }, { title: "Mô tả và ảnh" }, { title: "Kiểm tra" }]}
        />
        <Form layout="vertical" style={{ marginTop: 32 }} onSubmitCapture={(event) => void submit(event)}>
          <fieldset disabled={busy} className="min-w-0">
            {step === 0 ? (
              <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
                <Form.Item label="Loại sản phẩm" htmlFor="merchant-product-kind">
                  <Select
                    id="merchant-product-kind"
                    disabled={!isNew || busy}
                    value={form.kind}
                    onChange={(kind: ProductDto["kind"]) => update({ kind })}
                    options={[
                      { value: "SALE", label: "Sản phẩm bán" },
                      { value: "REWARD", label: "Chỉ đổi thưởng" },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="Tên sản phẩm" htmlFor="merchant-product-name" required>
                  <Input
                    id="merchant-product-name"
                    maxLength={191}
                    value={form.name}
                    onChange={(event) => update({ name: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Mã SKU" htmlFor="merchant-product-sku">
                  <Input
                    id="merchant-product-sku"
                    maxLength={64}
                    placeholder="Ví dụ: CF-001"
                    value={form.sku}
                    onChange={(event) => update({ sku: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Danh mục" htmlFor="merchant-product-category">
                  <Select
                    id="merchant-product-category"
                    allowClear
                    value={form.categoryId || undefined}
                    onChange={(categoryId) => update({ categoryId: categoryId ?? "" })}
                    options={categories.map((category) => ({
                      value: String(category.id),
                      label: category.name,
                    }))}
                    placeholder="Không có danh mục"
                  />
                </Form.Item>
                {form.kind === "SALE" ? (
                  <Form.Item label="Giá (VND)" htmlFor="merchant-product-price" required>
                    <Input
                      id="merchant-product-price"
                      inputMode="numeric"
                      value={form.price}
                      onChange={(event) => update({ price: event.target.value })}
                    />
                  </Form.Item>
                ) : null}
                {isNew ? (
                  <Form.Item label="Số lượng ban đầu" htmlFor="merchant-product-initial-quantity">
                    <InputNumber
                      id="merchant-product-initial-quantity"
                      style={{ width: "100%" }}
                      min={0}
                      max={2147483647}
                      precision={0}
                      value={Number(form.initialQuantity)}
                      onChange={(value) => update({ initialQuantity: String(value ?? "") })}
                    />
                  </Form.Item>
                ) : null}
                <Form.Item label="Ngưỡng cảnh báo tồn kho thấp" htmlFor="merchant-product-threshold">
                  <InputNumber
                    id="merchant-product-threshold"
                    style={{ width: "100%" }}
                    min={0}
                    max={100000}
                    precision={0}
                    value={Number(form.lowStockThreshold)}
                    onChange={(value) => update({ lowStockThreshold: String(value ?? "") })}
                  />
                </Form.Item>
                {!isNew ? (
                  <Form.Item label="Trạng thái" htmlFor="merchant-product-status">
                    <Select
                      id="merchant-product-status"
                      value={form.status}
                      onChange={(status: ProductDto["status"]) => update({ status })}
                      options={[
                        { value: "ACTIVE", label: "Đang hoạt động" },
                        { value: "HIDDEN", label: "Đã ẩn" },
                      ]}
                    />
                  </Form.Item>
                ) : null}
              </div>
            ) : null}
            {step === 1 ? (
              <div className="space-y-5">
                <Form.Item label="Mô tả ngắn" htmlFor="merchant-product-description">
                  <Input.TextArea
                    id="merchant-product-description"
                    rows={3}
                    maxLength={1000}
                    value={form.description}
                    onChange={(event) => update({ description: event.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Mô tả chi tiết" htmlFor="merchant-product-rich-description">
                  <Input.TextArea
                    id="merchant-product-rich-description"
                    rows={5}
                    maxLength={5000}
                    placeholder="Thông tin nguồn gốc, hướng dẫn bảo quản…"
                    value={form.richDescription}
                    onChange={(event) => update({ richDescription: event.target.value })}
                  />
                </Form.Item>
                <MerchantProductGalleryEditor
                  images={form.images}
                  onChange={(images) => update({ images })}
                />
              </div>
            ) : null}
            {step === 2 ? <ProductReview form={form} categories={categories} isNew={isNew} /> : null}
            {error ? <Alert type="error" showIcon title={error} className="mt-4" /> : null}
            <Flex justify="space-between" gap={8} wrap style={{ marginTop: 24 }}>
              <Button onClick={onCancel} disabled={busy}>
                Hủy
              </Button>
              <Flex gap={8} wrap>
                {step > 0 ? (
                  <Button
                    onClick={() => {
                      setStep((current) => current - 1);
                      setError("");
                    }}
                    disabled={busy}
                  >
                    Quay lại
                  </Button>
                ) : null}
                {step < 2 ? (
                  <Button
                    key="next"
                    type="primary"
                    htmlType="button"
                    onClick={(event) => {
                      event.preventDefault();
                      nextStep();
                    }}
                    disabled={busy}
                  >
                    Tiếp tục
                  </Button>
                ) : (
                  <Button key="save" type="primary" htmlType="submit" loading={busy}>
                    {isNew ? "Tạo sản phẩm" : "Lưu thay đổi"}
                  </Button>
                )}
              </Flex>
            </Flex>
          </fieldset>
        </Form>
      </Card>
    </section>
  );
}
