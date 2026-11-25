import { useState } from "react";
import { createAnalyticsClient } from "../../api/analytics-client";
import type { AnalyticsProductRow, MerchantAnalyticsQuery } from "../../api/analytics-types";
import { useResource } from "../../api/useResource";
import { Card, EmptyState, ErrorState, LoadingState, StatusText } from "../../components/ui";
import { money } from "../../lib/utils";
import { MerchantPagination } from "../merchant/cms/MerchantPagination";

const api = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
type TableKind = "top" | "slow" | "no-sales" | "low-stock";

const tables: { kind: TableKind; label: string; title: string }[] = [
  { kind: "top", label: "Sản phẩm bán chạy", title: "Top sản phẩm bán chạy" },
  { kind: "slow", label: "Sản phẩm bán chậm", title: "Sản phẩm bán chậm" },
  { kind: "no-sales", label: "Không phát sinh đơn 90 ngày", title: "Không phát sinh đơn 90 ngày" },
  { kind: "low-stock", label: "Cảnh báo tồn kho thấp", title: "Cảnh báo tồn kho thấp" },
];

export function AnalyticsProductTables({ query, token }: { query: MerchantAnalyticsQuery; token: string }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {tables.map((table) => <ProductTable key={table.kind} {...table} query={query} token={token} />)}
    </div>
  );
}

function ProductTable({ kind, label, title, query, token }: typeof tables[number] & { query: MerchantAnalyticsQuery; token: string }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const resource = useResource(() => api.getAnalyticsProductTable(kind, { ...query, page, limit }, token),
    [kind, query.from, query.to, query.granularity, page, limit, token]);
  const rows = resource.data?.items ?? [];
  const thirdHeading = kind === "top" ? "Doanh thu" : kind === "no-sales" ? "Bán gần nhất" : kind === "low-stock" ? "Ngưỡng cảnh báo" : "Tồn khả dụng";

  return (
    <section aria-label={label} className="space-y-3">
      <h2 className="text-lg font-extrabold text-[#20392a]">{title}</h2>
      {resource.loading ? <LoadingState cards={1} /> : resource.error ? <ErrorState message={resource.error} retry={resource.reload} />
        : rows.length === 0 ? <EmptyState title="Chưa có dữ liệu" description="Không có sản phẩm phù hợp." />
        : (
          <Card className="overflow-x-auto rounded-3xl">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">Sản phẩm</th>
                  <th scope="col" className="px-4 py-3.5 text-right">{kind === "top" || kind === "slow" ? "Đã bán" : "Tồn khả dụng"}</th>
                  <th scope="col" className="px-5 py-3.5 text-right">{thirdHeading}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.productId} className="border-t border-[#edf1ea]">
                    <th scope="row" className="px-5 py-3.5 font-bold">
                      {item.productName}
                      {item.sku && <span className="mt-0.5 block text-xs font-normal muted">SKU: {item.sku}</span>}
                    </th>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {kind === "top" || kind === "slow" ? item.unitsSold : kind === "low-stock"
                        ? <StatusText tone={item.availableQuantity <= 0 ? "red" : "amber"}>{item.availableQuantity}</StatusText>
                        : item.availableQuantity}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">{thirdValue(kind, item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      {resource.data?.pagination && <MerchantPagination {...resource.data.pagination}
        onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }} />}
    </section>
  );
}

function thirdValue(kind: TableKind, item: AnalyticsProductRow) {
  if (kind === "top") return money(Number(item.revenueVnd));
  if (kind === "slow") return item.availableQuantity;
  if (kind === "no-sales") return item.lastSoldAt ? new Date(item.lastSoldAt).toLocaleDateString("vi-VN") : "Chưa từng bán";
  return item.lowStockThreshold;
}
