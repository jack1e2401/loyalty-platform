// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantPagination } from "../../../apps/frontend/src/features/merchant/cms/MerchantPagination";

describe("MerchantPagination", () => {
  afterEach(() => cleanup());
  it("shows the visible range and reports page and page-size changes", () => {
    const onChange = vi.fn();
    render(<MerchantPagination page={2} limit={20} totalItems={45} onChange={onChange} />);
    expect(screen.getByText("21–40 / 45")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trang 3" }));
    expect(onChange).toHaveBeenCalledWith(3, 20);
    fireEvent.change(screen.getByLabelText("Số dòng mỗi trang"), { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith(1, 50);
  });

  it("keeps navigation available when the requested page is empty", () => {
    const onChange = vi.fn();
    render(<MerchantPagination page={3} limit={20} totalItems={38} onChange={onChange} />);
    expect(screen.getByText("0–0 / 38")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Trước" }));
    expect(onChange).toHaveBeenCalledWith(2, 20);
  });
});
