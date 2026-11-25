import type { AnalyticsProductRow, PaginationDto } from "./analytics-types";
import type {
  CustomerDetailResponse,
  CustomerListQuery,
  CustomerListResponse,
  EnsureMembershipResponse,
  MerchantAnalyticsQuery,
  MerchantAnalyticsResponse,
} from "./analytics-types";
import { fetchWithSessionRefresh } from "./session-http";

type FetchLike = typeof fetch;

async function requestAnalyticsJson<T>(
  fetcher: FetchLike,
  baseUrl: string,
  path: string,
  options: { method?: "GET" | "POST" | "PATCH"; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetchWithSessionRefresh(fetcher, baseUrl, path, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }, options.token);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Yêu cầu thất bại (${response.status})`;
    throw new Error(error);
  }
  return payload as T;
}

export function createAnalyticsClient(baseUrl: string, fetcher: FetchLike = fetch) {
  return {
    ensureStoreMembershipBySlug(slug: string, token: string) {
      return requestAnalyticsJson<EnsureMembershipResponse>(
        fetcher,
        baseUrl,
        `/api/member/stores/${encodeURIComponent(slug)}/membership`,
        { method: "POST", token },
      );
    },

    ensureStoreMembershipByMerchantId(merchantId: number, token: string) {
      return requestAnalyticsJson<EnsureMembershipResponse>(
        fetcher,
        baseUrl,
        `/api/member/merchants/${merchantId}/membership`,
        { method: "POST", token },
      );
    },

    listMerchantCustomers(query: CustomerListQuery, token: string) {
      const params = new URLSearchParams();
      if (query.q?.trim()) params.set("q", query.q.trim());
      if (query.tier) params.set("tier", query.tier);
      if (query.purchaseStatus && query.purchaseStatus !== "all") {
        params.set("purchaseStatus", query.purchaseStatus);
      }
      if (query.page) params.set("page", String(query.page));
      if (query.limit) params.set("limit", String(query.limit));
      const qs = params.toString();
      return requestAnalyticsJson<CustomerListResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/customers${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    getMerchantCustomerDetail(memberId: number | string, token: string, paging?: Record<"orders" | "pointLedger" | "vouchers", { page: number; limit: number }>) {
      const params = new URLSearchParams();
      if (paging) {
        params.set("paged", "1");
        for (const [key, value] of Object.entries(paging)) {
          params.set(`${key}Page`, String(value.page));
          params.set(`${key}Limit`, String(value.limit));
        }
      }
      return requestAnalyticsJson<CustomerDetailResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/customers/${memberId}${paging ? `?${params}` : ""}`,
        { token },
      );
    },

    getAnalyticsProductTable(table: "top" | "slow" | "no-sales" | "low-stock", query: MerchantAnalyticsQuery & { page: number; limit: number }, token: string) {
      const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.granularity) params.set("granularity", query.granularity);
      return requestAnalyticsJson<{ items: AnalyticsProductRow[]; pagination: PaginationDto }>(
        fetcher, baseUrl, `/api/merchant/analytics/products/${table}?${params}`, { token },
      );
    },

    getMerchantAnalyticsSummary(query: MerchantAnalyticsQuery, token: string) {
      const params = new URLSearchParams({ summary: "1" });
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.granularity) params.set("granularity", query.granularity);
      return requestAnalyticsJson<Pick<MerchantAnalyticsResponse, "range" | "kpis" | "revenueSeries">>(
        fetcher, baseUrl, `/api/merchant/analytics?${params}`, { token },
      );
    },

    getMerchantAnalytics(query: MerchantAnalyticsQuery, token: string) {
      const params = new URLSearchParams();
      if (query.from) params.set("from", query.from);
      if (query.to) params.set("to", query.to);
      if (query.granularity) params.set("granularity", query.granularity);
      const qs = params.toString();
      return requestAnalyticsJson<MerchantAnalyticsResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/analytics${qs ? `?${qs}` : ""}`,
        { token },
      );
    },
  };
}
