// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CmsCard } from "../../../../apps/frontend/src/features/merchant/cms/CmsCard";
import { CmsConfirmAction } from "../../../../apps/frontend/src/features/merchant/cms/CmsConfirmAction";
import { CmsDataTable } from "../../../../apps/frontend/src/features/merchant/cms/CmsDataTable";
import { CmsPageHeader } from "../../../../apps/frontend/src/features/merchant/cms/CmsPageHeader";
import { CmsPageShell } from "../../../../apps/frontend/src/features/merchant/cms/CmsPageShell";
import { CmsStatCard } from "../../../../apps/frontend/src/features/merchant/cms/CmsStatCard";
import { CmsStatusTag } from "../../../../apps/frontend/src/features/merchant/cms/CmsStatusTag";
import { MerchantCmsProvider } from "../../../../apps/frontend/src/features/merchant/cms/merchantCmsTheme";

afterEach(cleanup);

describe("Merchant CMS components", () => {
  it("applies theme tokens only when the Merchant provider is enabled", () => {
    const { rerender, container } = render(
      <MerchantCmsProvider enabled={false}><span>Member content</span></MerchantCmsProvider>,
    );
    expect(container.querySelector(".merchant-cms")).not.toBeInTheDocument();

    rerender(<MerchantCmsProvider><span>Merchant content</span></MerchantCmsProvider>);
    expect(container.querySelector(".merchant-cms")).toHaveTextContent("Merchant content");
  });

  it("renders a named table with backend rows and an explicit empty state", () => {
    const columns = [{ title: "Tên", dataIndex: "name", key: "name" }];
    const { rerender } = render(
      <CmsDataTable label="Sản phẩm" rows={[{ id: 1, name: "Trà xanh" }]} columns={columns} rowKey="id" />,
    );
    expect(screen.getByRole("table", { name: "Sản phẩm" })).toBeInTheDocument();
    expect(screen.getByText("Trà xanh")).toBeInTheDocument();

    rerender(<CmsDataTable label="Sản phẩm" rows={[]} columns={columns} rowKey="id" />);
    expect(screen.getByText("Không có dữ liệu")).toBeInTheDocument();
  });

  it("shows a stat card and semantic status without inventing their values", () => {
    render(<><CmsStatCard label="Đơn đã thanh toán" value="—" /><CmsStatusTag label="Đang xử lý" tone="warning" /></>);
    expect(screen.getByText("Đơn đã thanh toán")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
  });

  it("waits for explicit confirmation before invoking an action", async () => {
    const onConfirm = vi.fn();
    render(
      <CmsConfirmAction title="Xóa mục?" description="Không thể khôi phục." onConfirm={onConfirm} destructive>
        <button type="button">Xóa</button>
      </CmsConfirmAction>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("uses the shared CMS page title pattern", () => {
    render(<CmsPageHeader title="Danh mục sản phẩm" description="Quản lý danh mục." />);
    expect(screen.getByRole("heading", { name: "Danh mục sản phẩm" })).toBeInTheDocument();
    expect(screen.getByText("Quản lý danh mục.")).toBeInTheDocument();
  });

  it("renders CmsPageShell with header, stats, filters, and body", () => {
    render(
      <CmsPageShell
        title="Quản lý Voucher"
        description="Danh sách các mã ưu đãi."
        stats={<div data-testid="stats">Thống kê voucher</div>}
        filters={<div data-testid="filters">Bộ lọc tìm kiếm</div>}
      >
        <div data-testid="content">Bảng danh sách voucher</div>
      </CmsPageShell>,
    );
    expect(screen.getByRole("heading", { name: "Quản lý Voucher" })).toBeInTheDocument();
    expect(screen.getByText("Danh sách các mã ưu đãi.")).toBeInTheDocument();
    expect(screen.getByTestId("stats")).toBeInTheDocument();
    expect(screen.getByTestId("filters")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders loading and error states in CmsPageShell", () => {
    const { rerender } = render(
      <CmsPageShell title="Báo cáo" loading>
        <div>Dữ liệu</div>
      </CmsPageShell>,
    );
    expect(screen.getByText("Đang tải dữ liệu...")).toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu")).not.toBeInTheDocument();

    rerender(
      <CmsPageShell title="Báo cáo" error="Lỗi tải dữ liệu">
        <div>Dữ liệu</div>
      </CmsPageShell>,
    );
    expect(screen.getByText("Lỗi tải dữ liệu")).toBeInTheDocument();
    expect(screen.queryByText("Dữ liệu")).not.toBeInTheDocument();
  });

  it("renders CmsCard with title, description, and children", () => {
    render(
      <CmsCard title="Cấu hình tích điểm" description="Tỉ lệ quy đổi VNĐ sang điểm">
        <p>10.000đ = 1 điểm</p>
      </CmsCard>,
    );
    expect(screen.getByText("Cấu hình tích điểm")).toBeInTheDocument();
    expect(screen.getByText("Tỉ lệ quy đổi VNĐ sang điểm")).toBeInTheDocument();
    expect(screen.getByText("10.000đ = 1 điểm")).toBeInTheDocument();
  });
});
