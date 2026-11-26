# Đối chiếu Zalo Mini App và Antavo cho R&D loyalty

Đối chiếu tài liệu chính thức ngày 19/11/2026.

## Zalo Mini App cho chiến dịch marketing

- Zalo đưa mini game, biểu mẫu thu thông tin, tích điểm đổi quà, quét QR nhận thưởng và ví quà vào nhóm giải pháp chiến dịch. Người dùng mở Mini App ngay trên Zalo. Official Account (OA) là kênh nhắn tin và tương tác có thể dùng cùng Mini App. [Zalo Digital Engagement](https://miniforbusiness.zalo.me/solutions/digital-engagement)
- Trong chiến dịch Highlands Coffee, khách dùng mã trên hóa đơn và QR tại cửa hàng để vào Mini App, chơi game rồi nhận voucher qua OA. Chiến dịch còn dùng ZNS và nền tảng dữ liệu khách hàng. Zalo báo cáo hơn 2 triệu người mở app và tỷ lệ chuyển đổi thành dữ liệu định danh 56,9% trong 40 ngày. Đây là số liệu của cả chiến dịch. Tác động riêng của mini game lên tỷ lệ mua lại vẫn chưa được xác định từ case này. [Case study Highlands Coffee do Zalo công bố](https://miniforbusiness.zalo.me/case-study/highlands-coffee-tang-ti-le-chuyen-doi-voi-chien-dich-phat-voucher-tren-zalo-mini-app)

## Antavo cho cấu hình và vận hành thử thách

- Challenges theo dõi sự kiện có sẵn hoặc tùy chỉnh, tính tiến độ theo số lần hoặc tổng giá trị, và lọc theo thuộc tính sự kiện. Người vận hành đặt thời gian, đối tượng đủ điều kiện, điểm thưởng, chu kỳ lặp và số lần hoàn thành tối đa. Khi đạt ngưỡng, hệ thống có thể cấp điểm hoặc kích hoạt workflow. Display API cung cấp danh sách thử thách theo hội viên. [Antavo Challenges](https://antavo.com/product/loyalty-engine/features/challenges/) · [Hướng dẫn cấu hình](https://docs.antavo.com/engine/docs/challenges#criteria) · [Display API](https://developers.antavo.com/reference/get_v2-customers-customer-id-activities-challenges)
- Management UI hỗ trợ chỉnh sửa, nhân bản cấu hình, tắt, lưu trữ và xem thống kê theo thử thách. Tác vụ nhân bản mở trình chỉnh sửa cho bản mới. Chu kỳ hoàn thành lặp lại của một hội viên là cấu hình riêng trong thử thách. [Nhân bản thử thách](https://docs.antavo.com/engine/docs/challenges#clone-a-challenge) · [Chu kỳ lặp](https://docs.antavo.com/engine/docs/challenges#gamification) · [Thống kê](https://docs.antavo.com/engine/docs/challenges#challenge-statistics)
- Hạng thành viên và bảng xếp hạng giải quyết hai nhu cầu riêng. Tier Manager dùng ngưỡng để xác định hạng, tách điểm xét hạng khỏi điểm đổi thưởng và ghi nhận từng lần thay đổi điểm xét hạng. Tài liệu Leaderboard cũ mô tả việc xếp hội viên theo số dư điểm và hiện được Antavo đánh dấu deprecated. [Antavo Tier Manager](https://docs.antavo.com/docs/tier-manager) · [Antavo Leaderboard](https://docs.antavo.com/docs/leaderboard)

## IncomSG đã có gì

- Merchant có thể tạo nhiệm vụ theo số đơn đã thanh toán, tổng chi tiêu hoặc điểm danh. Mục tiêu, thưởng cuối, thời hạn, ngân sách và mốc tiến độ đều có thể cấu hình. Trang chi tiết đã có số hội viên đang làm, đã nhận thưởng, đang chờ ngân sách và lịch sử cấp thưởng gần đây. Rà soát menu và API hiện tại chưa thấy thao tác nhân bản. [API nhiệm vụ](../../apps/backend/src/modules/challenges/challenges.routes.ts) · [Trình chỉnh sửa](../../apps/frontend/src/features/merchant/challenges/MerchantChallengeEditorPage.tsx) · [Menu thao tác](../../apps/frontend/src/features/merchant/challenges/MerchantChallengeActions.tsx) · [Chi tiết chiến dịch](../../apps/frontend/src/features/merchant/challenges/MerchantChallengeDetailPage.tsx)
- Merchant đã chỉnh được ngưỡng xét hạng và hệ số tích điểm của bốn hạng cố định. API có xem trước và lịch sử công bố chính sách. Mở quyền thêm, bỏ hoặc thay đổi cơ chế xét hạng cần quyết định cách áp dụng lên hội viên hiện tại và cách xử lý hoàn tiền. [Ràng buộc cấu hình hạng](../../apps/backend/src/modules/loyalty/loyalty.validation.ts) · [API chính sách](../../apps/backend/src/modules/loyalty/loyalty.routes.ts)

## Đề xuất cho tuần 23–27/11/2026

Dành khoảng một ngày khảo sát hai hướng. Dùng bốn ngày còn lại để tìm hiểu cách merchant tự vận hành một chiến dịch mua lại. Đề xuất này giả định mục tiêu gần nhất là giúp merchant chạy loyalty thường xuyên. Nếu mục tiêu đã giao là tăng lượt tiếp cận hoặc thu khách hàng mới, mini game kiểu chiến dịch Zalo là hướng cần khảo sát sâu hơn.

1. **Thứ Hai** — Vẽ hành trình từ khách tiếp cận, thực hiện hành vi, nhận thưởng đến quay lại. Đánh dấu phần Zalo giải quyết và phần Antavo hỗ trợ. Chọn một kịch bản xuyên suốt, ví dụ mua 3 đơn trong 14 ngày để nhận 15 điểm.
2. **Thứ Ba–Tư** — Đi qua luồng IncomSG hiện tại, từ merchant tạo nhiệm vụ đến member đạt mục tiêu và merchant xem ngân sách. Nếu có thể, cho một merchant hoặc người phụ trách vận hành thử tạo lại chiến dịch cho kỳ sau. Ghi thời gian, số trường phải nhập lại và chỗ dễ sai, rồi xác nhận việc lặp lại này có xảy ra trong thực tế hay không.
3. **Thứ Năm–Sáu** — Viết đề xuất một trang và demo lại luồng. Nếu merchant xác nhận thường xuyên chạy lại chiến dịch, milestone đầu tiên là **Nhân bản nhiệm vụ thành bản nháp**. Bản nháp chỉ mang cấu hình được chọn. Merchant rà lại lịch, mục tiêu, phần thưởng và ngân sách trước khi chủ động kích hoạt. Tiến độ hội viên, lịch sử cấp thưởng và ngân sách đã dùng thuộc chiến dịch gốc.

Đánh giá đề xuất bằng thời gian tạo chiến dịch kỳ sau và số lỗi nhập lại so với luồng hiện tại. Trong một đợt thử với dữ liệu thật, theo dõi riêng tỷ lệ mua lần hai trong cửa sổ đã chọn. Kết luận về mức tăng do chiến dịch cần nhóm so sánh phù hợp. Nhu cầu lặp chiến dịch và tác động lên mua lại vẫn là giả thuyết cần kiểm chứng.
