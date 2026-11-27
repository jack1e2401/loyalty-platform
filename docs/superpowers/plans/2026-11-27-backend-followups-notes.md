# Ghi chú các hạng mục cần xử lý ở tầng Backend (Follow-ups)

> Tài liệu này ghi nhận các điểm cần tinh chỉnh ở tầng Backend trong các milestone tiếp theo (sau khi hoàn tất tối ưu giao diện Frontend).

## 1. Dọn dẹp tàn dư luồng VNPay (`OrderStatus.FAILED`)
- **Hiện trạng:** Luồng thanh toán trực tuyến VNPay đã được gỡ bỏ khỏi hệ thống. Tại Frontend ([`BackendMerchantOrdersPage.tsx`](file:///d:/.Learn/IncomSG/apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage.tsx)), tùy chọn lọc trạng thái `FAILED` đã được ẩn đi.
- **Cần làm ở Backend:**
  - Kiểm tra lại dữ liệu lịch sử trong bảng `Order` xem còn bản ghi nào mang trạng thái `FAILED` hay không trước khi migrate.
  - Cập nhật `orders.controller.ts` để bỏ `FAILED` khỏi danh sách `status` query parameter hợp lệ (hoặc giữ tương thích ngược tùy quyết định dữ liệu cũ).
  - Rà soát lại `enum OrderStatus` trong `apps/backend/prisma/schema.prisma` và các helper xử lý trạng thái nếu quyết định loại bỏ hoàn toàn `FAILED` khỏi schema.

## 2. API tổng hợp cho Dashboard Tổng quan (`/api/merchant/overview` hoặc mở rộng Analytics Summary)
- **Hiện trạng:** Trang Tổng quan ([`BackendMerchantOverviewPage.tsx`](file:///d:/.Learn/IncomSG/apps/frontend/src/features/merchant/backend/BackendMerchantOverviewPage.tsx)) đang phải gọi nhiều API song song ở Frontend để lấy đủ dữ liệu:
  1. `GET /api/merchant/me` (thông tin cửa hàng)
  2. `GET /api/merchant/analytics` (KPIs, chuỗi doanh thu, sản phẩm sắp hết hàng)
  3. `GET /api/merchant/orders?status=PENDING&limit=1` (đếm đơn chờ thanh toán)
  4. `GET /api/merchant/orders?limit=5` (5 đơn gần nhất)
  5. `GET /api/merchant/refund-requests?status=PENDING_MERCHANT&limit=1` (đếm yêu cầu hoàn tiền chờ duyệt)
  6. `GET /api/merchant/rewards` (tải danh sách quà để đếm số lượng chờ trao)
- **Cần làm ở Backend:**
  - Tạo một endpoint tổng hợp nhẹ (ví dụ `GET /api/merchant/overview` hoặc bổ sung `actionQueue` counts vào `/api/merchant/analytics?summary=1`) trả về các biến đếm (`pendingOrdersCount`, `pendingRefundsCount`, `pendingRewardsCount`, `lowStockCount`) bằng câu lệnh `COUNT(*)` trực tiếp trên MySQL.
  - Việc này giúp giảm số lượng HTTP requests khi tải trang Tổng quan từ 6-7 requests xuống còn 1-2 requests và tránh tải toàn bộ danh sách `rewards` chỉ để đếm số quà chờ trao.

## 3. Chỉ số Loyalty tổng hợp trên Dashboard
- **Cần làm ở Backend:**
  - Bổ sung vào `AnalyticsKpisDto` các chỉ số về sức khỏe chương trình Loyalty theo kỳ (ví dụ: tổng điểm đã phát hành trong kỳ, tổng điểm đã quy đổi/đổi quà trong kỳ, số voucher đã sử dụng) để merchant theo dõi hiệu quả giữ chân khách hàng ngay trên Tổng quan.

## 4. Tối ưu API cho tab Đơn hàng & Quà đổi thưởng
- **Hiện trạng:** Tab Đơn hàng ([`BackendMerchantOrdersPage.tsx`](file:///d:/.Learn/IncomSG/apps/frontend/src/features/merchant/backend/BackendMerchantOrdersPage.tsx)) và Quà đổi thưởng ([`MerchantRewardQueue.tsx`](file:///d:/.Learn/IncomSG/apps/frontend/src/features/merchant/MerchantRewardQueue.tsx)) đã được nâng cấp UX ở Frontend, nhưng một số tính năng cần dữ liệu tổng hợp từ server.
- **Cần làm ở Backend:**
  - **Đếm số đơn theo từng trạng thái toàn cục:** `GET /api/merchant/orders` trả thêm `statusCounts` (`PENDING`, `PAID`, `REFUND_PENDING`, `REFUNDED`, `CANCELLED`) để hiển thị badge số lượng ngay trên bộ lọc nhanh.
  - **Bộ lọc khoảng ngày & sắp xếp phía server:** Hỗ trợ query `from`, `to` (theo ngày tạo/thanh toán) và `sortBy` / `sortOrder` trên `GET /api/merchant/orders`.
  - **Xuất CSV danh sách đơn:** Hỗ trợ endpoint hoặc query xuất CSV theo bộ lọc hiện tại.
  - **Thông tin thành viên trong Quà đổi thưởng:** `GET /api/merchant/rewards` trả kèm `memberEmail` / `memberName` (hoặc hỗ trợ tìm kiếm server-side + phân trang) để merchant đối chiếu nhanh khi khách tới nhận quà tại quầy.
