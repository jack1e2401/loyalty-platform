// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantCategoriesPanel } from "../../../../apps/frontend/src/features/merchant/MerchantCategoriesPanel";
import type { ProductCategoryDto } from "../../../../apps/frontend/src/api/commerce-types";

const { updateCategoryMock } = vi.hoisted(() => ({
  updateCategoryMock: vi.fn().mockResolvedValue({ category: {} }),
}));

vi.mock("../../../../apps/frontend/src/api/commerce-http", async () => {
  const actual = await vi.importActual<typeof import("../../../../apps/frontend/src/api/commerce-http")>(
    "../../../../apps/frontend/src/api/commerce-http",
  );
  return {
    ...actual,
    createCommerceClient: () => ({
      updateCategory: updateCategoryMock,
      createCategory: vi.fn(),
      deleteCategory: vi.fn(),
    }),
  };
});

afterEach(() => {
  cleanup();
  updateCategoryMock.mockClear();
});

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

  it("reorders categories via drag-and-drop and persists sortOrder updates", async () => {
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

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);

    const dataTransfer = {
      data: {} as Record<string, string>,
      effectAllowed: "move",
      dropEffect: "move",
      setData(key: string, value: string) { this.data[key] = value; },
      getData(key: string) { return this.data[key] ?? ""; },
    };

    fireEvent.dragStart(rows[1], { dataTransfer });
    fireEvent.dragOver(rows[0], { dataTransfer });
    fireEvent.drop(rows[0], { dataTransfer });

    await waitFor(() => {
      expect(updateCategoryMock).toHaveBeenCalledWith(2, { sortOrder: 1 }, "test-token");
      expect(updateCategoryMock).toHaveBeenCalledWith(1, { sortOrder: 2 }, "test-token");
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Đã cập nhật thứ tự danh mục.");
  });

  it("reorders categories via quick move-up button", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Đưa danh mục Cà phê lên" }));

    await waitFor(() => {
      expect(updateCategoryMock).toHaveBeenCalledWith(2, { sortOrder: 1 }, "test-token");
      expect(updateCategoryMock).toHaveBeenCalledWith(1, { sortOrder: 2 }, "test-token");
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });
});
