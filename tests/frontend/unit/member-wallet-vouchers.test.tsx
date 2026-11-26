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

import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { AuthSessionProvider } from "../../../apps/frontend/src/api/auth-session";
import { MemberVouchers, MemberWallet } from "../../../apps/frontend/src/features/member/MemberLoyaltyPages";

function MemberContextLayout({ merchantId }: { merchantId: number }) {
  return (
    <Outlet
      context={{
        merchantId,
        cart: {
          lines: [],
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
            <Route path="wallet" element={element} />
            <Route path="vouchers" element={element} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthSessionProvider>,
  );
}

describe("Member wallet & vouchers experience", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("generates an idempotency key per redemption action and retains it across retries until success", async () => {
    const definitions = [
      {
        id: 5,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 20k",
        pointsCost: 50,
        discountAmount: "20000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const initialWallet = {
      merchantId: 7,
      exactBalance: "200",
      availablePoints: 200,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "200",
      lifetimeEarnedPoints: 200,
      tier: "BRONZE" as const,
      policy: { merchantId: 7, vndPerPoint: 10000, isActive: true, tiers: [] },
      transactions: [],
    };
    const updatedWallet = {
      ...initialWallet,
      exactBalance: "150",
      availablePoints: 150,
      lifetimeEarnedPoints: 200,
    };
    const redeemedVoucher = {
      id: 101,
      definitionId: 5,
      merchantId: 7,
      memberId: 9,
      title: "Giảm 20k",
      type: "DISCOUNT" as const,
      status: "ACTIVE" as const,
      pointsCost: 50,
      discountAmount: "20000",
      rewardDescription: null,
      redeemedAt: "2026-11-11T12:00:00.000Z",
      usedAt: null,
    };

    const idempotencyKeysUsed: (string | null)[] = [];
    let attempt = 0;

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: attempt > 1 ? updatedWallet : initialWallet });
      }
      if (url.includes("/api/member/vouchers/5/redeem") && init?.method === "POST") {
        attempt++;
        const headers = new Headers(init.headers);
        idempotencyKeysUsed.push(headers.get("Idempotency-Key"));
        if (attempt === 1) {
          return Response.json({ error: "Temporary network timeout" }, { status: 500 });
        }
        return Response.json({
          voucher: { ...redeemedVoucher, id: 100 + attempt },
          wallet: { availablePoints: 150, lifetimeEarnedPoints: 200 },
        });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    await waitFor(() => {
      expect(screen.getByText("Giảm 20k")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /đổi voucher/i })).toBeInTheDocument();
    });

    const redeemButton = screen.getByRole("button", { name: /đổi voucher/i });
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    expect(idempotencyKeysUsed).toHaveLength(1);
    const firstKey = idempotencyKeysUsed[0];
    expect(firstKey).toBeTruthy();

    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(/đã đổi “giảm 20k”/i)).toBeInTheDocument();
    });

    expect(idempotencyKeysUsed).toHaveLength(2);
    expect(idempotencyKeysUsed[1]).toBe(firstKey);

    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(idempotencyKeysUsed).toHaveLength(3);
    });

    expect(idempotencyKeysUsed[2]).toBeTruthy();
    expect(idempotencyKeysUsed[2]).not.toBe(firstKey);
  });

  it("displays accessible voucher redeem button with distinct aria-label and disabled note when points are insufficient", async () => {
    const definitions = [
      {
        id: 8,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 50k",
        pointsCost: 500,
        discountAmount: "50000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const lowBalanceWallet = {
      merchantId: 7,
      exactBalance: "50",
      availablePoints: 50,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "50",
      lifetimeEarnedPoints: 50,
      tier: "BRONZE" as const,
      policy: { merchantId: 7, vndPerPoint: 10000, isActive: true, tiers: [] },
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: lowBalanceWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    await waitFor(() => {
      expect(screen.getByText("Giảm 50k")).toBeInTheDocument();
      const button = screen.getByRole("button", { name: /đổi voucher “giảm 50k”/i });
      expect(button).toBeDisabled();
      expect(screen.getByText("Chưa đủ điểm để đổi")).toBeInTheDocument();
    });
  });

  it("renders actionable empty state linking to storefront when MemberWallet has no transactions", async () => {
    const emptyWallet = {
      merchantId: 7,
      exactBalance: "0",
      availablePoints: 0,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "0",
      lifetimeEarnedPoints: 0,
      tier: "UNRANKED" as const,
      policy: null,
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: emptyWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/wallet", <MemberWallet />);

    await waitFor(() => {
      expect(screen.getByText("Chưa có giao dịch điểm")).toBeInTheDocument();
      const shopLink = screen.getByRole("link", { name: /khám phá gian hàng/i });
      expect(shopLink).toBeInTheDocument();
      expect(shopLink).toHaveAttribute("href", "/member/7");
    });
  });

  it("renders actionable empty state linking to catalog when member has no owned vouchers", async () => {
    const definitions = [
      {
        id: 12,
        merchantId: 7,
        type: "DISCOUNT" as const,
        title: "Giảm 15k",
        pointsCost: 30,
        discountAmount: "15000",
        rewardDescription: null,
        rewardProductId: null,
        status: "ACTIVE" as const,
      },
    ];
    const testWallet = {
      merchantId: 7,
      exactBalance: "100",
      availablePoints: 100,
      fractionalCarry: "0",
      pointDebt: "0",
      netLifetimeEarned: "100",
      lifetimeEarnedPoints: 100,
      tier: "BRONZE" as const,
      policy: null,
      transactions: [],
    };

    mockFetchHandler = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/merchants/7/vouchers")) {
        return Response.json({ definitions });
      }
      if (url.includes("/api/member/merchants/7/vouchers")) {
        return Response.json({ vouchers: [] });
      }
      if (url.includes("/api/member/merchants/7/wallet")) {
        return Response.json({ wallet: testWallet });
      }
      return Response.json({ error: "Not found" }, { status: 404 });
    });

    renderMemberPage("/member/7/vouchers", <MemberVouchers />);

    await waitFor(() => {
      expect(screen.getByText("Bạn chưa có voucher")).toBeInTheDocument();
      const actionLink = screen.getByRole("link", { name: /xem voucher có thể đổi/i });
      expect(actionLink).toBeInTheDocument();
      expect(actionLink).toHaveAttribute("href", "#store-vouchers");
    });
  });
});
