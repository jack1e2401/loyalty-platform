# HƯỚNG DẪN KIỂM THỬ (TESTING GUIDE)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/testing.md`  
**Vai trò:** Single Source of Truth quy định chiến lược kiểm thử, cấu trúc các tầng test, tiêu chuẩn viết Unit/Integration test, kiểm thử đồng thời (Concurrency) và phương pháp xác thực trên trình duyệt cho IncomSG.

---

## 1. Khung Kiểm Thử & Điều Phối (Testing Stack & Orchestration)

Nền tảng IncomSG sử dụng **Vitest** làm công cụ kiểm thử cốt lõi cho cả Frontend và Backend:

| Loại Kiểm thử | Vị trí Thư mục | Môi trường / Công cụ | Mục tiêu & Thời gian thực thi |
| :--- | :--- | :--- | :--- |
| **Backend Unit** | `tests/backend/unit/modules/` | Vitest (In-Memory, No DB) | Kiểm tra công thức điểm, quy tắc chính sách, validation (~2.5s). |
| **Frontend Unit** | `tests/frontend/unit/<domain>/` | Vitest + React Testing Library (JSDOM) | Kiểm tra component UI, tương tác form, loading/error states. |
| **Backend Integration** | `tests/backend/integration/<domain>/` | Vitest + MySQL Test Database | Kiểm tra giao dịch `prisma.$transaction`, khoá đồng thời, tính toàn vẹn dữ liệu. |
| **Browser E2E / Flow** | Trình duyệt thực tế (Orca) / `tests/frontend/e2e/` | Orca Browser (chính) / Playwright (phụ) | Kiểm thử trực quan toàn luồng từ quét QR Zalo tới đổi voucher tại quầy. |

---

## 2. Các Lệnh Chạy Test Tiêu Chuẩn

Tất cả lệnh chạy từ thư mục gốc của repository (`d:\.Learn\IncomSG`):

```bash
# 1. Chạy toàn bộ Unit Tests (Backend chạy trước cho phản hồi nhanh, sau đó tới Frontend)
npm test

# 2. Chạy riêng Unit Test Backend
npm run test:backend

# 3. Chạy riêng Unit Test Frontend
npm run test:frontend

# 4. Chạy Integration Tests với MySQL Local (yêu cầu MySQL đang chạy và đã migrate)
npm run test:db

# 5. Chạy kiểm tra kiểu dữ liệu toàn bộ monorepo
npm run typecheck
```

---

## 3. Nguyên Tắc Cốt Lõi Khi Viết Test trong IncomSG

### 3.1. Vị trí Đặt File Test (Centralized Domain Organization)
- **Tuyệt đối không để lẫn file test trong `apps/`**: Mọi file test phải nằm trong thư mục `tests/` theo đúng domain nghiệp vụ tương ứng:
  - Frontend: `tests/frontend/unit/<domain>/<feature>.test.tsx`
  - Backend Unit: `tests/backend/unit/modules/<domain>/<module>.test.ts`
  - Backend Integration: `tests/backend/integration/<domain>/<feature>.integration.test.ts`
- **Không đặt tên chứa tiền tố tạm bợ**: Tuyệt đối không dùng tên file dạng `v4-*` hay `milestone*.test.ts`. Phải đặt tên phản ánh đúng hành vi nghiệp vụ (ví dụ: `order-payment-concurrency.integration.test.ts`).

### 3.2. Kiểm thử Số học Điểm Thưởng & Tiền tệ (Exact Decimal Assertions)
- **CẤM** sử dụng hàm so sánh xấp xỉ dấu phẩy động (`toBeCloseTo`) cho số tiền VND hoặc điểm thưởng loyalty.
- Luôn kiểm tra giá trị chính xác dạng chuỗi hoặc so sánh thông qua hàm `Decimal.equals`:
  ```typescript
  // ✅ Đúng (Chính xác tuyệt đối)
  expect(memberWallet.pointsBalance.toString()).toBe("125.50");
  expect(order.finalAmount.toString()).toBe("185000");

  // ❌ Sai (Dễ gây sai số làm tròn trong tài chính)
  expect(Number(memberWallet.pointsBalance)).toBeCloseTo(125.5);
  ```

### 3.3. Kiểm thử Tính Bất Khả Lặp (Idempotency Testing)
Mọi endpoint tài chính hoặc đổi voucher MUST có test case gửi lặp 2 lần cùng một `x-idempotency-key`:
- Lần 1: Thực thi thành công, tạo giao dịch ledger, trả về 200.
- Lần 2: Trả về cùng kết quả thành công, **nhưng số dư ví và trạng thái voucher không bị thay đổi lần thứ hai**.

### 3.4. Kiểm thử Xung đột Đồng thời (Concurrency Testing)
Đối với kịch bản đổi voucher hoặc mốc thưởng:
- Viết test case mô phỏng 2 request đổi cùng một mã voucher được gửi song song (`Promise.all([redeem(code), redeem(code)])`).
- Khẳng định: **Đúng 1 request thành công**, request còn lại phải thất bại với lỗi `409 Conflict` hoặc `VOUCHER_ALREADY_USED`.

### 3.5. Quy định Độ dài File Test
- Mỗi file test thủ công hướng tới **$\le 250$ dòng**. Nếu test case quá dài do chứa nhiều fixtures, hãy tách dữ liệu mẫu sang file `<feature>.fixtures.ts` trong cùng thư mục domain.

---

## 4. Phương Pháp Xác Thực Trực Quan (Orca Browser First)

Theo quy định tại `AGENTS.md` (Mục 6):
1. **Ưu tiên hàng đầu**: Sử dụng năng lực điều khiển trình duyệt của Orca để tương tác trực tiếp trên giao diện frontend đang chạy thật, kết nối với backend và MySQL test local.
2. Kiểm tra trực quan từ góc độ người dùng thực tế:
   - Đăng nhập theo đúng vai trò (`OWNER`, `STORE_MANAGER`, `CASHIER`, hoặc `MEMBER`).
   - Thao tác happy path và ít nhất 1 ca lỗi/phân quyền.
   - Xác minh số dư ví, tem tích lũy và bảng Ledger trong DB sau khi reload trang.
3. Chỉ sử dụng Playwright (`npm run test:e2e`) làm giải pháp kiểm thử thứ cấp/dự phòng khi môi trường không có sẵn Orca browser control.
