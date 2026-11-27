import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Flex, Form, Input, InputNumber, Typography, type TableColumnsType } from "antd";
import { ArrowClockwise, MagnifyingGlass, PencilSimple, Plus, Trash } from "@phosphor-icons/react";
import { createCommerceClient, translateApiError } from "../../api/commerce-http";
import type { ProductCategoryDto } from "../../api/commerce-types";
import { CmsConfirmAction, CmsDataTable, CmsFilterBar, CmsFormDrawer } from "./cms";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type Props = { token: string; categories: ProductCategoryDto[]; loading: boolean; error: string | null; onChanged(): void; heading?: ReactNode; backAction?: ReactNode };
type CategoryFormState = { id: number | null; name: string; slug: string; description: string; sortOrder: string };
const emptyForm: CategoryFormState = { id: null, name: "", slug: "", description: "", sortOrder: "0" };

export function MerchantCategoriesPanel({ token, categories, loading, error, onChanged, heading, backAction }: Props) {
  const [form, setForm] = useState<CategoryFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) =>
      category.name.toLowerCase().includes(query)
      || category.slug.toLowerCase().includes(query)
      || (category.description ?? "").toLowerCase().includes(query),
    );
  }, [categories, search]);

  function openNew() { setForm(emptyForm); setActionError(""); setNotice(""); }
  function openEdit(category: ProductCategoryDto) {
    setForm({ id: category.id, name: category.name, slug: category.slug, description: category.description ?? "", sortOrder: String(category.sortOrder) });
    setActionError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    if (!form.name.trim()) { setActionError("Nhập tên danh mục."); return; }
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      const payload = {
        name: form.name.trim(),
        ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
        description: form.description.trim() || null,
        sortOrder: Number(form.sortOrder || "0"),
      };
      if (form.id === null) { await api.createCategory(payload, token); setNotice("Đã tạo danh mục."); }
      else { await api.updateCategory(form.id, payload, token); setNotice("Đã cập nhật danh mục."); }
      setForm(null);
      onChanged();
    } catch (reason) {
      setActionError(translateApiError(reason instanceof Error ? reason.message : "Không thể lưu danh mục."));
    } finally { setBusy(false); }
  }

  async function remove(category: ProductCategoryDto) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await api.deleteCategory(category.id, token);
      if (form?.id === category.id) setForm(null);
      setNotice(`Đã xóa danh mục "${category.name}". Các sản phẩm thuộc danh mục này đã được gỡ liên kết.`);
      onChanged();
    } catch (reason) {
      setActionError(translateApiError(reason instanceof Error ? reason.message : "Không thể xóa danh mục."));
    } finally { setBusy(false); }
  }

  const columns: TableColumnsType<ProductCategoryDto> = [
    { title: "Tên danh mục", dataIndex: "name", key: "name", width: 300, render: (name: string, category) => <div className="break-words"><strong>{name}</strong><div className="text-xs text-[#68776d]">/{category.slug}</div></div> },
    { title: "Mô tả", dataIndex: "description", key: "description", render: (value: string | null) => value || "—" },
    { title: "Thứ tự", dataIndex: "sortOrder", key: "sortOrder", align: "right", width: 100 },
    {
      title: "Thao tác",
      key: "actions",
      width: 180,
      render: (_: unknown, category) => (
        <Flex gap={8} wrap>
          <Button size="small" aria-label={`Sửa danh mục ${category.name}`} icon={<PencilSimple size={15} />} onClick={() => openEdit(category)}>Sửa</Button>
          <CmsConfirmAction title={`Xóa danh mục ${category.name}?`} description="Sản phẩm vẫn được giữ nhưng sẽ không còn thuộc danh mục này." confirmLabel="Xóa danh mục" destructive onConfirm={() => remove(category)}>
            <Button size="small" danger aria-label={`Xóa danh mục ${category.name}`} icon={<Trash size={15} />} disabled={busy}>Xóa</Button>
          </CmsConfirmAction>
        </Flex>
      ),
    },
  ];

  return (
    <section className="grid min-w-0 gap-5">
      <Flex justify={heading ? "space-between" : "end"} align="start" gap={16} wrap>
        {heading}
        <Flex gap={8} wrap>
          {backAction}
          <Button type="primary" icon={<Plus size={16} />} onClick={openNew}>Thêm danh mục</Button>
        </Flex>
      </Flex>
      {notice ? <Alert role="status" type="success" showIcon title={notice} /> : null}
      {error || (actionError && !form) ? <Alert role="alert" type="error" showIcon title={error || actionError} /> : null}
      <CmsFilterBar label="Bộ lọc danh mục" className="mb-0">
        <Input
          allowClear
          aria-label="Tìm danh mục"
          prefix={<MagnifyingGlass size={15} className="text-[#68776d]" />}
          placeholder="Tìm theo tên hoặc slug danh mục..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full sm:max-w-xs"
        />
        {search.trim() ? (
          <Button size="middle" onClick={() => setSearch("")}>Đặt lại</Button>
        ) : null}
        <Flex align="center" gap={12} className="ml-auto">
          <Typography.Text type="secondary" className="text-xs">
            {search.trim() ? `Hiển thị ${filteredCategories.length} / ${categories.length} danh mục` : `${categories.length} danh mục`}
          </Typography.Text>
          <Button icon={<ArrowClockwise size={15} />} loading={loading} onClick={onChanged}>Làm mới</Button>
        </Flex>
      </CmsFilterBar>
      <CmsDataTable
        label="Danh mục sản phẩm"
        rows={filteredCategories}
        columns={columns}
        rowKey="id"
        loading={loading}
        emptyText={search.trim() && categories.length > 0 ? "Không tìm thấy danh mục phù hợp." : "Chưa có danh mục nào."}
        tableLayout="fixed"
        scroll={{ x: 760 }}
      />
      <CmsFormDrawer
        open={form !== null}
        title={form?.id === null ? "Thêm danh mục" : "Sửa danh mục"}
        onClose={() => { if (!busy) setForm(null); }}
        width={560}
        footer={<Flex justify="end" gap={8}>
          <Button disabled={busy} onClick={() => setForm(null)}>Hủy</Button>
          <Button type="primary" htmlType="submit" form="merchant-category-form" loading={busy}>{form?.id === null ? "Tạo danh mục" : "Lưu danh mục"}</Button>
        </Flex>}
      >
        {form ? (
          <Form id="merchant-category-form" layout="vertical" disabled={busy} onSubmitCapture={(event) => void submit(event)}>
              {actionError ? <Alert type="error" showIcon title={actionError} className="mb-5" /> : null}
              <Form.Item label="Tên danh mục" htmlFor="merchant-category-name" required><Input id="merchant-category-name" required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Form.Item>
              <Form.Item label="Slug (tùy chọn)" htmlFor="merchant-category-slug"><Input id="merchant-category-slug" maxLength={120} placeholder="tu-dong-tao" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} /></Form.Item>
              <Form.Item label="Mô tả danh mục" htmlFor="merchant-category-description"><Input.TextArea id="merchant-category-description" rows={3} maxLength={255} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Form.Item>
              <Form.Item label="Thứ tự" htmlFor="merchant-category-sort"><InputNumber id="merchant-category-sort" style={{ width: "100%" }} min={0} max={100000} precision={0} value={Number(form.sortOrder)} onChange={(value) => setForm({ ...form, sortOrder: String(value ?? "") })} /></Form.Item>
          </Form>
        ) : null}
      </CmsFormDrawer>
    </section>
  );
}
