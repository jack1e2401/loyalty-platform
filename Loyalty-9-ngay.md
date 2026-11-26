# Kế hoạch 9 ngày · Hikari Loyalty

**Mốc giả định:** bắt đầu 26/11/2026, kết thúc 04/12/2026, tính cả cuối tuần. Ngày 7 demo nội bộ trên điện thoại. Hai ngày cuối dành cho hồi quy, sửa lỗi và bàn giao. Kế hoạch dựa trên rà soát mã nguồn từ xa, chưa chạy baseline và chưa xác minh quyền tài khoản Zalo.

## Đầu ra

Một installation Hikari có hai chi nhánh. Khách mở bản Testing từ QR, liên kết hội viên và thấy thẻ 1/5. Thu ngân A ghi nhận đơn thanh toán mock gồm ba latte và hai bánh. Khách mở lại thấy 4/5. Mua thêm một latte thì nhận đúng một voucher đổi ly. Nhân viên B có thể đổi voucher toàn chuỗi tại B nhưng chỉ xem đơn thuộc phạm vi được phân công. Backend trả kết quả thật từ MySQL.

## Điểm xuất phát đã kiểm tra trên main

| Nguồn | Hiện trạng | Hành động |
|---|---|---|
| [README](https://github.com/jack1e2401/loyalty-platform/blob/main/README.md) | Một merchant/installation, MySQL riêng, mock payment/refund. | Thêm chi nhánh bên trong installation. |
| [Schema](https://github.com/jack1e2401/loyalty-platform/blob/main/apps/backend/prisma/schema.prisma) | 36 model. OrderItem có productId và quantity. MemberVoucher đã có snapshot. ChallengeProgressEntry chống trùng theo progressId/activityId. ChallengeRewardGrant yêu cầu earnTransactionId kiểu điểm. | Giữ chi tiết dòng hàng và chống trùng. Thiết kế liên kết cấp voucher cho thẻ dấu, tránh tạo giao dịch điểm giả. |
| [Middleware](https://github.com/jack1e2401/loyalty-platform/blob/main/apps/backend/src/middleware/auth.ts) | authenticate kiểm tra user, trạng thái tài khoản và merchant. requireRole kiểm tra một role. | Bổ sung quyền nghiệp vụ và phạm vi chi nhánh, giữ kiểm tra trạng thái tài khoản. |
| [Seed](https://github.com/jack1e2401/loyalty-platform/blob/main/apps/backend/prisma/demo-seed.ts) | Đã có Hikari, latte, bánh và hội viên. Seed giới hạn database local/test. | Dùng DB mới đúng điều kiện seed, bổ sung hai chi nhánh, nhân viên, thẻ và quà. |
| [Frontend](https://github.com/jack1e2401/loyalty-platform/blob/main/apps/frontend/package.json) · [scripts](https://github.com/jack1e2401/loyalty-platform/blob/main/package.json) | React/Vite, Ant Design, Vitest, Playwright, Node test và MySQL integration. | Tái dùng CMS, API client, bộ test và scripts hiện hành. |

## Lịch thực hiện

| Ngày | Phát triển | Bằng chứng kết thúc ngày |
|---|---|---|
| 1 · 26/11 | Ghi commit gốc và trạng thái test. Dựng DB local mới, chạy seed Hikari. Rà 36 model theo bốn cụm, ghi giữ/gộp/bỏ, nơi đọc/ghi và unique/FK. Đồng thời thử Mini App ID riêng, mở trên điện thoại, gọi API thử qua HTTPS; kiểm tra tài khoản test và khả năng xác thực. | Có baseline, bảng quyết định model, QR mở được hoặc ghi chính xác bước bị chặn và người phụ trách. |
| 2 · 27/11 | Refactor một lát nhỏ đã xác minh. Ưu tiên xem xét ChallengeMilestone vào Prisma Json nếu chỉ đọc cùng challenge. Nếu gộp, kiểm tra schema JSON, thứ tự và ngưỡng duy nhất tương đương constraint cũ. Rà tier/reset, policy version, voucher snapshot, wallet và inventory; ghi lý do cho từng ngoại lệ quá bốn bảng. Chốt model Branch, phân công và liên kết đơn. | Migration chạy trên DB mới, seed dựng lại, kiểm tra checkout → điểm → voucher → refund cùng API cũ. Nếu một phép gộp gây lỗi nghiệp vụ, giữ bảng và ghi lý do. |
| 3 · 28/11 | Thêm branch và phân công nhân viên, gắn branchId cho đơn tại quầy. Owner toàn installation; manager một/nhiều chi nhánh; cashier một chi nhánh. Dùng guard backend cho danh sách, chi tiết, thao tác đơn và đổi voucher. Trả capabilities để FE dựng menu. | Seed có owner, manager A+B, cashier A và cashier B. Test cho phép đúng phạm vi, chặn truy cập trực tiếp khác chi nhánh, chặn analytics/config với cashier. |
| 4 · 29/11 | Tính dấu trong luồng hoàn tất thanh toán hiện có, cộng tổng quantity của dòng đủ điều kiện. Lưu số dấu thực cấp cho đơn để đảo khi hoàn tất refund. Cập nhật tiến độ và phát voucher theo chu kỳ trong cùng transaction, có khóa duy nhất chống cấp trùng. | Từ 1/5, ba latte + hai bánh thành 4/5; retry giữ 4/5. Đơn kế tiếp +1 phát đúng một voucher. Test hai đơn đồng thời và đơn vượt một mốc. |
| 5 · 30/11 | Hoàn thiện thao tác tại quầy: chọn hội viên, ghi nhận đơn đúng chi nhánh, tra mã, đổi quà. CMS owner cấu hình sản phẩm hợp lệ và quà, xem chương trình bằng bảng Ant Design; chỉnh đúng trang danh sách chính sách và tái sử dụng form hiện có. | Thu ngân B đổi voucher toàn chuỗi cho đơn B. Hai lần đổi đồng thời chỉ một lần thành công. Owner sửa cấu hình không đổi điều khoản voucher đã phát. |
| 6 · 01/12 | Nối Mini App với API session, membership và thẻ dấu. Tái sử dụng component thẻ trên storefront; xác thực token ở backend. Liên kết hội viên demo qua đăng nhập hiện có và xác nhận liên kết nếu quyền số điện thoại chưa sẵn sàng. Chặn liên kết nhầm/lặp danh tính. Bổ sung safe-area, trạng thái tải, thẻ trống, lỗi và thử lại. | Hai hội viên thấy đúng thẻ của mình trên điện thoại. Từ chối chia sẻ số điện thoại vẫn có đường vào qua tài khoản hiện có; ghi rõ cơ chế đã kiểm thử. |
| 7 · 02/12 | Demo tích hợp qua QR trên bản Testing. Dùng tài khoản staff thật trong seed, backend thật, thanh toán mock. Thử luồng từ 1/5 đến phát và đổi quà ở B. Kiểm tra API trả dữ liệu mới sau khi mở lại thẻ. | Chốt phiên bản ứng viên và ghi video demo ngắn. Nếu vướng quyền Zalo, minh họa phần chạy được, ghi rõ điều kiện còn thiếu, chưa đánh dấu đạt mục tiêu Zalo. |
| 8 · 03/12 | Chạy unit, MySQL integration, E2E web và test thủ công trên Zalo. Tập trung revoke quyền, replay sự kiện, đồng thời, refund, voucher đã dùng và nhiều chu kỳ. Sửa lỗi ảnh hưởng số dư, quà, quyền hoặc liên kết hội viên trước. | Kết quả test gắn commit, đối chiếu sổ điểm, voucher và dấu trước/sau; mọi lỗi còn lại có mức ảnh hưởng. |
| 9 · 04/12 | Dựng lại từ DB trống, chạy lại demo trên điện thoại, bàn giao QR Testing, tài khoản theo vai trò, cách seed, permission matrix, quyết định schema và hướng dẫn tái hiện. | Người thứ hai chạy lại từ hướng dẫn và thấy đúng 1/5 → 4/5 → nhận quà → đổi một lần. Ghi danh sách giới hạn và backlog. |

## Quy tắc đề xuất cần đóng trước khi viết engine ngày 4

- Mỗi 5 dấu phát một voucher; giữ số dư cho chu kỳ sau. Từ 4 dấu mua 7 ly hợp lệ sẽ phát 2 voucher và còn 1 dấu. Ly đổi miễn phí không sinh thêm dấu. Chọn sản phẩm/phân loại theo cấu hình có hiệu lực lúc thanh toán.
- Refund dùng số dấu đã ghi theo đơn. Nếu sau hoàn không còn đủ điều kiện, thu hồi quà chưa dùng. Với quà đã dùng, đề xuất ghi thiếu dấu để bù lần sau, giữ lịch sử đổi. Chủ sản phẩm xác nhận chính sách này trước khi triển khai.
- Phiếu POS chỉ có tổng tiền chưa đủ thông tin tính dấu theo ly. Luồng demo dùng OrderItem của checkout/quầy hiện có, không phụ thuộc iPOS.
- Hạng, ví và ledger có vòng đời khác nhau. Dùng Json của MySQL cho config đọc nguyên khối khi có lý do; giữ Decimal, FK và unique cho nghiệp vụ cần đối soát. Mục tiêu 4 bảng là mềm; mọi bảng vượt mục tiêu phải có truy vấn hoặc luồng cụ thể chứng minh.
- Owner duyệt refund và chỉnh loyalty; manager vận hành chi nhánh được phân công; cashier chỉ dùng quầy. Endpoint thay đổi trạng thái kiểm tra cả quyền và branch của tài nguyên. Khi quản lý nhiều chi nhánh, thông tin tổng hợp chỉ lấy trên tập chi nhánh được cấp.

## Phân công nếu dùng nhiều agent

Một người sở hữu Prisma, migration và seed suốt sprint; nhận yêu cầu model từ nhóm RBAC, stamp và Zalo trước migration. Backend sở hữu transaction, permission và contract. Frontend sở hữu CMS/storefront và dùng cùng contract. Người cầm điện thoại chịu trách nhiệm đăng nhập tài khoản Zalo, xác nhận quyền truy cập và quay demo. Agent QA dùng fixture chung và kiểm tra DB sau mỗi luồng. Chốt hợp đồng ngày 2; tích hợp mỗi ngày.

## Lệnh nghiệm thu từ root

Dùng Node >=22.12, cấu hình env theo README của repo. Trên DB local/test mới đúng điều kiện demo seed, chạy lần lượt npm ci, npm run seed, npm run typecheck, npm run build, npm test, npm run test:db, npm run test:e2e. Mở API thật cho E2E cần backend. Playwright kiểm tra web; QR, xác thực và safe-area cần kiểm tra riêng trên điện thoại.

## Thứ tự cắt phạm vi khi trễ

Giữ RBAC tại API, đúng số dấu, chống phát/đổi trùng, liên kết đúng hội viên và demo điện thoại. Thu hẹp refactor xuống các bảng đã chứng minh lợi ích; giảm số màn hình chỉnh giao diện. Streak × hệ số vào sprint kế với quy tắc ngày theo múi giờ merchant và dùng hệ số một lần. Lucky Wheel/Mystery Box triển khai sau khi có transaction giữ tồn/quỹ quà và xử lý retry. Chuyển toàn bộ storefront sang Zalo và phát hành công khai là mốc riêng.

Tài liệu chính thức Zalo: [Development/Testing và QR](https://docs.zaloplatforms.com/docs/MA/devtools/ide/deploy) · [Simulator/Device](https://docs.zaloplatforms.com/docs/MA/devtools/ide/start) · [quyền truy cập thông tin người dùng](https://docs.zaloplatforms.com/docs/MA/intro/request-permission).
