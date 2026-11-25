// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../apps/frontend/src/api/commerce-http")>();
  return {
    ...actual,
    createCommerceClient: (baseUrl: string, fetcher?: typeof fetch) => {
      return actual.createCommerceClient(baseUrl, (input, init) => {
        if (mockFetchHandler) return mockFetchHandler(input, init);
        return (fetcher ?? fetch)(input, init);
      });
    },
  };
});

import { cleanup, render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MerchantLoyalty } from "../../../apps/frontend/src/features/merchant/backend/BackendMerchantLoyaltyPage";
import { MerchantOrders } from "../../../apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage";

function renderMerchantPage(initialEntry: string, element: React.ReactNode) {
  const sessionData = JSON.stringify({
    accessToken: "merchant-jwt-token",
    user: { id: 2, email: "merchant@test.local", role: "MERCHANT", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/merchant/loyalty/*" element={element} />
          <Route path="/merchant/orders" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("M7 Merchant Experience", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("prioritizes purchases, filters them by member and opens rewards separately", async () => {
    const order = { id: 847, merchantId: 7, memberId: 9, memberEmail: "lan@example.test", status: "PAID", subtotal: "6000", discountAmount: "0", total: "6000", paidAt: null, items: [], earnedPointsExact: null };
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) return Response.json({ orders: [order] });
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });
    renderMerchantPage("/merchant/orders", <MerchantOrders />);
    expect(await screen.findByRole("link", { name: "#847" })).toBeInTheDocument();
    expect(screen.queryByText("Không có quà tặng trong danh sách này.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tìm đơn hàng"), { target: { value: "khong-co" } });
    expect(screen.queryByRole("link", { name: "#847" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tìm đơn hàng"), { target: { value: "lan@example" } });
    expect(screen.getByRole("link", { name: "#847" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Quà đổi thưởng"));
    expect(await screen.findByText("Không có quà tặng trong danh sách này.")).toBeInTheDocument();
  });

  it("renders loyalty policy change warning and formula preview in MerchantLoyalty", async () => {
    const config = {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      tiers: [
        { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
        { level: "SILVER", minLifetimePoints: 100, multiplier: "1.25" },
      ],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/loyalty") && (!init || init.method === "GET")) {
        return Response.json({ config });
      }
      if (url.includes("/api/merchant/loyalty/preview") && init?.method === "POST") {
        return Response.json({
          netOrderAmountVnd: "50000",
          tierLevel: "SILVER",
          multiplier: "1.25",
          vndPerPoint: 10000,
          active: true,
          estimatedPointsExact: "6.250000000000",
          integerProjection: 6,
          fractionalProjection: "0.250000000000",
          rounding: "HALF_UP",
          scale: 12,
        });
      }
      if (url.includes("/api/merchant/loyalty/transactions")) {
        return Response.json({ items: [], nextCursor: null });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty/config?mode=edit", <MerchantLoyalty />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Chương trình" })).toBeInTheDocument();
      expect(screen.getByText(/lưu ý: thay đổi tỷ lệ hoặc hạng/i)).toBeInTheDocument();
    });

    // Check formula preview inputs
    const amountInput = screen.getByLabelText(/số tiền đơn hàng thử nghiệm/i);
    fireEvent.change(amountInput, { target: { value: "50000" } });

    const previewButton = screen.getByRole("button", { name: /tính thử điểm/i });
    fireEvent.click(previewButton);

    await waitFor(() => {
      expect(screen.getByText("6.250000000000")).toBeInTheDocument();
    });

    // The formula explains that fractional points carry forward.
    expect(screen.queryByText(/làm tròn xuống/i)).not.toBeInTheDocument();
    expect(screen.getByText(/điểm lẻ được cộng dồn/i)).toBeInTheDocument();
  });

  it("requires confirmation before publishing a changed policy or running a tier reset", async () => {
    const config = {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      qualificationMode: "POINTS",
      reset: { enabled: true, month: 1, day: 1, strategy: "ONE_DOWN", targetLevel: null },
      tiers: [
        { level: "default", name: "Default", minLifetimePoints: 0, multiplier: "1.00", benefits: [], iconUrl: null, color: "#647a69", maintenanceSpendVnd: null, sortOrder: 0, isActive: true },
        { level: "silver", name: "Silver", minLifetimePoints: 100, multiplier: "1.25", benefits: [], iconUrl: null, color: "#8A949D", maintenanceSpendVnd: null, sortOrder: 1, isActive: true },
      ],
    };
    const writes: string[] = [];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/merchant/loyalty/history")) return Response.json({ versions: [] });
      if (url.endsWith("/api/merchant/loyalty") && init?.method === "PUT") {
        writes.push(`${init.method} ${url}`);
        return Response.json({ config: { ...config, vndPerPoint: 5000 } });
      }
      if (url.endsWith("/api/merchant/loyalty/tier-reset/run") && init?.method === "POST") {
        writes.push(`${init.method} ${url}`);
        return Response.json({ cycleYear: 2026, processedCount: 1, alreadyProcessed: false });
      }
      if (url.endsWith("/api/merchant/loyalty") && (!init || init.method === "GET")) return Response.json({ config });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty/config?mode=edit", <MerchantLoyalty />);
    expect(await screen.findByLabelText("VND cho mỗi điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset hạng" }));
    fireEvent.click(screen.getByRole("button", { name: "Chạy reset đến hạn" }));
    expect(screen.getByText(/Ví điểm và lịch sử giao dịch được giữ nguyên/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(writes).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Chạy reset đến hạn" }));
    fireEvent.click(screen.getByRole("button", { name: "Chạy reset" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toContain("POST http://localhost:3000/api/merchant/loyalty/tier-reset/run");

    fireEvent.click(screen.getByRole("button", { name: "Chương trình" }));
    fireEvent.change(screen.getByLabelText("VND cho mỗi điểm"), { target: { value: "5000" } });
    const navigationAlert = vi.spyOn(window, "alert").mockImplementation(() => {});
    fireEvent.click(screen.getByRole("link", { name: "Quay lại chính sách điểm" }));
    expect(navigationAlert).toHaveBeenCalledWith("Vui lòng lưu cấu hình trước khi rời trang.");
    expect(screen.getByLabelText("VND cho mỗi điểm")).toHaveValue(5000);
    fireEvent.click(await screen.findByRole("button", { name: "Lưu cấu hình" }));
    expect(await screen.findByText(/sẽ được lưu thành một phiên bản chính sách mới/i)).toBeInTheDocument();
    expect(writes).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Phát hành phiên bản mới" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toContain("PUT http://localhost:3000/api/merchant/loyalty");
    expect(await screen.findByRole("heading", { name: "Lịch sử phiên bản" })).toBeInTheDocument();
  });

  it("redirects the bare config route and publishes an unchanged new-policy draft as a new version", async () => {
    const config = { merchantId: 7, vndPerPoint: 10000, isActive: true, qualificationMode: "POINTS", reset: { enabled: false, month: 1, day: 1, strategy: "ONE_DOWN", targetLevel: null }, tiers: [{ level: "default", name: "Default", minLifetimePoints: 0, multiplier: "1.00", benefits: [], iconUrl: null, color: "#647a69", maintenanceSpendVnd: null, sortOrder: 0, isActive: true }] };
    let publishedBody: Record<string, unknown> | null = null;
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/merchant/loyalty/history")) return Response.json({ versions: [] });
      if (url.endsWith("/api/merchant/loyalty") && init?.method === "PUT") {
        publishedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return Response.json({ config });
      }
      if (url.endsWith("/api/merchant/loyalty") && (!init || init.method === "GET")) return Response.json({ config });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty/config", <MerchantLoyalty />);
    expect(await screen.findByRole("heading", { name: "Lịch sử phiên bản" })).toBeInTheDocument();
    cleanup();
    renderMerchantPage("/merchant/loyalty/config?mode=new", <MerchantLoyalty />);
    expect(await screen.findByRole("heading", { name: "Tạo chính sách mới" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }));
    fireEvent.click(screen.getByRole("button", { name: "Phát hành phiên bản mới" }));
    await waitFor(() => expect(publishedBody?.publishAsNewVersion).toBe(true));
  });

  it("displays exact fractional earned points in MerchantOrders rather than rounding down to 0", async () => {
    const orders = [
      {
        id: 99,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "6000",
        discountAmount: "0",
        total: "6000",
        paidAt: "2026-11-12T00:00:00.000Z",
        items: [{ productId: 1, productName: "Trà", unitPrice: "6000", quantity: 1, lineTotal: "6000" }],
        earnedPoints: 0,
        earnedPointsExact: "0.6",
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders });
      }
      if (url.includes("/api/merchant/rewards")) {
        return Response.json({ rewards: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });
    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("+0.6 điểm")).toBeInTheDocument();
      expect(screen.queryByText("+0 điểm")).not.toBeInTheDocument();
    });
  });

  it("restores the selected order detail from the existing orderId query", async () => {
    const order = {
      id: 77,
      merchantId: 7,
      memberId: 9,
      memberEmail: "member@test.local",
      status: "PAID",
      subtotal: "100000",
      discountAmount: "0",
      total: "100000",
      paidAt: "2026-11-10T10:00:00.000Z",
      items: [{ productId: 1, productName: "Sản phẩm A", unitPrice: "100000", quantity: 1, lineTotal: "100000" }],
      earnedPoints: 10,
      earnedPointsExact: "10.0",
      actions: { canCancel: false, canRefund: true },
    };
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders/77")) return Response.json({ order });
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders?orderId=77", <MerchantOrders />);

    expect(await screen.findByRole("heading", { name: "Đơn #77" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại đơn hàng" })).toHaveAttribute("href", "/merchant/orders");
    expect(screen.getByText("Sản phẩm A")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Xử lý yêu cầu hoàn tiền" })).not.toBeInTheDocument();
  });

  it("links paid orders to the merchant refund review queue", async () => {
    const orders = [
      {
        id: 77,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "100000",
        discountAmount: "0",
        total: "100000",
        paidAt: "2026-11-10T10:00:00.000Z",
        items: [
          { productId: 1, productName: "Sản phẩm A", unitPrice: "100000", quantity: 1, lineTotal: "100000" },
        ],
        earnedPoints: 10,
        earnedPointsExact: "10.0",
        refundStatus: null,
        refundRequest: { id: 5, status: "PENDING_MERCHANT" },
        actions: { canCancel: false, canRefund: true },
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders") && (!init || init.method === "GET")) {
        return Response.json({ orders });
      }
      if (url.includes("/api/merchant/rewards")) {
        return Response.json({ rewards: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => {
      expect(screen.getByText("#77")).toBeInTheDocument();
      expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    });

    const refundLink = screen.getByRole("link", { name: /xử lý yêu cầu hoàn tiền/i });
    expect(refundLink).toHaveAttribute("href", "/merchant/refund-requests?requestId=5");
  });

  it("allows merchant to cancel unfulfilled reward voucher with reason", async () => {
    const rewards = [
      {
        id: 15,
        definitionId: 5,
        merchantId: 7,
        memberId: 9,
        title: "Bình giữ nhiệt",
        type: "REWARD",
        status: "AVAILABLE",
        pointsCost: 50,
        discountAmount: null,
        rewardDescription: "Bình giữ nhiệt 500ml",
        redeemedAt: "2026-11-10T10:00:00.000Z",
        usedAt: null,
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders: [] });
      }
      if (url.includes("/api/merchant/rewards") && (!init || init.method === "GET")) {
        return Response.json({ rewards });
      }
      if (url.includes("/api/merchant/rewards/15/cancel") && init?.method === "POST") {
        return Response.json({
          reward: {
            ...rewards[0],
            status: "CANCELLED",
            cancelledAt: "2026-11-11T12:00:00.000Z",
            cancelledById: 2,
            cancellationReason: "Hết quà tặng trong kho",
          },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);
    fireEvent.click(screen.getByText("Quà đổi thưởng"));

    await waitFor(() => {
      expect(screen.getByText("Bình giữ nhiệt")).toBeInTheDocument();
      expect(screen.getByText("Chờ trao")).toBeInTheDocument();
    });

    const cancelRewardBtn = screen.getByRole("button", { name: /hủy quà/i });
    fireEvent.click(cancelRewardBtn);

    await waitFor(() => {
      expect(screen.getByText(/lý do hủy quà/i)).toBeInTheDocument();
    });

    const reasonInput = screen.getByLabelText(/lý do hủy quà/i);
    fireEvent.change(reasonInput, { target: { value: "Hết quà tặng trong kho" } });

    const confirmCancelBtn = screen.getByRole("button", { name: /xác nhận hủy quà/i });
    fireEvent.click(confirmCancelBtn);

    await waitFor(() => {
      expect(screen.getByText(/đã hủy trao “bình giữ nhiệt”/i)).toBeInTheDocument();
      expect(screen.getByText("Lý do: Hết quà tặng trong kho")).toBeInTheDocument();
      expect(screen.getByText("Người xử lý #2")).toBeInTheDocument();
    });
  });

  it("filters and displays loyalty transactions in MerchantLoyalty ledger tab", async () => {
    const config = {
      merchantId: 7,
      vndPerPoint: 10000,
      isActive: true,
      tiers: [{ level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" }],
    };

    const txItem = {
      id: 101,
      eventRef: "EVT-EARN-101",
      type: "EARN",
      delta: "0.800000000000",
      balanceAfter: "24.800000000000",
      availablePointsAfter: 24,
      fractionalCarryAfter: "0.800000000000",
      pointDebtAfter: "0",
      reason: "Tích điểm đơn hàng #77",
      source: "MOCK_PAYMENT",
      actorId: null,
      orderId: 77,
      memberVoucherId: null,
      createdAt: "2026-11-10T10:00:00.000Z",
      memberId: 9,
      memberEmail: "member@test.local",
    };
    const nextTxItem = {
      ...txItem,
      id: 102,
      eventRef: "EVT-EARN-102",
      delta: "1.000000000000",
      balanceAfter: "25.800000000000",
      availablePointsAfter: 25,
      fractionalCarryAfter: "0.800000000000",
      reason: "Tích điểm đơn hàng #78",
      orderId: 78,
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/loyalty/transactions")) {
        return url.includes("cursor=next")
          ? Response.json({ items: [nextTxItem], nextCursor: null })
          : Response.json({ items: [txItem], nextCursor: "next" });
      }
      if (url.includes("/api/merchant/loyalty") && (!init || init.method === "GET")) {
        return Response.json({ config });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/loyalty/transactions", <MerchantLoyalty />);

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Sổ giao dịch điểm" })).toBeInTheDocument();
    });

    const ledger = await screen.findByRole("table", { name: "Sổ giao dịch điểm" });
    const firstRow = within(ledger).getByRole("row", { name: /#101/ });
    expect(within(firstRow).getByText("+0.800000000000")).toBeInTheDocument();
    fireEvent.click(within(firstRow).getByRole("button", { name: "Chi tiết" }));
    const detail = within(await screen.findByRole("dialog"));
    expect(detail.getByText("EVT-EARN-101")).toBeInTheDocument();
    expect(detail.getByText(/Tích điểm đơn hàng #77/)).toBeInTheDocument();
    expect(detail.getByText("Điểm khả dụng").nextElementSibling).toHaveTextContent("24");
    expect(detail.getByText("Điểm lẻ").nextElementSibling).toHaveTextContent("0.800000000000");
    expect(detail.getByText("Nợ điểm").nextElementSibling).toHaveTextContent("0");
    expect(detail.getByRole("link", { name: "Đơn hàng #77" })).toHaveAttribute(
      "href",
      "/merchant/orders?orderId=77",
    );
    fireEvent.click(detail.getByRole("button", { name: "Đóng" }));

    fireEvent.click(screen.getByRole("button", { name: /xem thêm giao dịch/i }));

    await waitFor(() => {
      expect(within(ledger).getByRole("row", { name: /#101/ })).toBeInTheDocument();
      expect(within(ledger).getByRole("row", { name: /#102/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /xem thêm giao dịch/i })).not.toBeInTheDocument();
    });

    // Test search filter inputs
    const memberIdInput = screen.getByLabelText(/id thành viên/i);
    fireEvent.change(memberIdInput, { target: { value: "9" } });

    const searchBtn = screen.getByRole("button", { name: /tìm kiếm/i });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockFetchHandler).toHaveBeenCalledWith(expect.stringContaining("memberId=9"), expect.anything());
    });
  });

  it("does not infer merchant refund permission when backend actions are missing", async () => {
    const orders = [
      {
        id: 79,
        merchantId: 7,
        memberId: 9,
        memberEmail: "member@test.local",
        status: "PAID",
        subtotal: "100000",
        discountAmount: "0",
        total: "100000",
        paidAt: "2026-11-10T10:00:00.000Z",
        items: [
          {
            productId: 1,
            productName: "Sản phẩm C",
            unitPrice: "100000",
            quantity: 1,
            lineTotal: "100000",
          },
        ],
        earnedPoints: 10,
        earnedPointsExact: "10",
      },
    ];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) return Response.json({ orders });
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);

    await waitFor(() => expect(screen.getByText("#79")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^hoàn tiền$/i })).not.toBeInTheDocument();
  });

  it("fulfills a pending reward voucher with optional note", async () => {
    const rewards = [
      {
        id: 16,
        definitionId: 5,
        merchantId: 7,
        memberId: 9,
        title: "Áo thun kỷ niệm",
        type: "REWARD",
        status: "PENDING_FULFILLMENT",
        pointsCost: 30,
        discountAmount: null,
        rewardDescription: "Áo thun size L",
        redeemedAt: "2026-11-10T10:00:00.000Z",
        usedAt: null,
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchant/orders")) {
        return Response.json({ orders: [] });
      }
      if (url.includes("/api/merchant/rewards/16/fulfill") && init?.method === "POST") {
        return Response.json({
          reward: {
            ...rewards[0],
            status: "FULFILLED",
            fulfilledAt: "2026-11-11T13:00:00.000Z",
            fulfilledById: 2,
            note: "Trao quà tại quầy",
          },
        });
      }
      if (url.includes("/api/merchant/rewards") && (!init || init.method === "GET")) {
        return Response.json({ rewards });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMerchantPage("/merchant/orders", <MerchantOrders />);
    fireEvent.click(screen.getByText("Quà đổi thưởng"));

    await waitFor(() => {
      expect(screen.getByText("Áo thun kỷ niệm")).toBeInTheDocument();
      expect(screen.getByText("Chờ trao")).toBeInTheDocument();
    });

    const noteInput = screen.getByLabelText(/ghi chú trao quà/i);
    fireEvent.change(noteInput, { target: { value: "Trao quà tại quầy" } });

    const fulfillBtn = screen.getByRole("button", { name: /xác nhận đã trao/i });
    fireEvent.click(fulfillBtn);

    await waitFor(() => {
      expect(screen.getByText(/đã xác nhận trao “áo thun kỷ niệm”/i)).toBeInTheDocument();
      expect(screen.getByText("Người xác nhận #2")).toBeInTheDocument();
      expect(screen.getByText("Ghi chú: Trao quà tại quầy")).toBeInTheDocument();
    });
  });

});
