# CHUẨN TƯƠNG TÁC API (API CONVENTIONS)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/API_CONVENTIONS.md`  
**Vai trò:** Single Source of Truth quy định cấu trúc thiết kế API, quản lý HTTP Client, định dạng Request/Response, Idempotency, xác thực và xử lý lỗi cho toàn bộ nền tảng IncomSG (Backend Express + Frontend Monorepo).

---

## 1. Mô hình Kiến trúc Tương tác API

Toàn bộ tương tác giữa Frontend (Member, Merchant, Admin, Zalo Mini App) và Backend Express API được phân tầng nghiêm ngặt:

```text
React Component / Custom Hook (apps/frontend/src/features/<domain>/)
         │
         ▼
Feature API Module (apps/frontend/src/features/<domain>/api.ts)
         │
         ▼
Core HTTP Client (apps/frontend/src/lib/api-client.ts)
         │  (Gắn JWT Token, Branch ID, Idempotency Key)
         ▼
Express HTTP Router (apps/backend/src/modules/<domain>/<domain>.routes.ts)
         │
         ▼
Auth & RBAC & Branch Middleware (apps/backend/src/middleware/)
         │
         ▼
Domain Controller & Service (apps/backend/src/modules/<domain>/)
         │
         ▼
Prisma ORM & MySQL Transaction (apps/backend/src/lib/prisma.ts)
```

---

## 2. Chuẩn Thiết kế RESTful Endpoints & Phân quyền

### 2.1. Phân nhóm Route theo vai trò (Role-based Scoping)
- `/api/v1/auth/*`: Đăng nhập, đăng ký, refresh session, logout.
- `/api/v1/member/*`: Tra cứu thẻ thành viên, số tem (stamp card), ví voucher, lịch sử tích điểm, đổi thưởng.
- `/api/v1/merchant/*`: Quản lý danh mục sản phẩm, cấu hình chính sách điểm/tem, duyệt hoàn đơn, xem báo cáo chi nhánh.
- `/api/v1/cashier/*` (hoặc `/api/v1/merchant/counter/*`): Thao tác quầy thu ngân (ghi nhận đơn, đếm ly latte/bánh, tra cứu hội viên, quét và đổi voucher theo chi nhánh).
- `/api/v1/admin/*`: Quản trị hệ thống, phê duyệt merchant, quản lý cấu hình toàn sàn.

### 2.2. Chi nhánh & Merchant Context Headers
- `Authorization: Bearer <access_token>`: Bắt buộc cho mọi route yêu cầu xác thực.
- `x-branch-id: <branch_uuid>`: Bắt buộc đối với các thao tác của Thu ngân (Cashier) và Quản lý cửa hàng (Store Manager) để ghi nhận đơn hàng và đổi voucher đúng phạm vi chi nhánh (ví dụ: Chi nhánh A vs Chi nhánh B).
- `x-idempotency-key: <unique_uuid>`: Bắt buộc đối với các thao tác thay đổi số dư tài chính, điểm thưởng, cấp/đổi voucher, hoàn tiền hoặc xác nhận thanh toán.

---

## 3. Định dạng Request & Response Chuẩn

### 3.1. Success Response Structure
Mọi phản hồi thành công từ Backend MUST tuân theo envelope chuẩn:

```typescript
export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    totalItems?: number;
    totalPages?: number;
  };
}
```

### 3.2. Error Response Structure
Mọi phản hồi lỗi MUST trả về HTTP status code phù hợp ($4xx, 5xx$) kèm mã lỗi định danh và thông điệp hành động được:

```typescript
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;        // Ví dụ: "INSUFFICIENT_POINTS", "VOUCHER_ALREADY_REDEEMED", "INVALID_BRANCH"
    message: string;     // Thông điệp tiếng Việt thân thiện với người dùng
    details?: unknown;   // Chi tiết lỗi validation (nếu có)
  };
}
```

### 3.3. Xử lý Dữ liệu Tiền tệ và Điểm thưởng (Decimal Integrity)
- **Quy tắc tuyệt đối:** Giá trị tiền (VND) và điểm loyalty có phần thập phân **KHÔNG BAO GIỜ** được truyền hoặc tính toán dưới dạng số thực dấu phẩy động (binary float).
- Backend serialize các trường tiền tệ / điểm từ Prisma `Decimal` thành chuỗi số chính xác (ví dụ: `"50000.00"`, `"12.5"`) hoặc số nguyên VND.
- Frontend hiển thị định dạng qua helper chính xác (ví dụ `formatCurrencyVND`, `formatPoints`).

---

## 4. Idempotency & Concurrency trong Loyalty/Commerce

### 4.1. Nguyên tắc Bắt buộc (MUST)
Các nghiệp vụ sau đây **bắt buộc phải có Idempotency Key**:
1. Xác nhận thanh toán đơn hàng (Payment Confirmation).
2. Tích điểm hoặc tích tem theo đơn hàng (Stamp Card / Points Earning).
3. Sử dụng / Đổi mã voucher (Voucher Redemption).
4. Hoàn tiền hoặc đảo ngược điểm/tem (Order Refund & Reversal).

### 4.2. Xử lý Trùng lặp tại Backend
- Khi nhận request kèm `x-idempotency-key`, backend kiểm tra trong bảng idempotency/ledger.
- Nếu key đã xử lý thành công trước đó: trả về ngay kết quả lưu trước đó với mã HTTP 200, **tuyệt đối không thực thi lại giao dịch**.
- Nếu hai request cùng key đến đồng thời: request thứ hai phải bị chặn bằng khóa cơ sở dữ liệu (Pessimistic / Conditional Lock) hoặc trả về `409 Conflict`.

---

## 5. Danh mục Mã Lỗi Tiêu chuẩn (Standard Error Codes)

| HTTP Status | Error Code | Mô tả |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Payload sai định dạng hoặc thiếu trường bắt buộc. |
| `401 Unauthorized` | `UNAUTHENTICATED` | Thiếu token, token hết hạn hoặc không hợp lệ. |
| `403 Forbidden` | `FORBIDDEN_BRANCH_ACCESS` | Thu ngân chi nhánh A không được thao tác trên đơn chi nhánh B. |
| `404 Not Found` | `MEMBER_NOT_FOUND` | Không tìm thấy thông tin hội viên / voucher / đơn hàng. |
| `409 Conflict` | `VOUCHER_ALREADY_USED` | Voucher đã được đổi trước đó hoặc đang được xử lý ở quầy khác. |
| `409 Conflict` | `IDEMPOTENT_RETRY_CONFLICT` | Thao tác cùng khoá đang trong quá trình thực thi. |
| `422 Unprocessable`| `INVALID_VOUCHER_TARGET` | Voucher không áp dụng được cho sản phẩm/chi nhánh này. |
| `500 Server Error` | `TRANSACTION_FAILED` | Lỗi giao dịch cơ sở dữ liệu nội bộ. |

---

## 6. Quy ước Phía Frontend Client

1. **Không gọi API trực tiếp trong Component UI**: Toàn bộ lời gọi API phải thông qua file service tại `apps/frontend/src/features/<feature>/api/` hoặc custom hook.
2. **Double-submit Prevention**:
   - Vô hiệu hóa nút bấm và hiển thị spinner ngay khi request bắt đầu (`isLoading: true`).
   - Tạo mới UUID cho mỗi lần người dùng bấm nút xác nhận thực tế.
3. **Quản lý Session**:
   - Tự động bắt mã `401` để làm mới session qua `/api/v1/auth/refresh`.
   - Nếu refresh thất bại, xóa trạng thái đăng nhập và điều hướng người dùng về màn hình đăng nhập an toàn.
