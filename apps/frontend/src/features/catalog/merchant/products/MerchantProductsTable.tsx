import { Button, Dropdown, Flex, Typography, type TableColumnsType } from "antd";
import type { ProductDto, ProductKind, ProductStatus } from "../../../../api/commerce-types";
import { Button as UiButton } from "../../../../components/ui";
import { money } from "../../../../lib/utils";
import { CmsDataTable, CmsStatusTag } from "../../../merchant/cms";

type MerchantProductsTableProps = {
  items: ProductDto[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  onStatusChange: (product: ProductDto) => void;
  onNavigate: (path: string) => void;
};

export function MerchantProductsTable({
  items,
  page,
  pageSize,
  totalItems,
  totalPages,
  busy,
  onPageChange,
  onStatusChange,
  onNavigate,
}: MerchantProductsTableProps) {
  const columns: TableColumnsType<ProductDto> = [
    {
      title: "Sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 260,
      render: (_: string, product) => (
        <Flex align="center" gap={12} className="min-w-52">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt=""
              className="size-10 rounded-md border border-[#e3e9e2] object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <Typography.Text strong>{product.name}</Typography.Text>
            <Flex gap={6} wrap className="mt-1">
              <Typography.Text type="secondary">#{product.id}</Typography.Text>
              {product.sku ? <Typography.Text type="secondary">SKU: {product.sku}</Typography.Text> : null}
              {product.isLowStock ? (
                <CmsStatusTag label={`Sắp hết hàng (≤ ${product.lowStockThreshold ?? 5})`} tone="warning" />
              ) : null}
            </Flex>
          </div>
        </Flex>
      ),
    },
    { title: "Danh mục", key: "category", render: (_: unknown, product) => product.category?.name ?? "—" },
    {
      title: "Loại",
      dataIndex: "kind",
      key: "kind",
      render: (kind: ProductKind) => (kind === "REWARD" ? "Đổi thưởng" : "Bán"),
    },
    {
      title: "Giá",
      dataIndex: "price",
      key: "price",
      align: "right",
      render: (price: string, product) => (product.kind === "REWARD" ? "—" : money(Number(price))),
    },
    {
      title: "Tồn kho",
      key: "inventory",
      render: (_: unknown, product) => (
        <span>
          <strong>{product.inventory?.availableQuantity ?? "—"}</strong>{" "}
          <Typography.Text type="secondary">có thể bán</Typography.Text>
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: ProductStatus, product) => (
        <Flex align="center" gap={8} wrap>
          <CmsStatusTag
            label={status === "ACTIVE" ? "Đang hoạt động" : "Đã ẩn"}
            tone={status === "ACTIVE" ? "success" : "neutral"}
          />
          <UiButton
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            aria-label={`${status === "ACTIVE" ? "Ẩn" : "Hiển thị"} sản phẩm ${product.name}`}
            onClick={() => onStatusChange(product)}
          >
            {status === "ACTIVE" ? "Ẩn" : "Hiển thị"}
          </UiButton>
        </Flex>
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      fixed: "right",
      render: (_: unknown, product) => (
        <Dropdown
          trigger={["click"]}
          menu={{
            items: [
              { key: "edit", label: "Chỉnh sửa sản phẩm" },
              {
                key: "adjust",
                label: product.kind === "REWARD" ? "Điều chỉnh số lượng quà" : "Điều chỉnh tồn kho",
              },
              { key: "history", label: product.kind === "REWARD" ? "Lịch sử số lượng" : "Lịch sử tồn kho" },
            ],
            onClick: ({ key }) => {
              if (key === "edit") onNavigate(`/merchant/products/${product.id}/edit`);
              if (key === "adjust" || key === "history")
                onNavigate(
                  `/merchant/inventory/${product.kind === "REWARD" ? "reward" : "product"}/${product.id}${key === "history" ? "?tab=history" : ""}`,
                );
            },
          }}
        >
          <Button size="small" disabled={busy} aria-label={`Thao tác sản phẩm ${product.name}`}>
            Thao tác
          </Button>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <Typography.Text type="secondary" className="mb-2 block">
        Trang {page} / {Math.max(1, totalPages)} · {totalItems} sản phẩm
      </Typography.Text>
      <CmsDataTable
        label="Sản phẩm"
        rows={items}
        columns={columns}
        rowKey="id"
        pagination={{
          current: page,
          pageSize,
          total: totalItems,
          showSizeChanger: false,
          onChange: onPageChange,
        }}
      />
    </>
  );
}
