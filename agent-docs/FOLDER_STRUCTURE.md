# CẤU TRÚC THƯ MỤC DỰ ÁN (FOLDER STRUCTURE)

**Dự án:** IncomSG — Loyalty & Commerce Platform  
**Vị trí tài liệu:** `agent-docs/FOLDER_STRUCTURE.md`  
**Vai trò:** Single Source of Truth duy nhất quy định cấu trúc thư mục Monorepo, vị trí đặt module nghiệp vụ, phân chia các tầng Frontend/Backend và quy tắc tổ chức Test Suite cho IncomSG.

---

## 1. Sơ đồ Tổng quan Cây Thư mục

```text
IncomSG/
├── apps/
│   ├── frontend/             # Ứng dụng Giao diện (React 19, Vite, Ant Design)
│   └── backend/              # Ứng dụng Máy chủ (Express, Prisma, MySQL)
├── tests/
│   ├── frontend/unit/        # Unit tests Frontend (Vitest + React Testing Library)
│   ├── frontend/e2e/         # Browser E2E tests (Playwright)
│   ├── backend/unit/         # Unit tests Backend (Vitest - Business & Policy logic)
│   └── backend/integration/  # Integration tests Backend với MySQL thực tế
├── docs/
│   ├── superpowers/          # Kế hoạch sprint, specs kiến trúc, tài liệu nghiên cứu
│   ├── frontend/             # Tài liệu kiến trúc & hướng dẫn riêng cho Frontend
│   └── backend/              # Tài liệu kiến trúc & hướng dẫn riêng cho Backend
├── agent-docs/               # Quy chuẩn hệ thống dành cho AI Coding Agents
├── package.json              # Root npm workspaces config & scripts điều phối
└── AGENTS.md                 # Quy tắc ứng xử và an toàn toàn repo
```

---

## 2. Chi tiết Thư mục `apps/frontend/`

Ứng dụng Frontend được tổ chức theo kiến trúc **Feature-driven**:

```text
apps/frontend/src/
├── components/          # Reusable UI components dùng chung toàn ứng dụng (Modal, Button, Badge)
├── features/            # Các module tính năng chia theo Domain nghiệp vụ:
│   ├── auth/            # Đăng nhập, đăng ký, refresh session
│   ├── catalog/         # Quản lý danh mục & sản phẩm (Merchant / Storefront)
│   ├── challenges/      # Thẻ thử thách, tích tem (Stamp card 1/5 -> 4/5), mốc thưởng
│   ├── events/          # Sự kiện khuyến mãi & nhân điểm
│   ├── loyalty/         # Cấu hình chính sách điểm, hạng thẻ, lịch sử chính sách
│   ├── member/          # Màn hình hội viên, ví voucher, hành trình khách hàng
│   ├── merchant/        # CMS quản trị merchant, quầy thu ngân (Cashier counter)
│   ├── orders/          # Giỏ hàng, tạo đơn, quản lý hàng chờ đơn hàng
│   ├── refunds/         # Quy trình duyệt & đối soát hoàn tiền
│   └── storefront/      # Giao diện cửa hàng, cấu hình giao diện & theme
├── layouts/             # Khung bố cục các cổng (MerchantLayout, MemberLayout, StorefrontLayout)
├── lib/                 # Core HTTP client, Axios/Fetch instance, cấu hình môi trường
├── routes/              # Bảng định tuyến routes toàn ứng dụng (AppRoutes.tsx)
├── types/               # Kiểu dữ liệu TypeScript dùng chung
└── utils/               # Hàm tiện ích thuần túy (format tiền VND, format điểm, xử lý ngày)
```

---

## 3. Chi tiết Thư mục `apps/backend/`

Ứng dụng Backend được tổ chức theo kiến trúc **Domain-Driven Modular Express**:

```text
apps/backend/
├── prisma/
│   ├── schema.prisma    # Định nghĩa cấu trúc 36+ models cơ sở dữ liệu MySQL
│   ├── migrations/      # Lịch sử migration cơ sở dữ liệu
│   ├── seed.ts          # Seed dữ liệu gốc (Standard baseline seed)
│   └── demo-seed.ts     # Seed dữ liệu demo Hikari Coffee (Latte, bánh, hội viên, voucher)
└── src/
    ├── middleware/      # Auth, RBAC (OWNER, STORE_MANAGER, CASHIER), Branch Scope, Validation
    ├── modules/         # Các module nghiệp vụ lõi (Domain Services & Controllers):
    │   ├── auth/        # Xử lý token, session, phân quyền
    │   ├── catalog/     # Sản phẩm, biến thể, tồn kho
    │   ├── challenges/  # Gamification, thẻ tem tích ly, mốc nhận voucher
    │   ├── events/      # Chiến dịch tích điểm theo sự kiện
    │   ├── inventory/   # Quản lý tồn kho sản phẩm
    │   ├── loyalty/     # Tính điểm, hạng thành viên, carry-over điểm lẻ, snapshot chính sách
    │   ├── orders/      # Tiếp nhận đơn, đếm số ly latte/bánh, thanh toán
    │   ├── refunds/     # Hoàn tiền, đảo tem, trừ điểm bù trừ
    │   ├── storefront/  # Cấu hình giao diện và thông tin cửa hàng
    │   └── vouchers/    # Phát hành, khóa giữ chỗ (reservation), đổi voucher theo chi nhánh
    ├── lib/             # Khởi tạo Prisma Client, Decimal helper, Winston Logger
    └── server.ts        # Entry point khởi động Express HTTP Server
```

---

## 4. Chi tiết Thư mục `tests/`

Hệ thống test được tổ chức tách biệt hoàn toàn khỏi mã nguồn sản phẩm và chia theo domain:

```text
tests/
├── frontend/
│   ├── unit/            # Vitest + React Testing Library (33 test suites)
│   │   ├── analytics/   # Test báo cáo phân tích khách hàng
│   │   ├── auth/        # Test client auth & refresh session
│   │   ├── catalog/     # Test giao diện sản phẩm & danh mục
│   │   ├── challenges/  # Test giao diện thẻ tem & thử thách hội viên
│   │   ├── events/      # Test sự kiện merchant
│   │   ├── loyalty/     # Test hiển thị điểm chính xác, lịch sử hạng thẻ
│   │   ├── member/      # Test ví voucher, xem trước thanh toán hội viên
│   │   ├── merchant/    # Test CMS merchant, hàng chờ đơn hàng, phân trang
│   │   ├── orders/      # Test HTTP client thương mại & đặt hàng
│   │   ├── refunds/     # Test giao diện duyệt hoàn tiền của merchant & member
│   │   └── storefront/  # Test điều hướng & theme cửa hàng
│   └── e2e/             # Playwright E2E browser tests (kiểm thử đầu cuối)
│
└── backend/
    ├── unit/            # Vitest Backend Unit Tests (99 tests chạy trong bộ nhớ)
    │   └── modules/     # Test các hàm tính điểm, validation, policy rule tách biệt DB
    │       ├── auth/
    │       ├── catalog/
    │       ├── challenges/
    │       ├── loyalty/
    │       ├── orders/
    │       ├── refunds/
    │       └── vouchers/
    │
    └── integration/     # Vitest MySQL Integration Tests (22 test suites)
        ├── analytics/   # Test tích hợp phân tích số liệu
        ├── auth/        # Test session & token xác thực
        ├── catalog/     # Test cô lập danh mục sản phẩm
        ├── challenges/  # Test tích tem, vượt mốc cấp voucher
        ├── database/    # Test migration & schema integrity
        ├── events/      # Test sự kiện tích điểm thực tế
        ├── inventory/   # Test quản lý tồn kho đồng thời
        ├── loyalty/     # Test tính điểm chính xác (Exact Decimal), thăng hạng
        ├── orders/      # Test tạo đơn, đồng thời thanh toán, hủy đơn
        ├── refunds/     # Test vòng đời hoàn tiền, đối soát thủ công
        ├── storefront/  # Test API storefront
        └── vouchers/    # Test máy trạng thái voucher, đổi chéo chi nhánh
```

---

## 5. Nguyên tắc Vàng khi Tạo hoặc Chuyển File Mới

1. **Tuyệt đối không tạo file test trong thư mục `src/`**: File test frontend đặt tại `tests/frontend/unit/<domain>/`; file test backend đặt tại `tests/backend/unit/modules/<domain>/` hoặc `tests/backend/integration/<domain>/`.
2. **Không tạo thư mục cấp 1 mới ở root**: Chỉ sử dụng các thư mục gốc đã được chuẩn hóa (`apps/`, `tests/`, `docs/`, `agent-docs/`).
3. **Phân loại rõ ràng trong `docs/`**:
   - Kế hoạch sprint active: `docs/superpowers/plans/sprint-9days/`.
   - Kế hoạch cũ đã lưu trữ: `docs/superpowers/plans/historical/`.
   - Tài liệu kỹ thuật: `docs/frontend/` hoặc `docs/backend/`.
