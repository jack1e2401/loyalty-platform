// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { MerchantStoreProfileForm } from "../../../../apps/frontend/src/features/merchant/MerchantStoreProfileForm";
import type { StoreProfileResponse } from "../../../../apps/frontend/src/api/storefront-types";

afterEach(cleanup);

const baseData: StoreProfileResponse = {
  merchant: { id: 1, name: "Cà Phê Mộc", slug: "ca-phe-moc", isActive: true },
  profile: {
    contactPhone: "0901234567",
    contactEmail: "hello@moc.vn",
    address: "12 Nguyễn Huệ",
    footerDescription: "Cà phê rang mộc",
    logoUrl: null,
    storeImageUrl: null,
    openingHours: null,
  },
  counts: { members: 12, monthlyOrders: 34, activeProducts: 8 },
};

describe("MerchantStoreProfileForm sticky bar & reset", () => {
  it("shows unsaved changes badge in sticky bar and resets draft on Hoàn tác", () => {
    render(
      <MemoryRouter>
        <MerchantStoreProfileForm data={baseData} token="test-token" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("region", { name: "Thanh lưu thông tin cửa hàng" })).toBeInTheDocument();
    expect(screen.getByText("Mọi thay đổi đã được lưu.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Hoàn tác" })).not.toBeInTheDocument();

    const nameInput = screen.getByLabelText("Tên cửa hàng");
    fireEvent.change(nameInput, { target: { value: "Cà Phê Mộc Mới" } });

    expect(screen.getByText("Có thay đổi chưa lưu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Hoàn tác" }));

    expect(nameInput).toHaveValue("Cà Phê Mộc");
    expect(screen.getByRole("status")).toHaveTextContent("Đã hoàn tác các thay đổi chưa lưu.");
    expect(screen.getByRole("button", { name: "Lưu thông tin" })).toBeDisabled();
  });

  it("renders Xem gian hàng link next to store path", () => {
    render(
      <MemoryRouter>
        <MerchantStoreProfileForm data={baseData} token="test-token" />
      </MemoryRouter>,
    );

    const previewLink = screen.getByRole("link", { name: /Xem gian hàng/i });
    expect(previewLink).toHaveAttribute("href", "/s/ca-phe-moc");
    expect(previewLink).toHaveAttribute("target", "_blank");
  });
});
