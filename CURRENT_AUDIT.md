# BÁO CÁO KIỂM KÊ HIỆN TRẠNG TOÀN DIỆN DỰ ÁN (CURRENT AUDIT)
**IncomSG Loyalty Commerce Platform**  
*Thời điểm kiểm kê: 26/11/2026 | Nhánh: `main` | Commit Baseline: `9d1dcf78a2678b4bf32f6f3e3d90b322504f8072`*

---

## 1. Tổng quan Kiến trúc & Hạ tầng Kỹ thuật

| Thành phần | Công nghệ / Phiên bản | Vai trò & Đặc tả |
|---|---|---|
| **Mô hình Repository** | Monorepo npm workspaces | Thư mục gốc quản lý cả Frontend và Backend. Cài đặt phụ thuộc qua `npm ci` tại root. |
| **Backend Runtime** | Node.js `>=22.12`, Express `^5.1.0`, TypeScript `~5.9.0` | Cung cấp RESTful API, quản lý transaction cơ sở dữ liệu và sổ cái kế toán kép. |
| **Database & ORM** | MySQL / MariaDB, Prisma `^7.10.1` | Sử dụng `@prisma/adapter-mariadb`, migration bằng `prisma migrate deploy`. |
| **Frontend App** | React `^19.3.1`, Vite `^8.3.5`, Tailwind CSS `^4.3.5` | Giao diện quản trị Merchant (CMS), Storefront công khai và giao diện quầy POS. |
| **UI Components** | Ant Design `^6.7.1`, Radix UI primitives, Phosphor Icons | Bộ component bảng biểu, dialog xác nhận và form cấu hình chuẩn quy chuẩn quiet UI. |
| **Kiểm thử (Test Suites)** | Node Test Runner, Vitest `^5.1.0`, Playwright `^1.65.0` | 99 unit tests backend, hơn 30 test suite frontend, integration test kết nối DB MySQL thật. |

---

## 2. Kiểm kê Chi tiết 36 Model Database (Prisma Schema)

Cơ sở dữ liệu gồm 36 model được phân rã thành **8 phân hệ độc lập (Bounded Contexts)** theo nguyên tắc mỗi cụm $\le 4$ bảng:

### 2.1. Cụm Định danh & Bảo mật (Auth & Identity - 2 models)
* `User`: Tài khoản người dùng (role: `MERCHANT`, `MEMBER`; status: `ACTIVE`, `SUSPENDED`, `BANNED`, v.v.).
* `RefreshSession`: Phiên đăng nhập xoay vòng (familyId, tokenHash, cơ chế chống reuse token).

### 2.2. Cụm Cửa hàng & Danh mục (Storefront & Catalog - 5 models)
* `Merchant`: Thực thể cửa hàng/thương hiệu gốc (mỗi installation là 1 merchant độc lập).
* `ProductCategory`: Phân loại sản phẩm (hỗ trợ slug tiếng Việt tự động).
* `Product`: Sản phẩm bán (`SALE`) hoặc quà tặng hội viên (`REWARD`).
* `ProductImage`: Thư viện ảnh sản phẩm, sắp xếp theo thứ tự hiển thị.
* `MerchantEvent`: Sự kiện workshop/tasting công khai của cửa hàng.

### 2.3. Cụm Đơn hàng & Thanh toán (Orders & Checkout - 4 models)
* `Order`: Đơn hàng, lưu trữ subtotal, discount, total, trạng thái (`PENDING`, `PAID`, `REFUNDED`), snapshot chính sách điểm.
* `OrderItem`: Chi tiết từng dòng sản phẩm trong đơn (`productId`, `unitPrice`, `quantity`, `lineTotal`).
* `OrderRequest`: Bản ghi chống đặt trùng (idempotencyKey + payloadHash).
* `OrderVoucherReservation`: Khóa giữ chỗ voucher khi đơn đang ở trạng thái `PENDING`.

### 2.4. Cụm Hoàn tiền & Đối soát (Refunds & Reconciliation - 3 models)
* `RefundRequest`: Yêu cầu hoàn tiền từ hội viên hoặc quầy (`PENDING_MERCHANT`, `APPROVED`, `REJECTED`, `PROCESSING`, `COMPLETED`).
* `OrderRefund`: Bản ghi quyết toán hoàn tiền (lưu số tiền hoàn thực tế, lý do, thời gian).
* `RefundReconciliationAttempt`: Bằng chứng đối soát cổng thanh toán ngoài (VNPay), chống đối soát trùng lặp per `providerReference`.

### 2.5. Cụm Quản trị Tồn kho (Inventory Ledger - 2 models)
* `InventoryBalance`: Số dư tồn kho thực tế (`onHandQuantity`) và số lượng đang bị giữ chỗ (`reservedQuantity`).
* `InventoryMovement`: Sổ cái kho bất biến (ghi nhận mọi biến động: `ORDER_RESERVE`, `ORDER_RELEASE`, `SALE_OUT`, `RETURN_IN`).

### 2.6. Cụm Chính sách Loyalty & Hạng thẻ (Tiers & Policy - 5 models)
* `MerchantMembership`: Hồ sơ thành viên tại cửa hàng, hạng thẻ hiện tại và tiến độ tích lũy xét hạng.
* `LoyaltyTier`: Cấu hình các hạng thẻ (tên hạng, màu sắc, ngưỡng chi tiêu/điểm, hệ số nhân điểm multiplier).
* `LoyaltyRule`: Quy tắc điểm cơ bản (`vndPerPoint`, kỳ reset hạng). *(Định hướng gộp vào Merchant ở Ngày 2)*.
* `TierResetRun`: Lịch sử các lần chạy reset hạng định kỳ hàng năm. *(Định hướng gộp thành audit log)*.
* `LoyaltyPolicyVersion`: Bản snapshot bất biến của chính sách điểm mỗi lần Merchant bấm phát hành.

### 2.7. Cụm Sổ cái Điểm & Ví (Wallet & Ledger - 3 models)
* `LoyaltyWallet`: Ví điểm thành viên (lưu số dư chuẩn xác `exactBalance` và tổng điểm trọn đời `netLifetimeEarned`).
* `PointTransaction`: Sổ cái giao dịch điểm bất biến (loại: `EARN`, `REDEEM_DISCOUNT`, `REDEEM_REWARD`, `EARN_REVERSAL`, v.v.).
* `RedemptionIdempotency`: Khóa chống đổi điểm trùng lặp cho cùng một yêu cầu.

### 2.8. Cụm Voucher & Quà tặng (Vouchers & Rewards - 4 models)
* `VoucherDefinition`: Định nghĩa loại voucher (`DISCOUNT` giảm tiền hoặc `REWARD` tặng hiện vật).
* `MemberVoucher`: Voucher đã cấp cho hội viên, chứa toàn bộ snapshot điều khoản lúc phát hành.
* `RewardFulfillment`: Bản ghi thu ngân xác nhận đã trao quà vật phẩm tại quầy. *(Định hướng gộp vào MemberVoucher)*.
* `RewardCancellation`: Bản ghi huỷ quà tặng và hoàn điểm. *(Định hướng gộp vào MemberVoucher)*.

### 2.9. Cụm Thử thách & Gamification (Challenges - 8 models)
* `Challenge`: Chiến dịch nhiệm vụ (ORDER_COUNT, DAILY_CHECKIN, SPEND_TOTAL; quản lý ngân sách điểm thưởng).
* `ChallengeMilestone`: Các mốc tiến độ trong thử thách. *(Định hướng gộp thành Json bên trong Challenge ở Ngày 2)*.
* `MemberActivity`: Ghi nhận hoạt động đơn hàng hoặc check-in hàng ngày của hội viên.
* `ChallengeProgress`: Tiến độ thực hiện nhiệm vụ của từng hội viên.
* `ChallengeProgressEntry`: Bản ghi chi tiết tăng/giảm tiến độ gắn với từng activity.
* `ChallengeRewardGrant`: Bản ghi trao thưởng điểm khi hoàn thành nhiệm vụ.
* `ChallengeLimitNotice` & `ChallengeLimitNoticeRead`: Thông báo khi thử thách đạt giới hạn người nhận.

---

## 3. Các Quy tắc Nghiệp vụ Cốt lõi (Business Integrity)

### 3.1. Cơ chế Giữ chỗ Kép khi Đặt hàng (Dual Reservation)
* Khi tạo đơn `PENDING`:
  1. **Khóa kho:** Đặt thời hạn giữ chỗ 5 phút (`stockReservedUntil = now + 5m`), trừ kho khả dụng và tăng kho giữ chỗ trong `InventoryBalance`, tạo movement `ORDER_RESERVE`.
  2. **Khóa voucher:** Tạo liên kết khóa trong `OrderVoucherReservation`. Không đơn nào khác được phép dùng voucher này.
* Khi huỷ đơn hoặc hết hạn 5 phút: Hệ thống tự động giải phóng kho (`ORDER_RELEASE`) và trả voucher về `AVAILABLE`.

### 3.2. Tính toán Điểm chính xác (Exact Decimal Arithmetic)
* Điểm thưởng tính theo công thức:
  $$\text{EarnedPoints} = \frac{\text{NetOrderAmount} \times \text{TierMultiplier}}{\text{vndPerPoint}}$$
* Điểm được làm tròn chính xác `HALF_UP` ở 12 chữ số thập phân (`Decimal(38, 12)`). Tuyệt đối không dùng số thực dấu phẩy động (float/double) trong tính toán tài chính và điểm thưởng.

### 3.3. Quy trình Hoàn tiền & Thu hồi (Refund & Reversal Lifecycle)
* **Thanh toán Mock:** Quyết toán tức thì qua `completeMockRefund`, chuyển trạng thái `REFUNDED`.
* **Thanh toán Cổng ngoài (VNPay):** Bắt buộc trải qua đối soát thủ công bằng chứng (`reconcile`), kiểm tra tính duy nhất chống replay per `providerReference`.
* **Tác động liên đới:**
  * Thu hồi nguyên tử số điểm đã cấp bằng giao dịch `EARN_REVERSAL`.
  * Cho phép số dư ví âm (Point Debt) nếu khách đã trót tiêu số điểm đó.
  * Trừ ngược tiến độ xét hạng; nếu rớt dưới ngưỡng, hội viên bị hạ hạng ngay lập tức.
  * Phục hồi voucher giảm giá về trạng thái `AVAILABLE`.
  * Đảo tiến độ nhiệm vụ và thu hồi điểm thưởng thử thách nếu có.

---

## 4. Hiện trạng Kiểm thử & Ma trận Tái cấu trúc File Test (~250 dòng)

### 4.1. Baseline hiện tại
* **Backend Unit Tests:** 99/99 passed (thời gian chạy ~4.7s).
* **Frontend Unit Tests:** 30+ suites passed (chỉ 1 lỗi do đổi nhãn nút trong `v4-events.test.tsx`).
* **Backend Integration Tests:** Sẵn sàng trên MySQL test (`incomsg_testdb_*`).

### 4.2. Kế hoạch Chuẩn hóa Tiền tố & Bóc tách File Kiểm thử
Tất cả các file mang tên chung chung (`milestone-*`, `m6`, `m7`) được bóc tách về chuẩn **$\le 250$ dòng / file** với tiền tố nghiệp vụ đồng nhất:

```
tests/backend/integration/
├── auth-session.integration.test.ts                     (~100 dòng)
├── order-catalog-isolation.integration.test.ts          (~160 dòng)
├── order-pending-authorization.integration.test.ts      (~170 dòng)
├── order-cancellation-release.integration.test.ts       (~180 dòng - Giải phóng kép kho & voucher)
├── order-payment-concurrency.integration.test.ts        (~140 dòng)
├── refund-mock-lifecycle.integration.test.ts            (~280 dòng)
├── refund-manual-reconciliation.integration.test.ts     (~210 dòng)
├── voucher-definitions-redemption.integration.test.ts   (~250 dòng)
├── reward-cancellation-points-refund.integration.test.ts(~230 dòng)
├── reward-lifecycle-state-machine.integration.test.ts   (~260 dòng)
└── loyalty-tier-qualification.integration.test.ts       (~135 dòng)

tests/frontend/
├── e2e/auth-registration.spec.ts                        (~35 dòng)
├── unit/api/auth-client.test.ts                         (~80 dòng)
├── unit/api/commerce-http-client.test.ts                (~140 dòng)
├── unit/member-cart-checkout.test.tsx                   (~350 dòng)
├── unit/member-wallet-vouchers.test.tsx                 (~380 dòng)
├── unit/merchant-loyalty-config.test.tsx                (~280 dòng)
└── unit/merchant-orders-queue.test.tsx                  (~300 dòng)
```

---

## 5. Kế hoạch Sprint 9 Ngày Hikari Loyalty (26/11 – 04/12)

* **Mục tiêu nghiệm thu then chốt (02/12 - Ngày 7 demo):**
  1. Khách quét QR Zalo mở thẻ tích điểm Hikari ban đầu: **1/5 dấu**.
  2. Thu ngân chi nhánh A tạo đơn: **3 latte + 2 bánh** $\rightarrow$ Khách mở lại thấy cập nhật: **4/5 dấu** (chỉ tính 3 ly latte đủ điều kiện).
  3. Mua thêm **1 latte** $\rightarrow$ Thẻ đạt 5/5 $\rightarrow$ Nhận đúng **1 voucher đổi ly**, thẻ quay về **0/5**.
  4. Khách mang voucher sang **Chi nhánh B** đổi ly miễn phí thành công **1 lần duy nhất** (chống đổi trùng).

| Ngày | Mục tiêu chính | Đầu ra cần đạt |
|---|---|---|
| **Ngày 1 (26/11)** | Baseline kỹ thuật, kiểm kê 36 model, audit repo, bóc tách toàn bộ file test $\le 250$ dòng. Chuẩn bị Zalo Mini App. | File `CURRENT_AUDIT.md`, bộ test sạch tên, xác định đường kết nối Zalo. |
| **Ngày 2 (27/11)** | Refactor Prisma schema: gộp `ChallengeMilestone` thành Json, tinh gọn bảng phụ, bổ sung model `Branch`. | Migration DB sạch, seed chạy hoàn hảo, API checkout/loyalty không hồi quy. |
| **Ngày 3 (28/11)** | RBAC phân quyền chi nhánh (`OWNER`, `STORE_MANAGER`, `CASHIER`) và scope API đơn hàng/quầy. | Thu ngân A chỉ thấy đơn A; Thu ngân B chỉ thấy đơn B; Owner quản trị toàn chuỗi. |
| **Ngày 4 (29/11)** | Xây dựng Stamp Engine: đếm ly latte theo dòng hàng, cấp voucher khi qua mốc 5, đảo dấu khi refund. | Mua 3 latte thành 4/5 dấu; mua thêm 1 latte nhận đúng 1 voucher; refund trừ đúng số dấu. |
| **Ngày 5 (30/11)** | Màn hình POS quầy thu ngân & CMS quản trị: tra cứu hội viên, tạo đơn, đổi voucher toàn chuỗi. | Thu ngân B đổi được voucher tại chi nhánh B; chống double-redeem khi đổi đồng thời. |
| **Ngày 6 (01/12)** | Tích hợp Zalo Mini App: gắn session backend, hiển thị thẻ dấu trên điện thoại, cơ chế fallback login. | Hai tài khoản Zalo hiển thị chính xác thẻ dấu của từng người trên thiết bị thật. |
| **Ngày 7 (02/12)** | **DEMO ĐIỆN THOẠI:** Chạy trọn vẹn kịch bản 5-trong-1 từ quét QR đến đổi thưởng tại chi nhánh B. | Video demo thực tế trên điện thoại, dữ liệu MySQL đối soát sạch sẽ. |
| **Ngày 8 (03/12)** | Kiểm thử hồi quy toàn diện: Unit, Integration, Playwright E2E, giả lập sự cố đồng thời và hoàn tiền. | Báo cáo test gắn kèm commit, xác minh sổ cái ví và kho nguyên vẹn sau lỗi. |
| **Ngày 9 (04/12)** | Reset DB trắng, chạy lại seed từ đầu, bàn giao tài khoản theo vai trò, ma trận quyền và tài liệu. | Người thứ hai tự chạy lại được luồng demo thành công theo hướng dẫn. |
