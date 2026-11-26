# Kế hoạch triển khai Tier System v1

**Mục tiêu** — Merchant publish hạng động, hội viên lên hạng từ điểm thực tế, chuyển mùa thủ công và thấy thẻ mới sau khi tải lại. Ví điểm, ledger và snapshot giao dịch được bảo toàn.

**Kiến trúc** — Reuse `LoyaltyTier.level`, `MerchantMembership.tierId` và `qualificationProgress`. Backend dùng chung bộ xét hạng cho ghi, đọc và preview. Mùa chỉ đổi phạm vi xét hạng, còn payment/refund tiếp tục đi qua luồng hiện tại.

**Stack và phạm vi** — Express, Prisma/MySQL, React, localhost. Đặc tả là yêu cầu Tier System v1 ngày 23/11/2026. Dùng migration tiến tới, không reset DB. Giữ các màn hình transaction, history và member đang hoạt động. Không mở rộng Zalo Mini App, POS/iPOS, e-commerce hoặc cổng thanh toán. Không push, merge hay deploy.

## Mốc xuất phát

Checkout `D:\.Learn\IncomSG` đang ở `main`, HEAD `d6a0ee1`, trước `origin/main` 9 commit. `origin` là `jack1e2401/incomsg`, khác slug `jack1e2401/loyalty-platform` trong brief. Kế hoạch bám checkout được chỉ định. Xác nhận repo đích nếu brief thực sự chỉ repo khác trước khi thay đổi code. Working tree có sửa đổi ở commerce, refund/reset, tests, lockfiles và một migration backfill chưa track. Giữ nguyên các thay đổi sẵn có và kiểm tra lại status/staged trước mỗi commit.

| Model | Hiện trạng và tác động |
| --- | --- |
| `LoyaltyTier` | `level` đã là `VARCHAR(64)`, unique theo merchant. Đã có ID ổn định, tên, màu, icon, benefits, multiplier Decimal và `isActive`. Dùng `level=default` làm mã hạng mặc định, bổ sung `backgroundImageUrl` nullable. |
| `MerchantMembership` | Đã có `tierId` và `qualificationProgress Decimal(38,12)`. Dùng progress làm điểm xét hạng hiện hành, thêm `seasonFloorTierId` nullable cho Soft Reset. Giữ `lastResetCycleYear` cho luồng cũ. |
| `LoyaltyWallet` | `exactBalance` và `netLifetimeEarned` là hai giá trị Decimal riêng. Rollover không ghi vào model này. |
| `PointTransaction` | Có `eventRef` unique, `promotedToTier` dạng chuỗi, liên kết order và challenge. Bổ sung `qualificationSeasonId` và `qualificationDelta` nullable cho giao dịch tích điểm mới. Không cập nhật transaction cũ. |
| `LoyaltyPolicyVersion` | Có snapshot JSON theo `(merchantId, version)` và liên kết order. Snapshot mới bổ sung metadata hạng và `qualificationMode` nullable trên version để giữ nguyên cách đọc bản cũ. |

### Dependency hạng cố định và các luồng cần chạm

| Nơi | Việc cần làm |
| --- | --- |
| `apps/backend/prisma/schema.prisma`, migration `20261122120000_dynamic_loyalty_tiers` | `enum TierLevel` đã không còn được model dùng. Có thể bỏ khai báo dư nếu schema diff xác nhận không phát sinh DDL. Các migration lịch sử vẫn cần mã enum cũ để dựng DB từ đầu. |
| `loyalty.config.ts`, `loyalty.membership.ts`, `loyalty.read.ts`, `customers.service.ts`, `orders.repository.ts` | `defaultTiers` chứa bốn hạng. `loadEarningPolicy` thử upsert cả bộ khi không còn hạng active, còn các đường đọc fallback cùng bộ. Thay toàn bộ fallback bằng một default duy nhất. Checkout hiện tại đã chấp nhận số lượng động, kể cả 1 và trên 4. |
| `apps/backend/prisma/seed.ts`, `demo-seed.ts` | Bootstrap và demo đang gắn bốn mã. Bootstrap chỉ tạo default cho merchant mới, demo chỉ dùng danh sách riêng cho fixture rõ ràng và không hồi sinh cấu hình thật khi chạy lại. |
| `loyalty.calculation.ts`, `loyalty.types.ts`, `loyalty.membership.ts`, `loyalty.read.ts`, `loyalty.service.ts`, `orders.types.ts`, `customers.types.ts`, frontend `api/contracts/{loyalty,orders}.ts`, `api/commerce-types.ts`, `BackendMerchantLoyaltyPage.tsx` | Đây là alias `TierLevel = string` hoặc consumer của alias, các kiểu này đã nhận mã động. Giữ nguyên shape `level` và `promotedToTier` để tương thích API. |
| `loyalty.earning.ts`, `loyalty.reversal.ts`, `challenges.rewards.ts`, `challenges.engine.ts`, `customers.domain.ts`, `loyalty.read.ts`, `loyalty.membership.ts`, `orders.repository.ts` | Tất cả nơi ghi hoặc tự suy ra hạng. Chuyển sang bộ xét hạng dùng chung, cả preview multiplier và preview refund. Nếu bỏ sót đường đọc, thẻ có thể tụt hạng ngay sau Soft Reset. |
| `loyalty.tier-reset.ts`, `loyalty.tier-reset.domain.ts`, `TierResetRun`, frontend `api/commerce/loyalty.ts` | Reset năm hiện tại nhận `ONE_DOWN`/`SELECTED`, dùng khóa merchant/năm, có thể đưa progress về ngưỡng hạng. Thêm API mùa riêng và chặn reset năm sau khi merchant vào chế độ mùa. |
| `MemberLoyaltyPolicyDialog.tsx`, `MemberLifetimeTierChart.tsx`, `MerchantStoreDetails.tsx`, `api/{types,mock}.ts`, `features/merchant/legacy/MerchantLoyaltyPage.tsx` | Có map tên/màu hoặc kiểu bốn hạng. UI đang hoạt động đọc metadata backend. Giữ fallback hiển thị cho snapshot cũ thiếu metadata. Rà router để tách code mock/legacy khỏi đường sản phẩm, giữ fixture lịch sử cần thiết. |
| `tests/backend/integration/milestone-4.integration.test.ts` và fixtures loyalty/order/refund/history | Có assert đúng 4 hạng và dữ liệu uppercase. Thay assert số lượng bằng payload động hoặc test bootstrap đúng 1. Giữ fixture uppercase kiểm tra snapshot/ledger cũ. |

## Quyết định đề xuất để triển khai

- Dùng `level` làm mã ổn định trong API, sửa tên hiển thị độc lập. Giữ mã ẩn để bảo toàn tham chiếu và ngăn tái sử dụng. So tên theo trim và không phân biệt hoa thường. Trong cấu hình dự định publish, ngưỡng POINTS nguyên không âm theo schema hiện hành, tăng nghiêm ngặt, default đúng 0. Giữ unique mã ở DB, kiểm tra names/ngưỡng sau khi gộp với hạng ẩn trong transaction khóa theo merchant. Hạng bị ẩn được giữ để audit và có thể hiện lại. Khi hạng đạt hoặc floor bị ẩn, xét bằng danh sách active và fallback về hạng hợp lệ từ điểm, tối thiểu default. Ghi lại floor cũ trong lịch sử rollover.
- Wizard dùng `POINTS`. Giữ support `SPEND` của API và dữ liệu hiện có. Nếu merchant legacy `SPEND` mở Wizard, yêu cầu xác nhận chuyển đổi rõ ràng và cấu hình ngưỡng điểm trước khi kích hoạt mùa đầu. Không tái diễn giải tiến độ chi tiêu hiện hữu thành điểm hoặc tự đặt tiến độ về 0 khi chỉ publish. Chuyển chế độ khi mở mùa đầu với reset rõ ràng, hoặc giữ nguyên legacy đến khi merchant quyết định.
- Ngày lịch nhập theo `Asia/Ho_Chi_Minh`, API quy đổi khoảng `[startAt, endAt)`. Dùng `DRAFT`, `ACTIVE`, `CLOSED`, chuyển trạng thái thủ công. `ACTIVE` xác định mùa ghi nhận điểm đến lần rollover thành công để giao dịch trong khoảng chờ thao tác vẫn có mùa rõ ràng. Wizard publish cấu hình và draft. Rollover chỉ khi tới thời điểm bắt đầu mùa đích và mùa hiện tại đã tới ngày kết thúc. Mùa đầu chuyển từ legacy bằng reset được merchant xác nhận. `resetPolicy` của mùa đích áp dụng lúc vào mùa đó. Các quyết định về mốc ngày và hành vi chọn chế độ là đề xuất cần ghi nhận khi chốt contract.
- Có hai cách lưu lịch sử. Tận dụng `TierResetRun` và nhét kết quả hội viên vào JSON giảm một migration nhưng gắn chặt với khóa năm và khó ràng buộc lịch sử từng member. Chọn hai bảng `LoyaltySeason` và `LoyaltySeasonResetResult` để có một hàng cho mỗi mùa và một kết quả cho mỗi membership, giữ lịch sử annual cũ nguyên vẹn. Không cần bảng điểm mùa riêng vì `qualificationProgress` đã lưu điểm hiện hành.

## M0 — Chuẩn bị và xác minh migration · 0–25 phút

- [ ] Chốt baseline của phần đang sửa dở, nhất là `20261123100000_backfill_qualification_progress/migration.sql`. SQL hiện gán `qualificationProgress = netLifetimeEarned` trên mọi ví đã có membership. Kiểm tra migration đã apply ở DB test chưa và đối chiếu bản ghi đã reset, từng tích theo `SPEND`, có progress hiện hành, hoặc có lịch sử giao dịch sau ngày thêm cột. Không apply một bản backfill ghi đè các trường hợp đó. Chỉ khôi phục progress khi đủ bằng chứng về chế độ và thiếu dữ liệu ban đầu. Nếu đã apply, giữ checksum và lập sửa chữa tiến tới dựa trên dữ liệu có thể kiểm chứng. Trường hợp thiếu bằng chứng phải được báo cáo trước khi tiếp tục.
- [ ] Chuẩn bị Node và dependency từ root. Hiện `package-lock.json` bị xóa trong working tree, cần xác định thay đổi đó trước `npm ci`. Dùng DB test localhost được script chấp nhận (`incomsg-test` hoặc `incomsg_testdb_*`). Chạy `npm run test:db -- --migrate-only` sau khi xác nhận migration đầu vào an toàn. Chuẩn bị DB sạch và bộ dữ liệu legacy để thử upgrade. Không chạy reset DB. So sánh tier IDs, membership IDs, progress, snapshot cũ, số dư và ledger trước/sau.
- [ ] Chạy baseline payment/refund qua `npm run test:db -- --test-file exact-points.integration.test.ts` và `npm run test:db -- --test-file milestone-3-4-lifecycle-refund.integration.test.ts`. Dùng dữ liệu có hồi quy đã biết để ghi nhận chênh lệch trước khi thêm mùa.

## M1 — Hạng động, publish và earn · 25–105 phút

**File chính** — `schema.prisma`, migration mới, `prisma/seed.ts`, `loyalty.{config,validation,types,calculation,membership,read,earning}.ts`, các consumer `defaultTiers` ở bảng trên và `apps/frontend/src/api/contracts/loyalty.ts`.

- [ ] Viết test trước cho cấu hình chỉ có default, 5 hạng gồm `vip`, hide rồi reload/earn/seed lại, mã hoặc tên trùng, ngưỡng trùng, default bị thiếu/ẩn, multiplier sai và merchant scope. Thêm fixture legacy có một hạng đang được tham chiếu và một policy snapshot cũ.
- [ ] Migration tiến tới bổ sung `backgroundImageUrl` và version metadata nullable. Kiểm kê default/duplicate theo từng merchant. Tạo hoặc sửa default tại chỗ nếu có đủ bằng chứng, giữ nguyên IDs/mã legacy đã publish, dừng khi có xung đột chưa rõ cách ánh xạ. Giữ tất cả các hạng được merchant cấu hình và không sửa snapshot đã lưu. Bootstrap merchant mới chỉ khởi tạo một default active, ngưỡng 0. Tách các đường đọc chỉ cần danh sách khỏi khởi tạo để GET không ghi dữ liệu.
- [ ] Mở rộng `GET/PUT /api/merchant/loyalty` với metadata hạng, trạng thái active/hidden và lỗi có `field`, `tierIndex`, `code`. GET cấu hình trả được hạng ẩn để sửa/hiện lại, read path của member chỉ dùng tier active để xét hạng. Tiếp tục nhận payload cũ, hiểu hạng bị bỏ khỏi payload cũ là ẩn. Publish gồm validate, update, tạo snapshot bất biến trong một giao dịch, dùng lock merchant và mức phiên bản để tránh mất thay đổi khi publish đồng thời. So sánh cả metadata và hidden state để gửi lại payload không tạo version thừa. Policy history và order snapshot cũ vẫn đọc được.
- [ ] Chốt bộ xét hạng trả tier cao nhất đủ điểm trên danh sách active theo Decimal. Tính multiplier từ hạng hiệu lực **trước** khi ghi điểm, cập nhật tier hiệu lực **sau** khi ghi điểm trong transaction payment. Áp dụng chung cho read/preview và challenge. Chỉ chỉnh những bên tiêu thụ hạng, giữ shape của `promotedToTier`, quy đổi VND, làm tròn và audit payment.
- [ ] Chạy unit backend/frontend, integration mục tiêu, typecheck và build. Kiểm tra migration/backfill trước khi stage. Commit milestone khi đạt tiêu chí, đề xuất `feat(loyalty): complete dynamic tier publishing`.

## M2 — Mùa, rollover và refund · 105–195 phút

**File chính** — `schema.prisma`, migration mới, `loyalty.seasons.ts` và phần validate/route/service tương ứng, `loyalty.{earning,reversal,read,membership,calculation}.ts`, `orders.repository.ts`, `refunds.complete.ts` nếu cần thêm lock ở entry point, `challenges.{rewards,engine}.ts`.

- [ ] Thêm `LoyaltySeason` có merchant, tên, khoảng ngày, `resetPolicy`, trạng thái, `startedAt`/`closedAt`, policy version khi mở mùa, và unique `(merchantId, activeSlot)` với `activeSlot=1` cho `ACTIVE`, `NULL` cho các hàng khác. Thêm `LoyaltySeasonResetResult` unique `(seasonId, membershipId)`, lưu hạng trước/sau và progress trước reset, giữ thông tin hiển thị lịch sử qua policy version. Thêm `seasonFloorTierId` cho membership và provenance nullable cho `PointTransaction`. Tất cả membership/season/tier lookups đều scoped cùng merchant. Không suy diễn mùa cho ledger cũ trong migration.
- [ ] API dự kiến `GET /api/merchant/loyalty/seasons`, `POST /api/merchant/loyalty/seasons/:seasonId/rollover` với `expectedCurrentSeasonId` nullable. `PUT /api/merchant/loyalty` lưu draft mùa trong cùng transaction publish, dùng draft ID ổn định để retry không tạo thêm mùa. Từ chối sửa lịch/reset policy của mùa đã kích hoạt. API trả season, số membership đã xử lý và `alreadyProcessed`. Replay cùng seasonId trả kết quả đã lưu kể cả sau khi mùa đó đóng. Yêu cầu stale hoặc mùa của merchant khác bị từ chối.
- [ ] Rollover dùng một Prisma transaction, khóa cùng một hàng `Merchant` cho publish, activate, payment/earn, hoàn tiền, challenge cấp/thu hồi và membership creation khi thao tác có thể giao nhau. Lấy lock trước khi đọc policy/mùa/membership và thống nhất thứ tự khóa tại entry point. Dùng retry transaction hiện có cho deadlock. Trong transaction, đóng mùa cũ, mở mùa đích, chụp kết quả mỗi membership, ghi progress `0`. `HARD` đặt tier mặc định và xóa floor. `SOFT` lấy một bậc dưới hạng hiệu lực trên danh sách active và lưu tier đó làm floor. Bộ xét hạng lấy mức cao hơn giữa hạng đủ điểm và floor active, kể cả tại progress `0`; khi đủ điểm lên bậc cao hơn bình thường. New member của mùa có floor mặc định. Ví và ledger không nhận ghi từ rollover.
- [ ] Tại thời điểm cấp điểm thành công, ghi ID mùa và exact qualification delta vào dòng earn/challenge grant mới. Khi refund, giữ flow reverse ví, trạng thái order và ledger hiện tại. Chỉ giảm rank progress nếu provenance của grant trùng mùa đang active, dùng delta gốc và clamp về `0`. Giao dịch legacy có provenance `NULL` tiếp tục nhánh tương thích cũ trước khi dùng mùa. Sau lần chuyển mùa đầu, các giao dịch legacy không trừ điểm xét hạng mùa mới. Dùng cùng phép tính ở preview và lúc hoàn tiền thật. Áp dụng theo từng grant cho challenge reversal đi kèm refund.
- [ ] Kiểm thử HARD/SOFT, floor ở `0` và sau earn/refund/reload, hai request rollover đồng thời, replay sau khi đóng mùa, lỗi giữa vòng reset rollback toàn bộ, và payment/refund song song rollover. So sánh ảnh chụp wallet/ledger trước sau và refund đơn trước/trong mùa. Dùng test hai merchant ở tầng DB/service và API owner-scoped nếu fixture hỗ trợ, vì runtime bootstrap hiện thiết kế một merchant trên mỗi installation. Chạy `npm run test:db` và checks của M1. Commit sau xác minh, đề xuất `feat(loyalty): add transactional season rollover`.

## M3 — Wizard, Member Card và kiểm thử trực tiếp · 195–240 phút

**File chính** — `BackendMerchantLoyaltyPage.tsx` và các step component gần feature, `api/commerce/loyalty.ts`, `api/contracts/loyalty.ts`, `LoyaltyWalletContent.tsx` và `MemberTierCard.tsx` đơn giản.

- [ ] Step 1 trạng thái, điều kiện tích lũy điểm, tên và ngày mùa, HARD/SOFT. Giữ tỷ lệ VND/điểm hiện hành trong hợp đồng publish. Step 2 thêm, chỉnh sửa, ẩn/hiện hạng theo thứ tự, bảo vệ default, nhận tên/ngưỡng/hệ số/màu/icon/URL nền/quyền lợi, ghép lỗi API vào trường và focus lỗi đầu tiên. Step 3 preview toàn bộ hạng và thẻ, publish bằng API thật. Dùng action xác nhận riêng để rollover. Giữ các tab transactions/history/members.
- [ ] Mở rộng wallet response với `tierCard` gồm tier hiệu lực, điểm xét hạng Decimal dưới dạng string, hạng tiếp theo và ngưỡng còn thiếu, cùng metadata mùa. Dùng cùng component CSS cho preview và thẻ hội viên, có nền màu nếu ảnh lỗi, trạng thái ở hạng cao nhất và reload từ API. Giữ biểu đồ/ lịch sử hiện hữu, trình bày điểm mùa tách khỏi ví và điểm lifetime.
- [ ] Chạy `npm test`, `npm run typecheck`, `npm run build`, và `npm run lint --workspace apps/frontend` nếu script hiện hành cung cấp. Chạy apps bằng `npm run dev` với backend trỏ DB test đã migrate. Dùng Orca để đăng nhập qua luồng thật và thực hiện các ca bên dưới. Hiện Orca CLI có mặt nhưng `orca status --json` bị `runtime_access_denied (EPERM)`. Khi triển khai kiểm tra lại quyền runtime theo skill `orca-cli`. Nếu Orca vẫn không truy cập được, chạy API/MySQL và dùng `npm run test:e2e` khi cần. Suite Playwright có mock chỉ là regression UI và không thay bằng chứng cho flow MySQL thật.
- [ ] Cập nhật [báo cáo](../../../reports/tier-system-v1-2026-11-23.md) với kết quả thực tế và hash. Commit scope UI sau khi xác minh, đề xuất `feat(frontend): add loyalty setup wizard and member tier card`. Nếu mốc 4 giờ chạm trước, cắt hiệu ứng, hình nền cầu kỳ và các chi tiết trình bày. Giữ validation và tính toàn vẹn M2. Ghi `NOT RUN` hoặc `FAIL` ở phần chưa đạt, không tuyên bố đạt Definition of Done.

## Ma trận nghiệm thu

| # | Tình huống | Bằng chứng cần có |
| --- | --- | --- |
| 1 | Merchant tạo hạng mới và publish | Wizard/API lưu thành công, GET sau reload có mã mới và policy version mới. Danh sách chỉ default cũng hoạt động. |
| 2 | Trùng tên/mã/ngưỡng | Lỗi đúng field, cả API từ chối, tier rows và snapshot không đổi. Gồm tên khác hoa thường và default bị ẩn. |
| 3 | Member tự thăng hạng | Thanh toán qua luồng Mock thật trên local, exact points đạt ngưỡng, DB membership và UI cùng hạng. Giữ multiplier của hạng trước giao dịch trong snapshot. |
| 4 | HARD | Tier default, progress `0`, ví và ledger khớp từng giá trị trước reset. |
| 5 | SOFT | Từ bậc 3 xuống bậc 2, progress `0`, giữ bậc 2 khi GET, reload và khi tích ít điểm. |
| 6 | Reset hai lần | Chạy tuần tự và song song, một mùa ACTIVE, một kết quả mỗi membership, one replay. Lỗi giữa transaction rollback toàn bộ. |
| 7 | Merchant isolation | A không sửa draft/rollover của B hoặc truy cập membership của B. Owner A publish chỉ tạo version và tier của A. |
| 8 | Thẻ sau reload | Tên/màu/hạng, điểm, tiến độ và mùa khớp wallet API trong cả HARD/SOFT. |
| 9 | Payment/refund cũ | Đơn cũ và order snapshot vẫn đọc được. Đơn trước mùa chỉ reverse ví/ledger theo nghiệp vụ cũ. Đơn trong mùa reverse đúng progress. Không double reverse, kiểm tra trường hợp đã tiêu điểm và số dư âm. |

## Tham khảo

- CNV quy định hạng mặc định ngưỡng 0, một tiêu chí xét hạng chung và ngưỡng/tên riêng theo hạng. [Hạng thành viên](https://huongdan.cnvloyalty.com/tinh-nang/loyalty/hang-thanh-vien)
- CNV HUB mô tả reset hằng năm, hạ một bậc hoặc về hạng chỉ định và giữ điểm đổi thưởng. IncomSG v1 dùng manual rollover theo mùa, progress mới bằng 0 và floor riêng theo yêu cầu. [Cài đặt reset hạng](https://huongdan.cnvloyalty.com/tinh-nang/loyalty/hang-thanh-vien/cai-dat-reset-hang-thanh-vien)
- Hồ sơ kiểm thử repo trước khi có Tier System v1. [Ma trận U01–U09](../verification/2026-11-23-uc-flow-matrix.md)
