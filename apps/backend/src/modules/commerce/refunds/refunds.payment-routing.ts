export type RefundPaymentProvider = "MOCK" | "VNPAY" | "UNKNOWN";
export type RefundSettlementRoute = "MOCK_REFUND" | "MANUAL_RECONCILIATION";

export function refundSettlementRoute(provider: RefundPaymentProvider): RefundSettlementRoute {
  return provider === "MOCK" ? "MOCK_REFUND" : "MANUAL_RECONCILIATION";
}
