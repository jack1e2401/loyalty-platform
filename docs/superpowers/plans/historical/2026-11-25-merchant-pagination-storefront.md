# Storefront và phân trang Merchant

1. Giữ Merchant trong Storefront khi mở trang Member. Hiện hộp thoại đổi tài khoản và duy trì đích điều hướng. Mở bản nháp và công khai ở tab mới.
2. Tạo component phân trang dùng chung với page, limit, totalItems và totalPages. Mặc định 20, lựa chọn 10/20/50, reset về trang 1 khi đổi lọc.
3. Chuyển từng danh sách Merchant và bảng chi tiết sang page/limit. Truy vấn, lọc, sắp xếp và đếm tại database. Giữ tương thích các API cursor hiện hữu.
4. Kiểm tra role, thay đổi bộ lọc, trang rỗng, giới hạn, tính đúng tổng số và dữ liệu biên bằng unit/integration test.
