# Kế hoạch Chi tiết Ngày 1 (26/11/2026) · Baseline, Tái cấu trúc Cụm Model & Bóc tách Test theo Nghiệp vụ (~250 dòng)

- **Nhánh hiện tại:** `main`
- **Commit gốc (Baseline Commit):** `9d1dcf78a2678b4bf32f6f3e3d90b322504f8072`
- **Tài liệu tham chiếu:** [Loyalty-9-ngay.md](/Loyalty-9-ngay.md)

---

## 1. Định hướng Tái cấu trúc Cụm Model (Giải quyết Cụm 3 & Cụm 4 quá tải)

Mục tiêu thiết kế theo `AGENTS.md` và `Loyalty-9-ngay.md`: *"Mỗi cụm không vượt quá 4 bảng trừ khi có luồng cụ thể chứng minh"*. Việc dồn 9 bảng vào Cụm 3 và 20 bảng vào Cụm 4 là quá lớn, gây lẫn lộn ranh giới ngữ cảnh (Bounded Contexts).

Chúng ta phân rã và tinh gọn như sau:

### Phân rã Cụm 3 (Thương mại - 9 models $\rightarrow$ 3 miền độc lập, mỗi miền $\le 4$ models):
1. **Cụm 3A · Đơn hàng & Thanh toán (Orders & Checkout - 4 models):**
   - `Order`: Đơn hàng, lưu trạng thái thanh toán, tổng tiền, snapshot loyalty.
   - `OrderItem`: Chi tiết dòng hàng (productId, số lượng ly/món).
   - `OrderRequest`: Idempotency key và hash payload chống đặt trùng.
   - `OrderVoucherReservation`: Giữ chỗ voucher trong lúc order đang PENDING.
2. **Cụm 3B · Hoàn tiền & Đối soát (Refunds & Reconciliation - 3 models):**
   - `RefundRequest`: Yêu cầu hoàn tiền từ hội viên hoặc quầy.
   - `OrderRefund`: Bản ghi quyết toán hoàn tiền (Mock hoặc đã settle).
   - `RefundReconciliationAttempt`: Lịch sử các lần đối soát với cổng thanh toán ngoài.
3. **Cụm 3C · Quản trị Tồn kho & Sổ kho (Inventory Ledger - 2 models):**
   - `InventoryBalance`: Số dư tồn kho thực tế và số lượng đang giữ chỗ.
   - `InventoryMovement`: Sổ cái biến động kho bất biến (audit trail).

---

### Phân rã Cụm 4 (Loyalty & Gamification - 20 models $\rightarrow$ 4 miền độc lập + Lộ trình tinh gọn):
1. **Cụm 4A · Chính sách Loyalty & Hạng thẻ (Tiers & Policy - 5 models $\rightarrow$ tinh gọn còn 3 models ở Ngày 2):**
   - `MerchantMembership`, `LoyaltyTier`, `LoyaltyPolicyVersion` (Giữ lại).
   - *Đề xuất tinh gọn:*
     - `LoyaltyRule` (quan hệ 1-1 với Merchant) $\rightarrow$ gộp thẳng vào `Merchant` hoặc snapshot trong `LoyaltyPolicyVersion`.
     - `TierResetRun` $\rightarrow$ lưu thành nhật ký sự kiện/audit field thay vì bảng độc lập.
2. **Cụm 4B · Sổ cái Điểm & Ví (Wallet & Ledger - 3 models):**
   - `LoyaltyWallet`: Ví điểm hội viên (exactBalance, netLifetimeEarned).
   - `PointTransaction`: Sổ cái giao dịch điểm bất biến (append-only ledger).
   - `RedemptionIdempotency`: Khóa chống trùng khi đổi voucher.
3. **Cụm 4C · Voucher & Quà tặng (Vouchers & Rewards - 4 models $\rightarrow$ tinh gọn còn 2 models ở Ngày 2):**
   - `VoucherDefinition`: Cấu hình định nghĩa voucher (giảm giá hoặc quà tặng).
   - `MemberVoucher`: Voucher đã phát cho hội viên kèm snapshot điều khoản.
   - *Đề xuất tinh gọn:*
     - `RewardFulfillment` & `RewardCancellation` (quan hệ 1-1 với `MemberVoucher`) $\rightarrow$ gộp các trường audit (`fulfilledById`, `fulfilledAt`, `cancelledById`, `cancelledAt`, `cancelReason`) trực tiếp vào `MemberVoucher`.
4. **Cụm 4D · Thử thách & Thẻ dấu (Challenges & Gamification - 8 models $\rightarrow$ tinh gọn còn 4 models ở Ngày 2):**
   - `Challenge`, `MemberActivity`, `ChallengeProgress`, `ChallengeRewardGrant` (Giữ lại để đếm hoạt động và cấp thưởng).
   - *Đề xuất tinh gọn:*
     - `ChallengeMilestone` $\rightarrow$ gộp thành trường `milestones Json` trong `Challenge` (bảo toàn thứ tự mốc).
     - `ChallengeLimitNotice` & `ChallengeLimitNoticeRead` $\rightarrow$ tinh giản hoặc chuyển sang notification log.

---

## 2. Kế hoạch Bóc tách File Test (Đảm bảo mỗi file $\le 250$ dòng)

Tuân thủ nghiêm ngặt quy tắc của `AGENTS.md`: *"Target 150–250 lines or fewer for a hand-written production file, where practical. Treat 300+ lines as a refactor signal."*

### 2.1. Backend Integration Tests (`tests/backend/integration/`)

| File gốc | Dòng | Tách thành các file mới | Mục tiêu dòng | Nghiệp vụ thể hiện |
|---|---|---|---|---|
| `milestone-2.integration.test.ts` | 103 | `auth-session.integration.test.ts` | ~100 | Đăng ký, đăng nhập, xoay Refresh Token và bảo vệ route hệ thống. |
| `milestone-3.integration.test.ts` | 326 | **Tách 2 file:**<br>1. `products-catalog-isolation.integration.test.ts`<br>2. `orders-pending-authorization.integration.test.ts` | ~160<br>~170 | • **File 1:** Quản lý sản phẩm, danh mục, cô lập dữ liệu giữa các Merchant.<br>• **File 2:** Tạo đơn PENDING, snapshot giá món, kiểm tra quyền thanh toán đơn. |
| `milestone-4.integration.test.ts` | 273 | **Tách 2 file:**<br>1. `loyalty-policy-tier-qualification.integration.test.ts`<br>2. `orders-payment-concurrency.integration.test.ts` | ~135<br>~140 | • **File 1:** Cấu hình chính sách điểm, thanh toán lần đầu thăng hạng Bronze.<br>• **File 2:** Thanh toán đồng thời tuần tự hóa ví điểm, chặn overflow điểm/số lẻ. |
| `milestone-3-4-lifecycle-refund.integration.test.ts` | **752** | **Tách 3 file:**<br>1. `order-cancellation-voucher-release.integration.test.ts`<br>2. `order-mock-refund-lifecycle.integration.test.ts`<br>3. `order-refund-manual-reconciliation.integration.test.ts` | ~180<br>~280<br>~210 | • **File 1:** Vòng đời huỷ đơn PENDING, giải phóng giữ chỗ voucher và hoàn kho.<br>• **File 2:** Quy trình yêu cầu hoàn tiền Mock, duyệt hoàn tiền, đảo điểm ví (`EARN_REVERSAL`), xử lý nợ điểm âm, hạ hạng và khôi phục voucher giảm giá.<br>• **File 3:** Quy trình đối soát hoàn tiền ngoại tuyến (VNPay/legacy provider), ghi nhận bằng chứng đối soát và xử lý retry idempotent. |
| `milestone-5.integration.test.ts` | **810** | **Tách 3 file:**<br>1. `voucher-definitions-redemption.integration.test.ts`<br>2. `reward-cancellation-points-refund.integration.test.ts`<br>3. `reward-lifecycle-state-machine.integration.test.ts` | ~250<br>~230<br>~250 | • **File 1:** Cấu hình định nghĩa voucher, đổi điểm lấy voucher giảm giá, áp dụng vào đơn.<br>• **File 2:** Huỷ voucher quà tặng, hoàn điểm nguyên tử, ưu tiên trừ nợ điểm trước.<br>• **File 3:** Máy trạng thái đổi quà tại quầy vs huỷ quà, chống đổi/huỷ trùng lặp (409), xử lý sản phẩm quà bị ẩn. |

---

### 2.2. Frontend Tests (`tests/frontend/`)

| File gốc | Dòng | Tách thành các file mới | Mục tiêu dòng | Nghiệp vụ thể hiện |
|---|---|---|---|---|
| `tests/frontend/e2e/milestone2.spec.ts` | 35 | `tests/frontend/e2e/auth-registration.spec.ts` | ~35 | E2E form đăng ký hội viên từ trang chủ và lưu trữ session. |
| `tests/frontend/unit/api/milestone2-client.test.ts` | 80 | `tests/frontend/unit/api/auth-client.test.ts` | ~80 | Unit test API client cho xác thực tài khoản (login/register). |
| `tests/frontend/unit/api/m6-m7-commerce-http.test.ts` | 140 | `tests/frontend/unit/api/commerce-http-client.test.ts` | ~140 | Unit test API client kết nối backend giỏ hàng, đơn hàng, điểm. |
| `tests/frontend/unit/m6-member-experience.test.tsx` | **733** | **Tách 2 file:**<br>1. `member-cart-checkout.test.tsx`<br>2. `member-wallet-vouchers.test.tsx` | ~350<br>~380 | • **File 1:** Giỏ hàng, tính subtotal, huỷ đơn, trang kết quả thanh toán.<br>• **File 2:** Ví điểm, số dư lẻ, nợ điểm, danh sách voucher khả dụng/đã dùng. |
| `tests/frontend/unit/m7-merchant-experience.test.tsx` | **588** | **Tách 2 file:**<br>1. `merchant-loyalty-config.test.tsx`<br>2. `merchant-orders-queue.test.tsx` | ~280<br>~300 | • **File 1:** Quản trị chính sách tích điểm, hạng thẻ và tỷ lệ quy đổi.<br>• **File 2:** Hàng đợi xử lý đơn hàng, lọc trạng thái, xem chi tiết đơn. |

---

## 3. Các bước tiến hành ngay

1. **Bước 1:** Bóc tách các file kiểm thử Backend thành các module $\approx 150 - 250$ dòng độc lập.
2. **Bước 2:** Bóc tách các file kiểm thử Frontend Unit & E2E.
3. **Bước 3:** Cập nhật script trong `package.json` và Playwright config.
4. **Bước 4:** Chạy kiểm tra `npm test` toàn diện để đảm bảo 100% test suites pass.
5. **Bước 5:** Tạo commit git rõ ràng cho milestone này và báo cáo kết quả.
