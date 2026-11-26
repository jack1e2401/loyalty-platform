# QUY CHUẨN GIAO DIỆN & TRẢI NGHIỆM NGUỜI DÙNG (UI/UX GUIDELINES)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/UI_UX_GUIDELINES.md`  
**Vai trò:** Single Source of Truth quy định tiêu chuẩn thiết kế giao diện, trải nghiệm người dùng (UX Principles), quy tắc hoạt ảnh (Rive/Motion), bảo vệ dữ liệu và chuẩn hóa màn hình cho 2 nhóm đối tượng: Khách hàng (Member / Zalo Mini App) và Đối tác/Thu ngân (Merchant / Store Manager / Cashier).

---

## 1. Triết Lý Thiết Kế: Giao Diện Tĩnh Lặng & Tập Trung (Visually Quiet & Focused)

Nền tảng IncomSG phục vụ các thao tác tài chính, tích điểm và vận hành bán lẻ nhanh chóng tại quầy. Mọi màn hình MUST tuân thủ:
- **Tối giản thị giác (Visually Quiet):** Tuyệt đối **KHÔNG** thêm các nhãn trang trí rườm rà (eyebrow labels), huy hiệu mốc không cần thiết, phụ đề trùng lặp hay văn bản giải thích mã nguồn vào giao diện người dùng.
- **Văn bản cô đọng & Có mục đích:** Chỉ giữ lại những câu chữ thực sự cần thiết để:
  1. Nhận diện thao tác người dùng.
  2. Giải thích lý do một quyết định nghiệp vụ (ví dụ: "Voucher chỉ áp dụng cho đồ uống").
  3. Thể hiện trạng thái: Đang tải (Loading), Trống (Empty), Lỗi (Error), Chờ xử lý (Pending), và Thành công (Success).
- **Tuyệt đối không hiển thị giao dịch chưa xác nhận:** Không bao giờ tính toán hoặc hiển thị giao dịch là "Đã hoàn thành" trên giao diện khi chưa nhận được phản hồi xác nhận từ backend.

---

## 2. Quy Chuẩn Thiết Kế Cho Từng Nhóm Đối Tượng

### 2.1. Trải nghiệm Khách hàng & Hội viên (Member Experience / Zalo Mini App)
- **Ngữ cảnh sử dụng:** Khách hàng dùng điện thoại cá nhân hoặc mở Zalo Mini App quét QR tại quầy Hikari Coffee.
- **Yêu cầu cốt lõi:**
  - Thiết kế tối ưu cho màn hình cảm ứng điện thoại (Touch-friendly, tối thiểu 44x44px cho nút bấm).
  - Tôn trọng vùng an toàn (Safe-area insets cho iOS và Zalo header/bottom bar).
  - Hiển thị trực quan **Thẻ Tích Tem (Stamp Card)**: Ví dụ lộ trình 5 tem (Khách thấy rõ đang có 1/5 tem; sau khi mua 3 ly latte + 2 bánh thấy cập nhật thành 4/5 tem; khi đủ 5 tem nhận ngay voucher quà tặng).
  - Mã QR Hội viên và Mã Barcode/QR của Voucher phải có độ tương phản cao, kích thước lớn để máy quét tại quầy đọc tức thì.
- **Quy tắc Hoạt ảnh (Rive Motion):**
  - **ĐƯỢC PHÉP** sử dụng hoạt ảnh Rive (`.riv`) độc quyền cho trải nghiệm Member (ví dụ: hiệu ứng đóng dấu tem, mở hộp quà voucher, pháo hoa thăng hạng thẻ).
  - Hoạt ảnh bắt buộc phải có phương án hiển thị tĩnh thay thế (Static Fallback) khi tải chậm hoặc lỗi.
  - Phải tự động vô hiệu hóa hoạt ảnh khi thiết bị người dùng bật chế độ giảm chuyển động (`prefers-reduced-motion`).

### 2.2. Trải nghiệm Đối tác & Thu ngân (Merchant CMS & Cashier Counter)
- **Ngữ cảnh sử dụng:** Nhân viên thu ngân tại quầy (máy POS hoặc tablet/laptop) và Quản lý cửa hàng kiểm soát vận hành.
- **Yêu cầu cốt lõi:**
  - **100% Giao diện Tĩnh (Static Artwork Only):** Tuyệt đối **KHÔNG** sử dụng hoạt ảnh Rive hay chuyển động phức tạp tại màn hình thu ngân và CMS.
  - **Thao tác quầy siêu tốc (Cashier Counter Flow):**
    1. Nhập số điện thoại hoặc quét QR tra cứu nhanh hội viên.
    2. Ghi nhận giỏ hàng (ví dụ: 3 latte + 2 bánh) và kiểm tra số tem được cấp.
    3. Nhập/quét mã voucher và bấm "Đổi quà" với phản hồi tức thì.
  - **Bảo đảm phạm vi chi nhánh (Branch Context):** Luôn hiển thị rõ ràng chỉ báo chi nhánh hiện tại (ví dụ: "Chi nhánh A - Hikari Trung Tâm" vs "Chi nhánh B"). Thu ngân không được phép nhầm lẫn chi nhánh khi thao tác.
  - **Chống bấm đúp (Double-click Prevention):** Mọi nút bấm tạo đơn, thanh toán hoặc đổi voucher phải bị vô hiệu hóa ngay khi click để chống ghi nhận trùng.

---

## 3. Quy Tắc Bắt Buộc: Modal Xác Nhận (Confirmation Modal)

Theo quy định tại `AGENTS.md` (Mục 5):

> **BẮT BUỘC:** Trước bất kỳ thao tác nào do người dùng kích hoạt nhằm tạo mới, cập nhật, xóa, đặt lại, xuất bản hoặc thay đổi dữ liệu nghiệp vụ đã lưu trữ (persisted business data), hệ thống MUST hiển thị một Modal xác nhận trong ứng dụng.

- **Nội dung Modal:** Phải giải thích rõ:
  - Đối tượng bị tác động (Target): Ví dụ "Đơn hàng #HK-1029" hoặc "Chính sách Loyalty v2".
  - Tác động thực tế (Material Effect): Ví dụ "Thao tác này sẽ hoàn trả 45.000đ cho khách và thu hồi 1 voucher chưa sử dụng".
- **Hành vi tương tác:**
  - Chỉ thực thi ghi dữ liệu khi người dùng bấm nút xác nhận rõ ràng trong Modal.
  - Thao tác Hủy (Cancel) hoặc Đóng modal (Dismiss) phải giữ nguyên 100% trạng thái dữ liệu, không có bất kỳ side-effect nào xảy ra.
- **Ngoại lệ:** Các thao tác điều hướng chỉ đọc (Read-only navigation), chuyển trang xem trước (Preview) hoặc chuyển tab không cần Modal xác nhận.

---

## 4. Xử Lý 4 Trạng Thái Giao Diện Tiêu Chuẩn (Standard UI States)

Mọi màn hình hoặc danh sách hiển thị dữ liệu MUST xử lý đủ 4 trạng thái:

1. **Loading State:** Hiển thị Ant Design `Skeleton` hoặc `Spin` nhẹ nhàng; không để layout bị giật/nhấp nháy khi tải dữ liệu.
2. **Empty State:** Hiển thị `Empty` component với câu chữ gợi ý hành động hữu ích (ví dụ: "Chưa có voucher nào trong ví. Hãy tích tem để đổi voucher đầu tiên!").
3. **Error State:** Hiển thị thông báo lỗi rõ ràng từ backend kèm nút "Thử lại" (Retry). Tuyệt đối không để màn hình trắng hoặc crash ứng dụng khi mất mạng.
4. **Success State:** Hiển thị dữ liệu xác thực từ backend. Đối với các hành động quan trọng (như đổi quà thành công), hiển thị thông báo phản hồi rõ ràng kèm số dư điểm/tem mới nhất.

---

## 5. Danh Sách Các Điều Cấm (Anti-patterns)

- ❌ **CẤM** hiển thị thông báo thành công hoặc số dư mới trước khi API backend trả về kết quả 200 OK.
- ❌ **CẤM** sử dụng dữ liệu mẫu (mock/seed ảo) cắm cứng trong các màn hình sản phẩm.
- ❌ **CẤM** đặt hoạt ảnh Rive trong màn hình CMS của Merchant hoặc quầy Thu ngân.
- ❌ **CẤM** bỏ qua Modal xác nhận đối với các nút xóa, hủy đơn, hoàn tiền hoặc xuất bản chính sách.
- ❌ **CẤM** tự ý sáng tác URL ảnh hoặc tài nguyên remote từ bên ngoài; chỉ tái sử dụng tài nguyên đã có trong dự án.
