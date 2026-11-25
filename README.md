# IncomSG Loyalty Commerce

Ứng dụng thương mại và loyalty dành cho một cửa hàng trong mỗi installation. Mỗi installation dùng database riêng; `Merchant` là cấu hình gốc cho cửa hàng. Frontend React/Vite ở [apps/frontend](apps/frontend), API Express và Prisma ở [apps/backend](apps/backend).

## Chạy local

Dùng Node.js 22.12 trở lên. Từ thư mục gốc, chạy `npm ci` để cài dependencies cho cả hai app. Tạo database MySQL riêng và cấu hình `apps/backend/.env` theo [hướng dẫn backend](docs/backend/README.md), bao gồm credentials của merchant owner. Mỗi installation có member identities và lịch sử commerce riêng trong database đó.

```sh
npm ci
npm run dev:backend
# Mở terminal thứ hai tại IncomSG
npm run dev:frontend
```

Frontend mặc định ở `http://localhost:5173`, API ở `http://localhost:3000`. Thanh toán dùng Mock flow do backend xác nhận; refund do merchant review và là cập nhật tổng hợp, không chuyển tiền thật. Xem [hướng dẫn frontend](docs/frontend/README.md) để cấu hình frontend cho installation.

## Kiểm thử

| Lệnh tại thư mục gốc | Bộ test |
| --- | --- |
| `npm test` | Unit test FE và BE |
| `npm run test:frontend` | Vitest tại `tests/frontend/unit` |
| `npm run test:backend` | Node test tại `tests/backend/unit` |
| `npm run test:db` | Integration test tại `tests/backend/integration`, cần MySQL đã áp migration |
| `npm run test:e2e` | Playwright tại `tests/frontend/e2e`, tự khởi động Vite |

Cài Chromium cho Playwright bằng `npx playwright install chromium`. Các bộ E2E riêng có thể chạy qua scripts `test:e2e:m2`, `test:e2e:commerce`, và `test:e2e:ux` trong workspace frontend. Các ca gọi HTTP thật cần API local chạy trên database test đã migrate và cấu hình installation bootstrap tương ứng.

`npm run typecheck` và `npm run build` chạy cho cả hai app. [AGENTS.md](AGENTS.md) chứa quy ước làm việc. [docs/superpowers](docs/superpowers) chứa các plan và spec của dự án.
