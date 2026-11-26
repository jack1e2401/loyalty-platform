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

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MemberOrderResult } from "../../../apps/frontend/src/features/member/MemberOrderResult";
import { MemberOrders } from "../../../apps/frontend/src/features/member/MemberOrderPages";
import type { OrderDto } from "../../../apps/frontend/src/api/commerce-types";

function MemberContextLayout({ merchantId, cartLines = [] }: { merchantId: number; cartLines?: any[] }) {
  return (
    <Outlet
      context={{
        merchantId,
        cart: {
          lines: cartLines,
          subtotal: 0n,
          quantity: 0,
          clear: vi.fn(),
          removeProduct: vi.fn(),
          setQuantity: vi.fn(),
        },
      }}
    />
  );
}

function renderMemberPage(initialEntry: string, element: React.ReactNode) {
  const sessionData = JSON.stringify({
    accessToken: "member-jwt-token",
    user: { id: 9, email: "member@test.local", role: "MEMBER", isActive: true },
  });
  sessionStorage.setItem("loyalty.m2.session", sessionData);
  sessionStorage.setItem("loyalty.auth.session", sessionData);

  return render(
    <AuthSessionProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/member/:merchantId"
            element={<MemberContextLayout merchantId={7} />}
          >
            <Route path="orders" element={element} />
            <Route path="orders/:orderId" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Member orders history & audit", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders loyalty events audit including EARN_REVERSAL on MemberOrderResult", async () => {
    const refundedOrder = {
      id: 55,
      merchantId: 7,
      memberId: 9,
      status: "REFUNDED" as const,
      subtotal: "50000",
      discountAmount: "0",
      total: "50000",
      paidAt: "2026-11-10T10:00:00.000Z",
      items: [{ productId: 1, productName: "Espresso", unitPrice: "50000", quantity: 1, lineTotal: "50000" }],
      earnedPointsExact: "5.0",
      refundStatus: "COMPLETED" as const,
      refundReason: "Khách trả hàng tại quầy",
      loyaltyEvents: [
        {
          id: 1,
          eventRef: "evt_earn_55",
          type: "EARN",
          delta: "5.0",
          balanceAfter: "5.0",
          availablePointsAfter: 5,
          fractionalCarryAfter: "0.0",
          pointDebtAfter: "0",
          orderId: 55,
          memberVoucherId: null,
          reason: "Tích điểm đơn hàng #55",
          source: "MOCK_PAYMENT",
          actorId: null,
          createdAt: "2026-11-10T10:00:00.000Z",
        },
        {
          id: 2,
          eventRef: "evt_rev_55",
          type: "EARN_REVERSAL",
          delta: "-5.0",
          balanceAfter: "0.0",
          availablePointsAfter: 0,
          fractionalCarryAfter: "0.0",
          pointDebtAfter: "0",
          orderId: 55,
          memberVoucherId: null,
          reason: "Thu hồi tích điểm do hoàn tiền đơn hàng #55",
          source: "MERCHANT_REFUND",
          actorId: 2,
          createdAt: "2026-11-11T09:00:00.000Z",
        },
      ],
      actions: { canCancel: false, canRefund: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/55")) {
        return Response.json({ order: refundedOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/55", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #55")).toBeInTheDocument();
      expect(screen.getByText("Đã hoàn tiền")).toBeInTheDocument();
      expect(screen.getByText("Tích điểm đơn hàng #55")).toBeInTheDocument();
      expect(screen.getByText("Thu hồi tích điểm do hoàn tiền đơn hàng #55")).toBeInTheDocument();
      expect(screen.getByText("-5.0")).toBeInTheDocument();
    });
  });

  it("renders empty state with an actionable shopping link when member has no orders", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders") && url.includes("merchantId=7")) {
        return Response.json({ orders: [] });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders", <MemberOrders />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có đơn hàng")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /mua sắm ngay/i })).toHaveAttribute("href", "/member/7");
    });
  });

  it("renders actionable empty state when order does not belong to the current merchant", async () => {
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/99")) {
        return Response.json({
          order: {
            id: 99,
            merchantId: 99,
            memberId: 9,
            status: "PAID",
            subtotal: "50000",
            discountAmount: "0",
            total: "50000",
            paidAt: "2026-11-10T10:00:00.000Z",
            items: [],
            earnedPointsExact: "5",
          },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/99", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Chưa khả dụng")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /xem danh sách đơn hàng/i })).toHaveAttribute(
        "href",
        "/member/7/orders",
      );
    });
  });

  it("renders accessible next action buttons for viewing wallet on REFUND_PENDING orders", async () => {
    const refundPendingOrder: OrderDto = {
      id: 60,
      merchantId: 7,
      memberId: 9,
      status: "REFUND_PENDING",
      subtotal: "35000",
      discountAmount: "0",
      total: "35000",
      paidAt: "2026-11-10T08:00:00.000Z",
      items: [
        { productId: 3, productName: "Nước ép cam", unitPrice: "35000", quantity: 1, lineTotal: "35000" },
      ],
      earnedPointsExact: "3.5",
      refundStatus: "PENDING_PROVIDER",
      actions: { canCancel: false, canRefund: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/60")) {
        return Response.json({ order: refundPendingOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/60", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #60")).toBeInTheDocument();
      expect(screen.getByText("Đang xử lý hoàn tiền")).toBeInTheDocument();
      const walletLink = screen.getByRole("link", { name: /xem ví điểm/i });
      expect(walletLink).toHaveAttribute("href", "/member/7/wallet");
    });
  });

  it("renders distinct accessible aria-labels on order detail links in MemberOrders", async () => {
    const orderList: OrderDto[] = [
      {
        id: 101,
        merchantId: 7,
        memberId: 9,
        status: "PAID",
        subtotal: "50000",
        discountAmount: "0",
        total: "50000",
        paidAt: "2026-11-10T08:00:00.000Z",
        items: [
          { productId: 1, productName: "Bánh mì", unitPrice: "50000", quantity: 1, lineTotal: "50000" },
        ],
        earnedPointsExact: "5",
        refundStatus: null,
        actions: { canCancel: false, canRefund: false },
      },
      {
        id: 102,
        merchantId: 7,
        memberId: 9,
        status: "PENDING",
        subtotal: "30000",
        discountAmount: "0",
        total: "30000",
        paidAt: null,
        items: [{ productId: 2, productName: "Cà phê", unitPrice: "30000", quantity: 1, lineTotal: "30000" }],
        earnedPointsExact: null,
        refundStatus: null,
        actions: { canCancel: false, canRefund: false },
      },
    ];

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders") && url.includes("merchantId=7")) {
        return Response.json({ orders: orderList });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders", <MemberOrders />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #101")).toBeInTheDocument();
      expect(screen.getByText("Đơn #102")).toBeInTheDocument();
    });

    const link101 = screen.getByRole("link", { name: "Chi tiết đơn hàng #101" });
    const link102 = screen.getByRole("link", { name: "Chi tiết đơn hàng #102" });
    expect(link101).toHaveAttribute("href", "/member/7/orders/101");
    expect(link102).toHaveAttribute("href", "/member/7/orders/102");
  });
});
