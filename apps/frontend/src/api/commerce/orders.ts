import type {
  CreateOrderInput,
  OrderResponse,
  MerchantOrdersResponse,
  OrdersResponse,
  CancelOrderResponse,
  RefundPreviewDto,
  RefundResponseDto,
} from "../contracts/orders";
import { requestJson } from "./shared";

export function createOrdersClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    createOrder(input: CreateOrderInput, token: string, idempotencyKey: string = crypto.randomUUID()) {
      return requestJson<OrderResponse>(fetcher, baseUrl, "/api/orders", {
        method: "POST",
        token,
        headers: { "Idempotency-Key": idempotencyKey },
        body: input,
      });
    },
    payMockOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/orders/${orderId}/pay`, {
        method: "POST",
        token,
      });
    },
    listMemberOrders(merchantId: number, token: string) {
      return requestJson<OrdersResponse>(fetcher, baseUrl, `/api/member/orders?merchantId=${merchantId}`, {
        token,
      });
    },
    getMemberOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/member/orders/${orderId}`, { token });
    },
    listMerchantOrders(token: string, filters?: { page: number; limit: number; q?: string; status?: string }) {
      const query = filters ? `?${new URLSearchParams({ page: String(filters.page), limit: String(filters.limit), q: filters.q ?? "", status: filters.status ?? "" })}` : "";
      return requestJson<MerchantOrdersResponse>(fetcher, baseUrl, `/api/merchant/orders${query}`, { token });
    },
    getMerchantOrder(orderId: number, token: string) {
      return requestJson<OrderResponse>(fetcher, baseUrl, `/api/merchant/orders/${orderId}`, { token });
    },
    cancelOrder(orderId: number, token: string) {
      return requestJson<CancelOrderResponse>(fetcher, baseUrl, `/api/orders/${orderId}/cancel`, {
        method: "POST",
        token,
      });
    },
    getRefundPreview(orderId: number, token: string) {
      return requestJson<RefundPreviewDto>(
        fetcher,
        baseUrl,
        `/api/merchant/orders/${orderId}/refund-preview`,
        { token },
      );
    },
    refundOrder(orderId: number, body: { reason: string }, token: string) {
      return requestJson<RefundResponseDto>(fetcher, baseUrl, `/api/merchant/orders/${orderId}/refund`, {
        method: "POST",
        token,
        body,
      });
    },
  };
}
