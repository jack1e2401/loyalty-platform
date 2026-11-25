import { requestJson, translateApiError } from "./commerce/shared";
import type {
  MerchantApproveRefundResponse,
  MerchantReconcileRefundResponse,
  ManualRefundEvidenceInput,
  ListRefundRequestsParams,
  RefundRequestDetailResponse,
  RefundRequestDto,
  RefundRequestListResponse,
} from "./refunds-types";

export function translateRefundRequestError(code: string): string {
  const translations: Record<string, string> = {
    REFUND_REQUEST_ALREADY_EXISTS: "Đơn hàng này đã có yêu cầu hoàn tiền.",
    REFUND_REQUEST_NOT_FOUND: "Không tìm thấy yêu cầu hoàn tiền.",
    ORDER_NOT_REFUNDABLE: "Đơn hàng không ở trạng thái có thể hoàn tiền.",
    REFUND_REQUEST_NOT_PENDING: "Yêu cầu này đã được xử lý. Hãy tải lại để xem kết quả.",
    REFUND_REQUEST_NOT_PROCESSING: "Yêu cầu chưa ở trạng thái đối soát.",
    REFUND_SETTLEMENT_REFERENCE_CONFLICT: "Mã giao dịch đã được ghi nhận với dữ liệu khác.",
    PROVIDER_REFERENCE_REQUIRED: "Vui lòng nhập mã giao dịch hoàn tiền từ nhà cung cấp.",
    FAILURE_REASON_REQUIRED: "Vui lòng nhập lý do thất bại từ nhà cung cấp.",
    USE_REFUND_APPROVAL_WORKFLOW: "Vui lòng xử lý hoàn tiền thông qua quy trình phê duyệt yêu cầu hoàn tiền.",
    REASON_REQUIRED: "Vui lòng nhập lý do.",
  };
  return translations[code] ?? translateApiError(code);
}

export function createRefundsClient(
  baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  fetcher: typeof fetch = fetch,
) {
  return {
    createMemberRefundRequest(orderId: number, reason: string, token: string) {
      return requestJson<{ refundRequest: RefundRequestDto }>(
        fetcher,
        baseUrl,
        `/api/orders/${orderId}/refund-request`,
        { method: "POST", body: { reason }, token },
      );
    },

    getMemberOrderRefundRequest(orderId: number, token: string) {
      return requestJson<{ refundRequest: RefundRequestDto | null }>(
        fetcher,
        baseUrl,
        `/api/member/orders/${orderId}/refund-request`,
        { token },
      );
    },

    listMerchantRefundRequests(params: ListRefundRequestsParams = {}, token: string) {
      const search = new URLSearchParams();
      if (params.status) search.set("status", params.status);
      if (params.page) search.set("page", String(params.page));
      if (params.limit) search.set("limit", String(params.limit));
      const qs = search.toString();
      return requestJson<RefundRequestListResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/refund-requests${qs ? `?${qs}` : ""}`,
        { token },
      );
    },

    getMerchantRefundRequest(requestId: number, token: string, paging?: { page: number; limit: number; challengePage: number; challengeLimit: number }) {
      const query = paging ? `?page=${paging.page}&limit=${paging.limit}&challengePage=${paging.challengePage}&challengeLimit=${paging.challengeLimit}` : "";
      return requestJson<RefundRequestDetailResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/refund-requests/${requestId}${query}`,
        { token },
      );
    },

    approveMerchantRefundRequest(requestId: number, token: string, note?: string) {
      return requestJson<MerchantApproveRefundResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/refund-requests/${requestId}/approve`,
        { method: "POST", body: note ? { note } : {}, token },
      );
    },

    reconcileMerchantRefundRequest(requestId: number, evidence: ManualRefundEvidenceInput, token: string) {
      return requestJson<MerchantReconcileRefundResponse>(
        fetcher,
        baseUrl,
        `/api/merchant/refund-requests/${requestId}/reconcile`,
        { method: "POST", body: evidence, token },
      );
    },

    rejectMerchantRefundRequest(requestId: number, reason: string, token: string) {
      return requestJson<{ refundRequest: RefundRequestDto }>(
        fetcher,
        baseUrl,
        `/api/merchant/refund-requests/${requestId}/reject`,
        { method: "POST", body: { reason }, token },
      );
    },

  };
}
