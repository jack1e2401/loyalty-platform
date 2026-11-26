# QUY CHUẨN MÃ NGUỒN (CODE CONVENTIONS)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/code_conventions.md`  
**Vai trò:** Single Source of Truth cho các tiêu chuẩn lập trình React 19, TypeScript, Express, Prisma ORM, kiến trúc module nhỏ (SOLID) và an toàn tài chính trong monorepo IncomSG.

---

## 1. Mức độ Quy tắc (Rule Levels)

- **MUST (BẮT BỘC):** Quy chuẩn cốt lõi không thể vi phạm. Code vi phạm sẽ bị từ chối commit hoặc chặn trong CI.
- **SHOULD (KHUYẾN NGHỊ):** Tiêu chuẩn thiết kế tốt cần ưu tiên tuân thủ nhằm bảo đảm khả năng bảo trì.
- **MAY (TÙY CHỌN):** Hướng xử lý linh hoạt tùy ngữ cảnh cụ thể.

---

## 2. Kích thước Module & Nguyên tắc SOLID

### Bắt buộc (MUST)
- **Giới hạn dòng code:** Mỗi file mã nguồn thủ công mục tiêu **150 – 250 dòng**. Khi file vượt quá **300 dòng**, đây là tín hiệu bắt buộc phải tái cấu trúc (refactor signal).
- **Trách nhiệm đơn nhất (Single Responsibility):**
  - Frontend: Tách rõ Component giao diện, Custom Hook quản lý state/side-effects, và API helper.
  - Backend: Tách biệt rõ ràng giữa Transport/Route handler, Validation, Domain calculation, và Persistence/Prisma query.
- **Không trừu tượng hóa vội vã:** Giữ helper và sub-components gần feature sở hữu nó; không tạo tầng trừu tượng dùng chung nếu mới chỉ có 1 nơi sử dụng.

---

## 3. Quy chuẩn TypeScript & An Toàn Dữ Liệu

### Bắt buộc (MUST)
- **Chế độ nghiêm ngặt (Strict Mode):** Luôn tuân thủ `strict: true`.
- **CẤM tuyệt đối `any`:** Không sử dụng `any`. Khi dữ liệu chưa xác định rõ (ví dụ: payload bên thứ 3 hoặc JSON động), MUST dùng `unknown` kết hợp Zod schema hoặc Type Guards để thu hẹp kiểu.
- **Số học chính xác (Exact Arithmetic):**
  - Điểm thưởng (loyalty points), số tem, và số tiền (VND) MUST được mô hình hóa bằng `Prisma.Decimal`, chuỗi định dạng chính xác hoặc số nguyên.
  - KHÔNG BAO GIỜ dùng phép toán số thực nhị phân của JavaScript (`number` float) cho các phép tính số dư ví, điểm thưởng hay hoàn trả.
- **Type tường minh cho Props và Return Values:** Mọi React component và hàm nghiệp vụ backend quan trọng MUST khai báo kiểu trả về tường minh.

---

## 4. Quy chuẩn Frontend (React 19 & Ant Design)

### Bắt buộc (MUST)
- **100% Functional Components:** Sử dụng hoàn toàn React Hooks tiêu chuẩn.
- **Modal Xác nhận cho thao tác thay đổi dữ liệu (Confirmation Modal):**
  - Trước bất kỳ thao tác nào tạo mới, sửa, xóa, đặt lại, xuất bản hoặc thay đổi dữ liệu nghiệp vụ (ví dụ: hủy đơn, duyệt hoàn tiền, xuất bản chính sách, đổi voucher), MUST hiển thị Modal xác nhận rõ ràng tác động.
  - Chỉ thực thi ghi dữ liệu khi người dùng xác nhận rõ ràng; nếu hủy hoặc bấm ra ngoài, giữ nguyên hiện trạng.
- **Quy tắc về Chuyển động & Animation (Rive & Motion):**
  - Hoạt ảnh Rive (`.riv`) CHỈ ĐƯỢC PHÉP sử dụng trong trải nghiệm **Khách hàng/Hội viên (Member Portal / Zalo Mini App)** – ví dụ: đóng dấu thẻ tem (stamp animation), mở quà voucher.
  - Các màn hình Đối tác/Thu ngân (Merchant/Cashier) MUST sử dụng hình ảnh và giao diện tĩnh (Static Artwork).
  - Mọi hiệu ứng chuyển động MUST có phương án thay thế tĩnh (Static Fallback) và tôn trọng thiết lập `prefers-reduced-motion` của hệ điều hành.
- **Không tự bịa đặt dữ liệu (No Fake / Sample Commerce Data):**
  - Tuyệt đối không dùng dữ liệu mock tự chế trên các màn hình sản phẩm. Chỉ kết nối các endpoint API thực tế từ backend; ẩn hoặc vô hiệu hóa các nút nếu endpoint chưa khả dụng.

---

## 5. Quy chuẩn Backend (Express, Prisma, MySQL)

### Bắt buộc (MUST)
- **Validate dữ liệu đầu vào:** Mọi route nhận `body`, `query`, hoặc `params` MUST được validate bằng Zod schema trước khi chuyển sang tầng Service.
- **Giao dịch Cơ sở dữ liệu (Database Transactions):**
  - Mọi thao tác thay đổi số dư ví, cấp/trừ tem, đổi voucher, hoàn tiền hoặc xác nhận đơn hàng MUST được bọc trong `prisma.$transaction`.
- **Nguyên tử & Chống Race-condition (Atomic & Concurrency-safe):**
  - Khi thu ngân đổi voucher hoặc khách hàng nhận quà mốc thử thách, MUST sử dụng điều kiện cập nhật nguyên tử (ví dụ: `updateMany where status = 'ACTIVE'`) hoặc khóa dòng để ngăn việc 2 quầy quét cùng 1 voucher cùng lúc.
- **Ghi chép Sổ cái Kiểm toán (Auditable Ledger):**
  - Mọi thay đổi điểm hay tem đều phải sinh ra bản ghi Ledger tương ứng, lưu lại `memberId`, `merchantId`, `branchId`, `orderId`, `pointsDelta`, `balanceAfter`, `reason`.

---

## 6. Quy ước Đặt tên (Naming Conventions)

### 6.1. Quy ước chung
- **React Components & Files:** `PascalCase` (ví dụ: `MerchantOrdersQueue.tsx`, `CashierStampScanner.tsx`).
- **Prisma Models & Types:** `PascalCase` (ví dụ: `Order`, `OrderItem`, `MemberVoucher`, `Branch`).
- **Biến, Hàm, Routes, Services:** `camelCase` (ví dụ: `calculatePointsEarned`, `loyaltyService.ts`).
- **Custom Hooks:** Tiền tố `use` theo `camelCase` (ví dụ: `useStampCard`, `useBranchContext`).
- **Hằng số toàn cục:** `UPPER_SNAKE_CASE` (ví dụ: `MAX_STAMPS_PER_CARD = 5`).

### 6.2. Tiền tố Tên theo Nghiệp vụ (Domain-driven Prefixes)
- Các file hoặc component thuộc nhóm Hoàn tiền / Hoàn đơn MUST có tiền tố `Refund` (ví dụ: `RefundOrderModal.tsx`, `RefundRequestService.ts`).
- Các hàm / model giữ chỗ voucher hoặc đơn hàng MUST thể hiện rõ ngữ nghĩa (ví dụ: `voucherReservation` nếu chỉ giữ chỗ voucher; `orderHold` nếu giữ chỗ cả đơn).

---

## 7. Quy trình Kiểm tra trước khi Commit (Working Checklist)

Trước khi coi công việc hoàn thành và tạo commit:
1. Đọc lại `git status --short` để rà soát thay đổi.
2. Kiểm tra TypeScript:
   ```bash
   npm run typecheck
   ```
3. Chạy unit tests:
   ```bash
   npm test
   ```
4. Kiểm tra diff (`git diff`), đảm bảo không có console.log debug thừa, không có file nhạy cảm (`.env`, secrets).
