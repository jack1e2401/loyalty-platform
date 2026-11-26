// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  products: vi.fn(),
}));

vi.mock("../../../../apps/frontend/src/features/merchant/merchant-page-support", () => ({
  useToken: () => "merchant-token",
  message: (error: unknown) => error instanceof Error ? error.message : "Lỗi",
  api: {
    listMerchantVoucherDefinitions: mocks.list,
    createVoucherDefinition: mocks.create,
    updateVoucherDefinition: mocks.update,
    listOwnProducts: mocks.products,
  },
}));

import { MerchantVouchers } from "../../../../apps/frontend/src/features/merchant/backend/BackendMerchantVouchersPage";

const voucher = {
  id: 7, merchantId: 1, title: "Giảm 20.000đ", type: "DISCOUNT",
  pointsCost: 150, discountAmount: "20000", rewardDescription: null,
  rewardProductId: null, isActive: true, availableQuantity: 2, issuedQuantity: 3,
};

describe("merchant voucher list", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("shows filters and asks the server for the selected type and search", async () => {
    mocks.list.mockResolvedValue({
      definitions: [voucher],
      counts: { all: 2, discount: 1, reward: 1 },
      pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
    });
    render(<MemoryRouter><MerchantVouchers /></MemoryRouter>);
    expect(await screen.findByRole("table", { name: "Danh sách voucher" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Giảm giá (1)" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3 lượt")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Giảm giá (1)" }));
    fireEvent.change(screen.getByLabelText("Tìm kiếm tên voucher"), { target: { value: "Giảm" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "active" } });
    await waitFor(() => expect(mocks.list).toHaveBeenLastCalledWith("merchant-token", expect.objectContaining({
      page: 1, limit: 20, q: "Giảm", type: "DISCOUNT", status: "active",
    })));
  });

  it("creates a voucher only after the confirmation dialog", async () => {
    mocks.list.mockResolvedValue({ definitions: [], counts: { all: 0, discount: 0, reward: 0 }, pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 } });
    mocks.create.mockResolvedValue({ definition: voucher });
    render(<MemoryRouter><MerchantVouchers /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "+ Tạo voucher" }));
    const formDialog = screen.getByRole("dialog", { name: "Tạo voucher" });
    fireEvent.change(within(formDialog).getByLabelText("Loại voucher"), { target: { value: "DISCOUNT" } });
    fireEvent.change(within(formDialog).getByLabelText("Tên voucher"), { target: { value: "Giảm 20.000đ" } });
    fireEvent.change(within(formDialog).getByLabelText("Điểm cần đổi"), { target: { value: "150" } });
    fireEvent.change(within(formDialog).getByLabelText("Số tiền giảm (VND)"), { target: { value: "20000" } });
    fireEvent.click(within(formDialog).getByRole("button", { name: "Tạo voucher" }));
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      type: "DISCOUNT", title: "Giảm 20.000đ", pointsCost: 150, discountAmount: "20000",
    }), "merchant-token"));
  });
});
