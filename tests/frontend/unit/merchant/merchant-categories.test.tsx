// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantCategoriesPanel } from "../../../../apps/frontend/src/features/merchant/MerchantCategoriesPanel";
import type { ProductCategoryDto } from "../../../../apps/frontend/src/api/commerce-types";

afterEach(cleanup);

const sampleCategories: ProductCategoryDto[] = [
  { id: 1, merchantId: 1, name: "Trà sữa", slug: "tra-sua", description: "Các loại trà sữa", sortOrder: 1 },
  { id: 2, merchantId: 1, name: "Cà phê", slug: "ca-phe", description: "Cà phê rang xay", sortOrder: 2 },
];

describe("MerchantCategoriesPanel", () => {
  it("filters categories by name or slug and supports resetting and reloading", () => {
    const onChanged = vi.fn();
    render(
      <MerchantCategoriesPanel
        token="test-token"
        categories={sampleCategories}
        loading={false}
        error={null}
        onChanged={onChanged}
      />,
    );

    expect(screen.getByText("Trà sữa")).toBeInTheDocument();
    expect(screen.getByText("Cà phê")).toBeInTheDocument();
    expect(screen.getByText("2 danh mục")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Tìm danh mục");
    fireEvent.change(searchInput, { target: { value: "ca-phe" } });

    expect(screen.queryByText("Trà sữa")).not.toBeInTheDocument();
    expect(screen.getByText("Cà phê")).toBeInTheDocument();
    expect(screen.getByText("Hiển thị 1 / 2 danh mục")).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "khong-ton-tai" } });
    expect(screen.getByText("Không tìm thấy danh mục phù hợp.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(screen.getByText("Trà sữa")).toBeInTheDocument();
    expect(screen.getByText("Cà phê")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Làm mới/i }));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
