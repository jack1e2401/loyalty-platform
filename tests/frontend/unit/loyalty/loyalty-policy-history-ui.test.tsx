// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MerchantLoyaltyHistory } from "../../../../apps/frontend/src/features/merchant/MerchantLoyaltyHistory";
import { OrderLoyaltyPolicySnapshot } from "../../../../apps/frontend/src/features/orders/OrderLoyaltyPolicySnapshot";
import type { MerchantLoyaltyPolicyVersionDto, AppliedLoyaltyPolicySnapshot } from "../../../../apps/frontend/src/api/commerce-types";

const tiers: MerchantLoyaltyPolicyVersionDto["tiers"] = [
  { level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00", color: "#647a69" },
  { level: "SILVER", minLifetimePoints: 100, multiplier: "1.10", color: "#8A949D" },
  { level: "GOLD", minLifetimePoints: 500, multiplier: "1.25", color: "#C6912D" },
  { level: "PLATINUM", minLifetimePoints: 1000, multiplier: "1.50", color: "#5B6F8D" },
];

describe("loyalty policy history UI", () => {
  afterEach(() => cleanup());

  it("shows published versions with publisher, rate, thresholds, and multipliers", () => {
    render(
      <MemoryRouter>
        <MerchantLoyaltyHistory
          versions={[
          {
            id: 42,
            version: 3,
            vndPerPoint: 10000,
            isActive: true,
            qualificationMode: "POINTS",
            reset: { enabled: true, month: 1, day: 1, strategy: "ONE_DOWN", targetLevel: null },
            tiers,
            publishedAt: "2026-11-12T09:30:00.000Z",
            publishedById: 7,
            publishedByEmail: "owner@test.local",
            source: "MERCHANT_PUBLISH",
            isCurrent: true,
          },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Chính sách v3" })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("Hiện hành")).toBeTruthy();
    expect(screen.getByText(/10.000 ₫ = 1 điểm/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Tạo chính sách mới" }).getAttribute("href")).toBe("/merchant/loyalty/config?mode=new");
    expect(screen.getByText(/SILVER/)).toBeTruthy();
    expect(screen.getByText(/1.10/)).toBeTruthy();
    expect(screen.getByText(/Điểm tích lũy/)).toBeTruthy();
    expect(screen.getByText(/Giảm một hạng/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Chỉnh sửa chính sách" }).getAttribute("href")).toBe("/merchant/loyalty/config?mode=edit&version=3");
    fireEvent.click(screen.getByRole("button", { name: "Xem chi tiết v3" }));
    expect(within(screen.getByRole("dialog")).getByText(/owner@test.local/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Đóng" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps previous versions read-only and explains when legacy settings were not saved", () => {
    render(
      <MemoryRouter>
        <MerchantLoyaltyHistory
          versions={[
          { id: 2, version: 2, vndPerPoint: 5000, isActive: true, qualificationMode: "POINTS", reset: { enabled: false, month: 1, day: 1, strategy: "ONE_DOWN", targetLevel: null }, tiers, publishedAt: "2026-11-12T09:30:00.000Z", publishedById: 7, publishedByEmail: "owner@test.local", source: "MERCHANT_PUBLISH", isCurrent: true },
          { id: 1, version: 1, vndPerPoint: 10000, isActive: true, qualificationMode: null, reset: null, tiers, publishedAt: "2026-10-12T09:30:00.000Z", publishedById: null, publishedByEmail: null, source: "LEGACY_BACKFILL", isCurrent: false },
          ]}
        />
      </MemoryRouter>,
    );

    const oldVersionButton = screen.getByRole("button", { name: "Xem chi tiết v1" });
    fireEvent.click(oldVersionButton);
    expect(screen.getAllByText("Không được lưu trong phiên bản này").length).toBeGreaterThan(0);
    expect(within(screen.getByRole("dialog")).queryByRole("link", { name: "Chỉnh sửa chính sách" })).toBeNull();
    const threshold = within(screen.getByRole("dialog")).getByText(/100 điểm · loại xét hạng chưa lưu/);
    const multiplier = within(screen.getByRole("dialog")).getByText(/×1.10/);
    expect(threshold).toBeTruthy();
    expect(multiplier).toBeTruthy();
  });

  it("shows the policy snapshot applied to an order", () => {
    render(
      <OrderLoyaltyPolicySnapshot
        policy={{
          policyVersionId: 42,
          version: 3,
          publishedAt: "2026-11-12T09:30:00.000Z",
          vndPerPoint: 10000,
          isActive: false,
          tierLevel: "GOLD",
          multiplier: "1.25",
          tiers,
          capturedAt: "2026-11-12T09:30:00.000Z",
        } satisfies AppliedLoyaltyPolicySnapshot}
      />,
    );

    expect(screen.getByText(/Chính sách áp dụng · phiên bản 3/)).toBeTruthy();
    expect(screen.getAllByText(/GOLD/)).toHaveLength(2);
    expect(screen.getAllByText(/1.25/)).toHaveLength(2);
    expect(screen.getByText(/10.000 VND/)).toBeTruthy();
    expect(screen.getByText(/PLATINUM/)).toBeTruthy();
  });

  it("marks orders without a policy snapshot as legacy and unavailable", () => {
    render(<OrderLoyaltyPolicySnapshot policy={null} />);

    expect(screen.getByText(/Đơn hàng cũ/)).toBeTruthy();
    expect(screen.getByText(/không có bản chụp chính sách loyalty/)).toBeTruthy();
    expect(screen.queryByText(/phiên bản hiện tại/i)).toBeNull();
  });
});
