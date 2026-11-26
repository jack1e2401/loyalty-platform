# KIẾN TRÚC HỆ THỐNG (ARCHITECTURE)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/ARCHITECTURE.md`  
**Vai trò:** Single Source of Truth mô tả kiến trúc tổng thể Monorepo, luồng dữ liệu, phân tầng trách nhiệm và nguyên tắc toàn vẹn nghiệp vụ tài chính/loyalty cho lập trình viên và AI Coding Agents.

---

## 1. Tổng quan Mô hình Monorepo

Dự án IncomSG được tổ chức theo mô hình **Monorepo** chuẩn hóa với npm workspaces:

```text
IncomSG/ (Root Workspace)
├── apps/
│   ├── frontend/         # React 19, TypeScript, Ant Design, Tailwind, Vite
│   └── backend/          # Node.js, Express, TypeScript, Prisma ORM, MySQL
├── tests/
│   ├── frontend/unit/    # Vitest + React Testing Library (chia theo 11 domain)
│   ├── frontend/e2e/     # Playwright E2E browser tests
│   ├── backend/unit/     # Vitest unit tests (99 tests chia theo domain)
│   └── backend/integration/ # MySQL Integration tests (22 test suites chia theo 12 domain)
├── docs/                 # Kế hoạch sprint, đặc tả kỹ thuật, tài liệu nghiên cứu
└── agent-docs/           # Quy chuẩn kiến trúc, API, UI/UX, Testing cho AI Agents
```

---

## 2. Kiến trúc Phân tầng Toàn hệ thống (Layered System Architecture)

```text
[ GIAO DIỆN NGƯỜI DÙNG (FRONTEND) ]
   ├── Member Portal & Zalo Mini App (Điện thoại, thẻ tem tích điểm, ví voucher)
   ├── Merchant CMS & Cashier Counter (Quầy thu ngân, quản lý sản phẩm, đối soát)
   └── Admin Portal (Quản trị hệ thống, duyệt merchant)
            │  (HTTPS / RESTful JSON / Idempotency Key)
            ▼
[ APPLICATION & API LAYER (BACKEND EXPRESS) ]
   ├── Middleware: Auth (JWT/Session), RBAC (Role/Scope), Branch Context, Validation
   └── Domain Modules (apps/backend/src/modules/):
         ├── auth          : Xác thực & phiên làm việc
         ├── member        : Hồ sơ hội viên & định danh khách hàng
         ├── loyalty       : Chính sách tích điểm, hạng thẻ, tem tích lũy (Stamp Card)
         ├── vouchers      : Kho voucher, quy tắc đổi, snapshot voucher
         ├── orders        : Giỏ hàng, tạo đơn, thanh toán, đếm ly latte/bánh
         ├── refunds       : Hoàn tiền, đảo tem/điểm, thu hồi voucher
         ├── catalog       : Danh mục & sản phẩm
         └── events        : Sự kiện tích điểm & kích hoạt chiến dịch
            │
            ▼
[ TẦNG DỊCH VỤ NGHIỆP VỤ & GIAO DỊCH (CORE DOMAIN) ]
   ├── Loyalty Engine: Tính tem/điểm, carry-over, thăng hạng, phát sinh voucher
   ├── Ledger Engine : Ghi chép sổ cái kiểm toán bất biến (Immutable Audit Ledger)
   └── Branch Scope  : Kiểm soát độc lập chi nhánh (Chi nhánh A, Chi nhánh B)
            │
            ▼
[ PERSISTENCE & DATA INTEGRITY ]
   ├── Prisma Client ORM (`prisma.$transaction`)
   └── Cơ sở dữ liệu MySQL (MySQL 8.x InnoDB, ACID Compliant)
```

---

## 3. Các Nguyên Tắc Toàn Vẹn Cốt Lõi (Core Business Integrity)

Mọi thay đổi mã nguồn MUST tuân thủ nghiêm ngặt các nguyên tắc sau:

### 3.1. Backend là Thẩm quyền Duy nhất (Authoritative Backend)
- Backend và cơ sở dữ liệu MySQL là nguồn chân lý duy nhất cho toàn bộ kết quả tài chính, điểm thưởng, tem tích lũy và voucher.
- **Tuyệt đối không** tính toán hoặc giả định giao dịch đã thành công ở giao diện frontend khi chưa có phản hồi xác nhận từ backend.

### 3.2. Tính Chính xác Tuyệt đối về Tiền tệ và Điểm (Exact Decimal Arithmetic)
- Tiền Việt Nam Đồng (VND) và điểm loyalty có phần thập phân phải sử dụng số học chính xác (`Prisma.Decimal`, chuỗi số hoặc số nguyên fixed-point).
- **Tuyệt đối không** sử dụng số thực dấu phẩy động dạng nhị phân (`number` float của JS như `0.1 + 0.2`) trong các công thức tính toán số dư, chiết khấu hay hoàn trả.

### 3.3. Cô lập Merchant và Chi nhánh (Merchant & Branch Isolation)
- Dữ liệu ví, chính sách, voucher, đơn hàng và sổ cái phải thuộc đúng Merchant và Branch sở hữu.
- Vai trò `CASHIER` tại Chi nhánh A chỉ được ghi nhận đơn và đổi voucher trong phạm vi chi nhánh A; không được xem doanh thu tổng hoặc can thiệp đơn của Chi nhánh B.
- Vai trò `STORE_MANAGER` và `OWNER` có quyền kiểm soát bao quát các chi nhánh thuộc merchant.

### 3.4. Nguyên tử và Bất khả lặp (Atomic & Idempotent Transitions)
- Xác nhận thanh toán, tích tem, tích điểm, đổi voucher và hoàn tiền phải nằm trong `prisma.$transaction`.
- Mọi thao tác đổi voucher hoặc nhận thưởng phải có cơ chế khóa (conditional update) chống race-condition khi khách đổi tại quầy hoặc nhiều quầy quét đồng thời.

### 3.5. Sổ cái Kiểm toán Bất biến (Immutable Audit Ledger)
- Mọi sự kiện thay đổi số dư điểm, trạng thái tem hay voucher đều phải ghi bản ghi lịch sử sổ cái (Ledger).
- **Không bao giờ** âm thầm ghi đè hay cập nhật trực tiếp lịch sử giao dịch để cân bằng số dư.

### 3.6. Chính sách Loyalty Bất biến (Immutable Policy Snapshots)
- Mỗi phiên bản chính sách loyalty khi đã xuất bản (Published) là một snapshot bất biến.
- Khi merchant chỉnh sửa chính sách, hệ thống tạo một bản nháp hoặc bản phát hành mới (Version $N+1$); các đơn hàng cũ áp dụng chính sách tại thời điểm đơn phát sinh.

---

## 4. Quyết định Vị trí Đặt Logic (Where Code Belongs)

| Loại Logic | Vị trí Quy định | Ví dụ |
| :--- | :--- | :--- |
| Màn hình & Trang giao diện | `apps/frontend/src/features/<domain>/` | `MerchantOrdersPage.tsx`, `MemberCardPage.tsx` |
| Component UI dùng chung | `apps/frontend/src/components/` | `ConfirmModal.tsx`, `StatusBadge.tsx` |
| Khung bố cục các cổng | `apps/frontend/src/layouts/` | `MerchantLayout.tsx`, `MemberLayout.tsx` |
| Gọi API từ Frontend | `apps/frontend/src/features/<domain>/api.ts` | `ordersApi.createOrder()`, `stampApi.getCard()` |
| Định nghĩa Tuyến đường | `apps/frontend/src/routes/` | `AppRoutes.tsx` |
| Định nghĩa Route Backend | `apps/backend/src/modules/<domain>/<domain>.routes.ts` | `orders.routes.ts` |
| Controller & Validate Request | `apps/backend/src/modules/<domain>/<domain>.controller.ts` | `orders.controller.ts` |
| Nghiệp vụ Domain & Tính toán | `apps/backend/src/modules/<domain>/<domain>.service.ts` | `loyalty-engine.service.ts` |
| Định nghĩa Schema Database | `apps/backend/prisma/schema.prisma` | Model `Branch`, `Order`, `StampCard` |
| Unit Test Frontend | `tests/frontend/unit/<domain>/` | `tests/frontend/unit/loyalty/exact-loyalty-display.test.tsx` |
| Unit Test Backend | `tests/backend/unit/modules/<domain>/` | `tests/backend/unit/modules/loyalty/exact-points.test.ts` |
| Integration Test MySQL | `tests/backend/integration/<domain>/` | `tests/backend/integration/orders/order-payment-concurrency.integration.test.ts` |
