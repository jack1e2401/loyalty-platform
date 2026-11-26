// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MerchantPurchaseOrdersTable, type MerchantOrderRow } from "../../../../apps/frontend/src/features/merchant/backend/MerchantPurchaseOrdersTable";

const base: MerchantOrderRow = {
  id: 1,
  merchantId: 2,
  memberId: 3,
  status: "PAID",
  subtotal: "1",
  discountAmount: "0",
  total: "1",
  paidAt: null,
  items: [],
  earnedPointsExact: null,
  actions: { canCancel: false, canRefund: true },
};
const request = {
  id: 17,
  status: "PENDING_MERCHANT" as const,
  reason: "Sản phẩm bị lỗi",
  requestedAt: "2026-11-18T00:00:00Z",
  merchantReviewedAt: null,
  adminReviewedAt: null,
  merchantDecisionReason: null,
  adminDecisionReason: null,
};

it("links real member refund requests to the merchant review page", () => {
  render(
    <MemoryRouter>
      <MerchantPurchaseOrdersTable orders={[base, { ...base, id: 2, refundRequest: request }]} />
    </MemoryRouter>,
  );
  const reviewLinks = screen.getAllByRole("link", { name: "Xử lý yêu cầu hoàn tiền" });
  expect(reviewLinks).toHaveLength(1);
  expect(reviewLinks[0]).toHaveAttribute("href", "/merchant/refund-requests?requestId=17");
});
