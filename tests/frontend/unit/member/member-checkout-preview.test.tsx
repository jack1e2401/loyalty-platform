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
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../../apps/frontend/src/api/auth-session";
import { MemberOrderResult } from "../../../../apps/frontend/src/features/member/MemberOrderResult";
import { MemberCheckout } from "../../../../apps/frontend/src/features/member/MemberCartPages";
import type { OrderDto } from "../../../../apps/frontend/src/api/commerce-types";

function MemberContextLayout({ merchantId, cartLines = [] }: { merchantId: number; cartLines?: any[] }) {
  return (
    <Outlet
      context={{
        merchantId,
        cart: {
          lines: cartLines,
          subtotal: cartLines.reduce((acc, l) => acc + BigInt(l.product.price) * BigInt(l.quantity), 0n),
          quantity: cartLines.reduce((acc, l) => acc + l.quantity, 0),
          clear: vi.fn(),
          removeProduct: vi.fn(),
          setQuantity: vi.fn(),
        },
      }}
    />
  );
}

function renderMemberPage(initialEntry: string, element: React.ReactNode, cartLines: any[] = []) {
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
            element={<MemberContextLayout merchantId={7} cartLines={cartLines} />}
          >
            <Route path="orders/:orderId" element={element} />
            <Route path="checkout" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Member checkout & payment flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders order cancellation flow when backend allows canCancel", async () => {
    const pendingOrder: OrderDto = {
      id: 42,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "30000",
      discountAmount: "0",
      total: "30000",
      paidAt: null,
      items: [
        { productId: 1, productName: "Cà phê sữa", unitPrice: "30000", quantity: 1, lineTotal: "30000" },
      ],
      earnedPointsExact: null,
      refundStatus: null,
      actions: { canCancel: true, canRefund: false },
    };

    const cancelledOrder: OrderDto = {
      ...pendingOrder,
      status: "CANCELLED",
      actions: { canCancel: false, canRefund: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/member/orders/42") && (!init || init.method === "GET")) {
        return Response.json({ order: pendingOrder });
      }
      if (url.includes("/api/orders/42/cancel") && init?.method === "POST") {
        return Response.json({
          order: cancelledOrder,
          voucherReleased: false,
          capacityReleasedExact: "0",
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/42", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #42")).toBeInTheDocument();
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: /hủy đơn/i });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    const confirmDialog = await screen.findByRole("dialog");
    expect(confirmDialog).toBeInTheDocument();

    const confirmButton = await screen.findByRole("button", { name: /xác nhận hủy/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText("Đơn hàng đã được hủy.")).toBeInTheDocument();
      expect(screen.getByText("Đã hủy")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /hủy đơn/i })).not.toBeInTheDocument();
  });

  it("does not render cancel button when order.actions is missing or canCancel is false even if status is PENDING", async () => {
    const unCancellableOrder: OrderDto = {
      id: 43,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "20000",
      discountAmount: "0",
      total: "20000",
      paidAt: null,
      items: [],
      earnedPointsExact: null,
      refundStatus: null,
      actions: { canCancel: false, canRefund: false },
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/orders/43")) {
        return Response.json({ order: unCancellableOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/43", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #43")).toBeInTheDocument();
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /hủy đơn/i })).not.toBeInTheDocument();
  });

  it("displays earning preview in checkout using stable preview calls without re-fetching on stable net amount", async () => {
    const cartLines = [
      {
        product: { id: 10, name: "Cà phê phin", price: "40000", kind: "SALE", status: "ACTIVE" },
        quantity: 2,
      },
    ];

    let previewCalls = 0;
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/loyalty/preview") && init?.method === "POST") {
        previewCalls++;
        return Response.json({
          merchantId: 7,
          active: true,
          netOrderAmountVnd: "80000",
          tierLevel: "BRONZE",
          multiplier: "1.00",
          vndPerPoint: 10000,
          estimatedPointsExact: "8.0",
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/checkout", <MemberCheckout />, cartLines);

    await waitFor(() => {
      expect(screen.getByText(/ước tính tích lũy/i)).toBeInTheDocument();
      expect(screen.getByText(/\+8\.0 điểm/i)).toBeInTheDocument();
    });

    expect(previewCalls).toBe(1);
  });

  it("uses mock payment and confirms from the backend order response", async () => {
    const pendingOrder: OrderDto = {
      id: 88,
      merchantId: 7,
      memberId: 9,
      status: "PENDING",
      subtotal: "40000",
      discountAmount: "0",
      total: "40000",
      paidAt: null,
      items: [{ productId: 2, productName: "Trà đào", unitPrice: "40000", quantity: 1, lineTotal: "40000" }],
      earnedPointsExact: null,
      refundStatus: null,
      actions: { canCancel: false, canRefund: false },
    };

    const paidOrder: OrderDto = {
      ...pendingOrder,
      status: "PAID",
      paidAt: "2026-11-10T10:00:00.000Z",
      earnedPointsExact: "3.5",
    };
    const requests: Array<{ url: string; method: string }> = [];
    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      requests.push({ url, method });
      if (url.includes("/api/member/orders/88") && method === "GET") {
        return Response.json({ order: pendingOrder });
      }
      if (url.includes("/api/orders/88/pay") && method === "POST") {
        return Response.json({ order: paidOrder });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/orders/88", <MemberOrderResult />);

    await waitFor(() => {
      expect(screen.getByText("Đơn #88")).toBeInTheDocument();
    });

    const mockPayButton = screen.getByRole("button", { name: /thanh toán \(mô phỏng\)/i });
    expect(mockPayButton).toBeInTheDocument();

    fireEvent.click(mockPayButton);

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đã được máy chủ xác nhận.")).toBeInTheDocument();
      expect(screen.getByText("Bạn vừa nhận +3.5 điểm")).toBeInTheDocument();
    });
    expect(requests).toContainEqual(expect.objectContaining({ url: expect.stringContaining("/api/orders/88/pay"), method: "POST" }));
  });
});
