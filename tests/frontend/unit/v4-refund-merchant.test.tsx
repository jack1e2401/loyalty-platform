// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantRefundRequestsPage } from "../../../apps/frontend/src/features/merchant/refunds/MerchantRefundRequestsPage";

const mocks = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), approve: vi.fn(), reconcile: vi.fn(), reject: vi.fn() }));
vi.mock("../../../apps/frontend/src/api/refunds-client", () => ({
  createRefundsClient: () => ({
    listMerchantRefundRequests: mocks.list,
    getMerchantRefundRequest: mocks.get,
    approveMerchantRefundRequest: mocks.approve,
    reconcileMerchantRefundRequest: mocks.reconcile,
    rejectMerchantRefundRequest: mocks.reject,
  }),
}));
const item = {
  id: 11,
  orderId: 21,
  memberId: 4,
  merchantId: 2,
  reason: "Hàng lỗi",
  status: "PENDING_MERCHANT" as const,
  requestedAt: "2026-11-17T00:00:00Z",
  merchantReviewedById: null,
  merchantReviewedAt: null,
  merchantDecisionReason: null,
  adminReviewedById: null,
  adminReviewedAt: null,
  adminDecisionReason: null,
  createdAt: "",
  updatedAt: "",
  orderTotalVnd: "50000",
  orderStatus: "PAID" as const,
  memberEmail: "m@test.local",
};
const detail = {
  refundRequest: item,
  order: {
    id: 21,
    merchantId: 2,
    memberId: 4,
    status: "PAID" as const,
    paymentProvider: "MOCK" as const,
    paymentProviderReference: null,
    paymentProviderTransactionNo: null,
    subtotal: "50000",
    discountAmount: "0",
    total: "50000",
    paidAt: null,
    items: [{ productId: 1, productName: "Tea", unitPrice: "50000", quantity: 1, lineTotal: "50000" }],
    earnedPointsExact: "5",
    actions: { canRefund: false, canCancel: false },
  },
  preview: {
    orderId: 21,
    refundAmountVnd: "50000",
    refundStatus: null,
    earningReversalExact: "5",
    walletBefore: { availablePoints: 10, netLifetimeEarned: "10", pointDebt: "0", fractionalCarry: "0" },
    walletAfter: { availablePoints: 5, netLifetimeEarned: "5", pointDebt: "0", fractionalCarry: "0" },
    tierBefore: "BRONZE",
    tierAfter: "BRONZE",
    discountVoucherRestorable: true,
    challenges: [
      {
        challengeId: 1,
        title: "First",
        type: "ORDER_COUNT",
        targetValue: "3",
        currentValueBefore: "3",
        currentValueAfter: "2",
        rewardStateBefore: "REWARDED",
        rewardStateAfter: "IN_PROGRESS",
        grantStatusBefore: "GRANTED",
        grantStatusAfter: "REVERSED",
        pointsToReverseExact: "5",
        budgetSpentBefore: "5",
        budgetSpentAfter: "0",
      },
    ],
  },
};
function renderPage(initialEntry = "/merchant/refund-requests") {
  const s = JSON.stringify({
    accessToken: "merchant-token",
    user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", s);
  sessionStorage.setItem("loyalty.auth.session", s);
  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <MerchantRefundRequestsPage />
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}
describe("merchant refund request approvals", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mocks.list.mockResolvedValue({
      items: [item],
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    mocks.get.mockResolvedValue(detail);
    mocks.approve.mockResolvedValue({ refundRequest: { ...item, status: "COMPLETED" } });
    mocks.reconcile.mockResolvedValue({
      refundRequest: { ...item, status: "COMPLETED" },
      reconciliationAttempt: { id: 1, providerReference: "refund-456", providerTransactionNo: null, outcome: "SETTLED", failureReason: null, createdAt: "" },
      manualReconciliationRequired: false,
    });
    mocks.reject.mockResolvedValue({ refundRequest: { ...item, status: "REJECTED" } });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  it("renders refund requests in a named data table", async () => {
    renderPage();
    expect(await screen.findByRole("table", { name: "Yêu cầu hoàn tiền" })).toBeInTheDocument();
  });
  it("offers distinct refund filters and requests the selected backend status", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Yêu cầu hoàn tiền" });
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING_MERCHANT" }),
      "merchant-token",
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Lọc trạng thái" }));
    expect(await screen.findByTitle("Tất cả trạng thái")).toBeInTheDocument();
    expect(screen.getByTitle("Đã duyệt")).toBeInTheDocument();
    expect(screen.getByTitle("Chờ đối soát hoàn tiền thủ công")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Đã duyệt"));
    await waitFor(() =>
      expect(mocks.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "APPROVED" }),
        "merchant-token",
      ),
    );
  });
  it("restores the selected refund detail from the URL", async () => {
    renderPage("/merchant/refund-requests?requestId=11");
    expect(await screen.findByText(/Nhiệm vụ: First/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Yêu cầu hoàn tiền #11" })).toBeInTheDocument();
  });
  it("shows the preview and requires confirmation before executing the refund", async () => {
    mocks.approve.mockResolvedValue({ refundRequest: { ...item, status: "COMPLETED" } });
    renderPage();
    await screen.findByText("Hàng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
    expect(await screen.findByText(/Nhiệm vụ: First/)).toBeInTheDocument();
    expect(screen.getAllByText(/50\.000/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Duyệt hoàn tiền" }));
    expect(mocks.approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận hoàn tiền" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(11, "merchant-token", undefined));
  });
  it("requires a rejection reason and confirmation before rejecting", async () => {
    renderPage();
    await screen.findByText("Hàng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
    await screen.findByText(/Nhiệm vụ: First/);
    const reject = screen.getByRole("button", { name: "Từ chối" });
    expect(reject).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Nhập ghi chú; bắt buộc khi từ chối"), {
      target: { value: "Sai thông tin" },
    });
    fireEvent.click(reject);
    expect(mocks.reject).not.toHaveBeenCalled();
    expect(screen.getByText("Xác nhận từ chối yêu cầu hoàn tiền?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận từ chối" }));
    await waitFor(() => expect(mocks.reject).toHaveBeenCalledWith(11, "Sai thông tin", "merchant-token"));
  });
  it("displays projected point debt and tier demotion in preview", async () => {
    mocks.get.mockResolvedValue({
      ...detail,
      preview: {
        ...detail.preview,
        walletAfter: { availablePoints: 0, netLifetimeEarned: "0.6", pointDebt: "0.4", fractionalCarry: "0" },
        tierBefore: "SILVER",
        tierAfter: "BRONZE",
      },
    });
    renderPage();
    await screen.findByText("Hàng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
    expect(await screen.findByText(/nợ 0\.4/)).toBeInTheDocument();
    expect(screen.getByText("SILVER")).toBeInTheDocument();
    expect(screen.getByText("BRONZE")).toBeInTheDocument();
  });

  it("routes legacy VNPay refunds to manual reconciliation without showing a completed refund preview", async () => {
    mocks.get.mockResolvedValue({
      ...detail,
      order: {
        ...detail.order,
        paymentProvider: "VNPAY",
        paymentProviderReference: "legacy-ref",
        paymentProviderTransactionNo: "provider-txn",
      },
    });
    mocks.approve.mockResolvedValue({
      refundRequest: { ...item, status: "PROCESSING" },
      manualReconciliationRequired: true,
      paymentProvenance: {
        provider: "VNPAY",
        providerReference: "legacy-ref",
        providerTransactionNo: "provider-txn",
      },
    });
    renderPage();
    await screen.findByText("Hàng lỗi");
    fireEvent.click(screen.getByRole("button", { name: "Xem & Duyệt" }));
    expect(await screen.findByText("Cần đối soát hoàn tiền thủ công")).toBeInTheDocument();
    expect(screen.getByText("legacy-ref")).toBeInTheDocument();
    expect(screen.getByText("provider-txn")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Tác động dự kiến" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chuyển đối soát" }));
    expect(screen.getByText(/chưa xác nhận hoàn tiền/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đối soát" }));
    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(11, "merchant-token", undefined));
  });

  it("records a failed provider reconciliation without completing the request and allows a later retry", async () => {
    mocks.get.mockResolvedValue({
      ...detail,
      refundRequest: { ...item, status: "PROCESSING" },
      order: { ...detail.order, paymentProvider: "VNPAY", paymentProviderReference: "order-ref" },
      reconciliationAttempts: [{ id: 1, providerReference: "refund-fail-1", providerTransactionNo: null, outcome: "FAILED", failureReason: "Bank rejected", createdAt: "2026-11-20T00:00:00Z" }],
    });
    mocks.reconcile.mockResolvedValue({
      refundRequest: { ...item, status: "PROCESSING" },
      reconciliationAttempt: { id: 2, providerReference: "refund-fail-2", providerTransactionNo: "txn-2", outcome: "FAILED", failureReason: "Declined", createdAt: "" },
      manualReconciliationRequired: true,
    });
    renderPage("/merchant/refund-requests?requestId=11");
    expect(await screen.findByText("Chưa ghi nhận kết quả từ nhà cung cấp")).toBeInTheDocument();
    expect(screen.getByText(/refund-fail-1/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Kết quả đối soát" }));
    const failureOptions = await screen.findAllByText("Nhà cung cấp báo thất bại");
    fireEvent.click(failureOptions[failureOptions.length - 1]);
    fireEvent.change(screen.getByRole("textbox", { name: "Mã giao dịch hoàn tiền" }), { target: { value: "refund-fail-2" } });
    const submit = screen.getByRole("button", { name: "Ghi nhận kết quả đối soát" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Lý do thất bại đối soát" }), { target: { value: "Declined" } });
    fireEvent.click(submit);
    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledWith(11, {
      outcome: "FAILED",
      providerReference: "refund-fail-2",
      providerTransactionNo: undefined,
      failureReason: "Declined",
    }, "merchant-token"));
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it("submits settlement evidence for a retry and completes only after provider confirmation", async () => {
    mocks.get.mockResolvedValue({
      ...detail,
      refundRequest: { ...item, status: "PROCESSING" },
      order: { ...detail.order, paymentProvider: "VNPAY", paymentProviderReference: "order-ref" },
      reconciliationAttempts: [{ id: 1, providerReference: "refund-fail-1", providerTransactionNo: null, outcome: "FAILED", failureReason: "Bank rejected", createdAt: "2026-11-20T00:00:00Z" }],
    });
    renderPage("/merchant/refund-requests?requestId=11");
    expect(await screen.findByText(/Bank rejected/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Mã giao dịch hoàn tiền" }), { target: { value: "refund-settled-2" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Mã tham chiếu giao dịch nhà cung cấp" }), { target: { value: "txn-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Ghi nhận kết quả đối soát" }));
    await waitFor(() => expect(mocks.reconcile).toHaveBeenCalledWith(11, {
      outcome: "SETTLED",
      providerReference: "refund-settled-2",
      providerTransactionNo: "txn-2",
      failureReason: undefined,
    }, "merchant-token"));
  });
});
