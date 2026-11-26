// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockFetchHandler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

vi.mock("../../../../apps/frontend/src/api/commerce-http", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../apps/frontend/src/api/commerce-http")>();
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

import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../../apps/frontend/src/api/auth-session";
import { MerchantOrders } from "../../../../apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage";

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
          <Route path="/merchant/orders" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Merchant Orders & Rewards Queue", () => {
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
      if (url.includes("/api/merchant/orders")) {
        const query = new URL(url).searchParams.get("q") ?? "";
        const orders = !query || order.memberEmail.includes(query) ? [order] : [];
        return Response.json({ orders, pagination: { page: 1, limit: 20, totalItems: orders.length, totalPages: orders.length } });
      }
      if (url.includes("/api/merchant/rewards")) return Response.json({ rewards: [] });
      return Response.json({ error: "Not found" }, { status: 404 });
    });
    renderMerchantPage("/merchant/orders", <MerchantOrders />);
    expect(await screen.findByRole("link", { name: "#847" })).toBeInTheDocument();
    expect(screen.queryByText("Không có quà tặng trong danh sách này.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tìm đơn hàng"), { target: { value: "khong-co" } });
    await waitFor(() => expect(screen.queryByRole("link", { name: "#847" })).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Tìm đơn hàng"), { target: { value: "lan@example" } });
    expect(await screen.findByRole("link", { name: "#847" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Quà đổi thưởng"));
    expect(await screen.findByText("Không có quà tặng trong danh sách này.")).toBeInTheDocument();
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
