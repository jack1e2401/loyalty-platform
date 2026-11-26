# Kế hoạch Tích hợp 2 Agent Skills: Unslop & Logo Design vào IncomSG

- **Ngày lập:** 26/11/2026
- **Vị trí tài liệu:** `docs/superpowers/plans/2026-11-26-skills-integration-plan.md`
- **Dự án:** IncomSG — Loyalty & Commerce Platform
- **Tài liệu tham chiếu:**
  - Quy chuẩn toàn kho: [AGENTS.md](/AGENTS.md)
  - Quy chuẩn thiết kế giao diện: [agent-docs/UI_UX_GUIDELINES.md](/agent-docs/UI_UX_GUIDELINES.md)
  - Kiến trúc Antigravity Customizations: [C:\Users\ACER\.gemini\antigravity\builtin\skills\agy-customizations\SKILL.md](file:///C:/Users/ACER/.gemini/antigravity/builtin/skills/agy-customizations/SKILL.md)

---

## 1. Tổng Quan & Mục Tiêu Tích Hợp

Trong quá trình phát triển nền tảng **IncomSG (Loyalty & Commerce)**, các AI Agent (Antigravity, Claude Code, Codex, Cursor) thường xuyên tham gia vào 2 nhóm công việc quan trọng:
1. **Thiết kế & Tinh chỉnh Giao diện Frontend (UI/UX Refactoring):** Viết giao diện React/Tailwind cho Member (Zalo Mini App/Mobile) và Merchant CMS/Cashier POS. Nguy cơ thường trực là agent sinh ra giao diện "AI slop" (màu tím gradient mặc định, glow phát sáng, badge cảm xúc vô nghĩa, spacing lộn xộn, vi phạm quy tắc "Visually Quiet" của dự án).
2. **Sáng tạo & Chuẩn hóa Tài sản Thương hiệu (Brand & Vector Assets):** Xây dựng nhận diện thương hiệu cho Merchant (Hikari Coffee, Ceramics Market, Independent Cafe,...), các dấu tem tích lũy (stamp marks), voucher icons, và nhãn in biên lai nhiệt POS monochrome.

Hai Agent Skills mã nguồn mở nổi bật trên GitHub:
- **`heydamir/unslop`** (Tác giả: Damir Sokolovsky): Chuyên gia "giải độc AI UI", loại bỏ hoàn toàn các đặc điểm "vibecoded/AI-generated", tái cấu trúc phân cấp thị giác theo 9 bước nghiêm ngặt.
- **`kaankiziltug/logo-design-skill`** (Tác giả: Kaan Kızıltuğ): Khung làm việc thiết kế nhận diện thương hiệu chuyên nghiệp, kiểm soát hình học vector SVG, test kích thước siêu nhỏ (16px favicon) và in ấn 1-color (monochrome test cho máy in nhiệt POS).

Mục tiêu của kế hoạch này là tích hợp chuẩn hóa cả 2 skill vào thư mục `.agents/skills/` của IncomSG, tinh chỉnh trực tiếp theo các quy định nghiêm ngặt tại `AGENTS.md` (Mục 5) và `agent-docs/UI_UX_GUIDELINES.md`.

---

## 2. Phân Tích Chuyên Sâu 2 Skills

### 2.1. Skill `heydamir/unslop`
- **Mã nguồn:** `https://github.com/heydamir/unslop`
- **Cấu trúc thư mục:**
  ```text
  skills/unslop/
  ├── SKILL.md                 # Quy trình điều phối 9 bước và điểm dừng checkpoint
  └── references/
      ├── signs.md             # Danh mục 18+ dấu hiệu AI slop (gradients, glow, emoji, badges)
      ├── tokens.md            # Hệ thống design tokens, typography scale, spacing rhythm
      ├── effects.md           # Hướng dẫn xử lý hiệu ứng đồ họa native, canvas, halftone
      ├── visuals.md           # Công thức tạo visual có chiều sâu, tôn trọng sản phẩm
      └── refs.md              # Tham chiếu visual benchmarks chuẩn công nghiệp
  ```
- **Phương pháp hoạt động cốt lõi:**
  1. **Bước 1 — Audit không chỉnh sửa (The Audit):** Khi kích hoạt, agent tuyệt đối không sửa code ngay. Agent quét qua mã nguồn và đối chiếu với `signs.md` để xác định mức độ "slop" (Nặng, Nhẹ, hoặc Sạch).
  2. **Bước 2 — Định hướng sáng tạo (Creative Direction - Hard Checkpoint):** Đề xuất 5 dòng định hướng thiết kế (Tone sản phẩm, Visual world, Điểm nhấn màu sắc, Chi tiết signature). Dừng lại chờ người dùng xác nhận hoặc điều chỉnh.
  3. **Bước 3 — Chuỗi 9 bước tinh chỉnh tuần tự (The 9 Passes):**
     - *Pass 1: Spacing & Cadence* — Căn chỉnh lại nhịp điệu khoảng cách theo hệ 4px/8px trước tiên.
     - *Pass 2: Color Ramps* — Giới hạn bảng màu, loại bỏ gradient tím, dùng màu trung tính tự nhiên.
     - *Pass 3: Icons* — Chuẩn hóa icon cùng độ dày nét (Stroke width), loại bỏ emoji rải rác.
     - *Pass 4: Copy* — Cắt gọt câu chữ, bỏ tiếp thị rườm rà, tập trung thông điệp thao tác.
     - *Pass 5: Typography* — Thiết lập tỉ lệ phân cấp font, số liệu tiền tệ dùng số dạng tabular.
     - *Pass 6: Layout & Hierarchy* — Nhóm thông tin logic, bố cục rõ ràng cho mắt quét.
     - *Pass 7: Details & Borders* — Xử lý viền hairline, bo góc tinh tế, bỏ shadow quá đà.
     - *Pass 8: Visuals* — Dùng hình ảnh chân thực, artwork tĩnh, không dùng stock AI lơ lửng.
     - *Pass 9: Motion* — Tinh giản hoạt ảnh, tôn trọng `prefers-reduced-motion`.

---

### 2.2. Skill `kaankiziltug/logo-design-skill`
- **Mã nguồn:** `https://github.com/kaankiziltug/logo-design-skill`
- **Cấu trúc thư mục:**
  ```text
  skills/logo-design/
  ├── SKILL.md                 # Bộ quy tắc thiết kế logo từ brief đến file production
  ├── assets/
  │   └── library/
  │       └── catalog.json     # Cơ sở dữ liệu 1,400+ logo SVG thực tế làm mẫu đối sánh
  └── scripts/                 # Bộ script Python zero-dependency (chạy độc lập)
      ├── svg_audit.py         # Kiểm tra chuẩn hình học, viewBox, stroke, node sạch
      ├── svglib.py            # Thư viện xử lý SVG, scale, tính toán bounding box
      ├── preview_sheet.py     # Xuất bảng xem trước so sánh các ý tưởng (grayscale)
      ├── concept_sheet.py     # Xuất bảng trình bày ý tưởng kèm lý do thiết kế
      ├── presentation_board.py# Xuất bảng trình chiếu nhận diện hoàn chỉnh
      └── export_variants.py   # Xuất trọn bộ file (Primary, Stacked, Monogram, Favicon, Dark/Light)
  ```
- **Phương pháp hoạt động cốt lõi:**
  1. **Brief & Word Mapping:** Khảo sát ngữ cảnh ngành hàng, chọn tính từ thương hiệu, tìm kiếm trong thư viện 1,400+ logo tham chiếu.
  2. **Chọn Dạng Mark (Mark Types):** Wordmark, Monogram, Letterform, Pictorial, Abstract, Emblem.
  3. **Vẽ Phác Thảo Vector (Vector Drafting):** Dựng hình học chuẩn xác dựa trên đường tròn, lưới lưới tỉ lệ vàng hoặc pixel grid.
  4. **The Concept Checkpoint (Dừng bắt buộc):** Trình bày 3–4 phương án dưới dạng Grayscale (Trắng/Đen/Xám) kèm cảnh báo rủi ro (Risk analysis). Dừng lại chờ phê duyệt của con người trước khi sinh assets chi tiết.
  5. **Hiệu Chỉnh Thị Giác (Optical Adjustments):** Bù trừ độ dày quang học (Overshoot ở đỉnh nhọn, Bone effect ở giao điểm nét, Irradiation khi đảo màu nền tối).
  6. **Kiểm Thử Sức Bền Thực Tế (Stress Tests):**
     - *16px Icon Test:* Thu nhỏ về 16x16px xem có nhận diện được không (dành cho favicon/mobile header).
     - *One-color Monochrome Test:* Chuyển sang 1 màu đơn sắc tuyệt đối (bắt buộc cho in hóa đơn nhiệt POS).
     - *Reversed Test:* Kiểm tra hiển thị trên nền tối.

---

## 3. Ma Trận Ánh Xạ Nghiệp Vụ IncomSG

| Yêu cầu tại `AGENTS.md` & `agent-docs/` | Thách thức hiện tại của AI Agent | Giải pháp từ `unslop` | Giải pháp từ `logo-design-skill` |
| :--- | :--- | :--- | :--- |
| **Triết lý Visually Quiet & Focused** (`AGENTS.md` §5) | Agent hay chèn eyebrow labels, milestone badges, câu giải thích rườm rà. | `unslop` Pass 4 (Copy) & `signs.md` cấm tiệt nhãn trang trí, dọn sạch copy chỉ còn mục đích thao tác. | Đảm bảo logo tối giản, không rườm rà chi tiết vụn vặt gây rối mắt trên header/app bar. |
| **Không dùng hoạt ảnh ở Merchant CMS/POS** | Agent hay sinh hiệu ứng chuyển động, card glow lung linh trên màn hình thu ngân. | `unslop` Pass 9 cấm motion ở CMS/POS, chỉ giữ static artwork thuần túy. | Cung cấp file vector tĩnh (`.svg`) chuẩn mực cho CMS/POS mà không phụ thuộc motion. |
| **Chỉ dùng Hoạt ảnh Rive cho Member** | Cần hiệu ứng mượt mà khi đóng tem, nhận quà nhưng phải có static fallback. | `unslop` Pass 8 & 9 định hướng tài nguyên hình ảnh có cấu trúc, tôn trọng `prefers-reduced-motion`. | Thiết kế vector tem (stamp mark) sắc nét làm phôi gốc để gắn vào Rive hoặc làm fallback tĩnh. |
| **Máy in nhiệt POS & Hóa đơn quầy** | Logo merchant đưa vào hóa đơn quầy (ESC/POS) bị nhòe mực, mất nét đen trắng. | N/A | **Monochrome 1-Color Test** trong `export_variants.py` & `svg_audit.py` bảo đảm nét vector in nhiệt sắc nét. |
| **Trải nghiệm Zalo Mini App (Mobile)** | Favicon, icon thanh điều hướng và avatar chi nhánh hiển thị mờ/vỡ trên màn hình nhỏ. | `unslop` Pass 1 & 7 bảo đảm safe-area insets và kích thước touch tối thiểu 44px. | **16px/24px Favicon Test** kiểm định hình học không bị dính nét ở kích thước nhỏ. |
| **Hệ thống Font & Màu Thương hiệu** | Agent hay tự ý dùng font Inter hoặc Roboto với màu Indigo/Purple của Tailwind. | Tinh chỉnh `tokens.md` sang cặp font IncomSG: **Fraunces** (Display) + **Plus Jakarta Sans** (Body). | Kết hợp typography lockup chuẩn xác giữa logo mark và tên chi nhánh/thương hiệu. |

---

## 4. Kiến Trúc Tích Hợp Dự Kiến Trong Repository

Tuân thủ kiến trúc Customization của Antigravity (`agy-customizations`), thư mục `.agents/skills/` tại gốc kho lưu trữ sẽ lưu trữ các skills cấp dự án (Workspace Project Skills):

```text
d:\.Learn\IncomSG\
├── .agents/
│   └── skills/
│       ├── unslop/
│       │   ├── SKILL.md
│       │   └── references/
│       │       ├── effects.md
│       │       ├── refs.md
│       │       ├── signs.md
│       │       ├── tokens.md
│       │       ├── visuals.md
│       │       └── incomsg_guidelines.md   # [Bổ sung] Ánh xạ trực tiếp AGENTS.md §5 & UI_UX_GUIDELINES.md
│       └── logo-design/
│           ├── SKILL.md
│           ├── assets/
│           │   └── library/
│           │       └── catalog.json
│           └── scripts/
│               ├── build_catalog.py
│               ├── concept_sheet.py
│               ├── export_variants.py
│               ├── presentation_board.py
│               ├── preview_sheet.py
│               ├── render_png.py
│               ├── search_library.py
│               ├── svg_audit.py
│               └── svglib.py
├── agent-docs/
│   ├── UI_UX_GUIDELINES.md                 # Tham chiếu hiện có
│   └── SKILLS_GUIDE.md                     # [Bổ sung] Tài liệu hướng dẫn lập trình viên/agent kích hoạt skill
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-11-26-skills-integration-plan.md
```

---

## 5. Lộ Trình Triển Khai Chi Tiết (Phased Implementation Plan)

### Giai đoạn 1: Khởi tạo Hạ tầng Skill Workspace (Workspace Scaffolding)
- **Công việc:**
  1. Tạo thư mục `.agents/skills/unslop` và `.agents/skills/logo-design`.
  2. Tải về và đặt các file lõi từ 2 repository GitHub (`heydamir/unslop` và `kaankiziltug/logo-design-skill`).
  3. Cấu hình quyền thực thi cho các script Python trong `skills/logo-design/scripts/` (bảo đảm chạy mượt mà trên môi trường Windows PowerShell không cần cài thêm pip packages ngoài standard library).
- **Kiểm thử nghiệm thu:**
  - Chạy `python .agents/skills/logo-design/scripts/svg_audit.py --help` trả về mã thoát `0`.

### Giai đoạn 2: Bản địa hóa & Tinh chỉnh `unslop` theo Chuẩn IncomSG
- **Công việc:**
  1. Soạn thảo `incomsg_guidelines.md` bên trong `.agents/skills/unslop/references/`:
     - Tích hợp điều khoản **BẮT BUỘC** hiển thị **Modal xác nhận** (`AGENTS.md` §5) trước mọi hành động ghi/cập nhật dữ liệu.
     - Quy tắc **Rive chỉ dành cho Member (Zalo Mini App)**, Merchant CMS & POS 100% tĩnh.
     - Quy chuẩn màu sắc dự án (Hikari Amber, Paper Slate, Emerald Active, Crimson Error).
     - Cặp font `@fontsource/fraunces` và `@fontsource/plus-jakarta-sans`.
     - Số liệu tiền tệ VND và Điểm Loyalty phải hiển thị font đơn khoảng (`tabular-nums`/`font-mono`).
  2. Bổ sung trigger trong `SKILL.md` của `unslop` để agent tự động nhận diện khi người dùng yêu cầu: `"review UI"`, `"unslop"`, `"dọn dẹp giao diện"`, `"tối ưu màn hình Member/Merchant"`.
- **Kiểm thử nghiệm thu:**
  - Kiểm tra nội dung `SKILL.md` tuân thủ YAML frontmatter hợp lệ của Antigravity Customizations.

### Giai đoạn 3: Tích hợp `logo-design-skill` & Thiết lập Profile POS Receipt
- **Công việc:**
  1. Đưa `catalog.json` và bộ script xử lý vector SVG vào `.agents/skills/logo-design/`.
  2. Bổ sung preset **"Thermal Receipt (ESC/POS 203 DPI)"** vào `export_variants.py`:
     - Tự động kiểm tra độ tương phản 1-bit đen trắng tuyệt đối.
     - Kiểm tra nét viền (stroke weight tối thiểu 1.5px trên canvas 64px để máy in nhiệt không bị đứt nét).
  3. Tích hợp thư mục mẫu cho các thương hiệu mặc định của dự án (`apps/frontend/public/images/merchants/`):
     - Tạo mẫu vector logo cho **Hikari Coffee** (Chủ đề cà phê tối giản, tách cà phê cách điệu hình học).
     - Tạo mẫu vector tem tích lũy (5 mốc tem cà phê).
- **Kiểm thử nghiệm thu:**
  - Chạy thử `export_variants.py` trên một file SVG mẫu và kiểm tra thư mục đầu ra chứa đầy đủ các biến thể (primary, monochrome, favicon).

### Giai đoạn 4: Tài liệu Hóa & Thử Nghiệm Kiểm Thử Thực Tế (E2E Verification)
- **Công việc:**
  1. Tạo tài liệu `agent-docs/SKILLS_GUIDE.md` giải thích cách gọi lệnh và các kịch bản sử dụng:
     - Dùng `/unslop` hoặc yêu cầu bằng lời để tái cấu trúc màn hình `apps/frontend/src/pages/member/` hoặc `apps/frontend/src/pages/merchant/`.
     - Dùng `/logo-design` để sáng tạo bộ nhận diện hoặc xuất bộ icon tem mới cho merchant.
  2. Thử nghiệm thực tế:
     - Chạy thử quy trình audit của `unslop` trên 1 màn hình frontend hiện tại (`MemberChallengePage.tsx` hoặc `CashierCounter.tsx`).
     - Ghi lại báo cáo audit trước/sau.
- **Kiểm thử nghiệm thu:**
  - Chạy `npm run typecheck` và `npm test` để bảo đảm không có tác động tiêu cực nào đến mã nguồn frontend/backend.

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

1. **Tuân thủ Antigravity Customization:**
   - Cả 2 skills nằm đúng vị trí chuẩn `.agents/skills/<name>/SKILL.md`.
   - YAML frontmatter có trường `name` và `description` rõ ràng, chứa từ khóa kích hoạt phù hợp.
2. **Không phá vỡ quy chuẩn dự án:**
   - Bảo toàn 100% các nguyên tắc tại `AGENTS.md` (giới hạn file $\le 250$ dòng, không dùng floating-point cho điểm/tiền, bắt buộc modal xác nhận).
   - Không đưa dependencies nặng nề (như Inkscape, Puppeteer CLI hay thư viện ngoài) vào bộ script của `logo-design`; duy trì tính độc lập (zero external npm/pip dependencies).
3. **Hiệu quả thực tế:**
   - Agent nhận thức được 2 skill này trong danh sách kỹ năng khả dụng.
   - Khi được yêu cầu dọn dẹp màn hình, agent tuân thủ đúng 9 bước và dừng lại ở checkpoint phê duyệt định hướng trước khi chỉnh sửa code.

---

## 7. Quản Trị Rủi Ro & Giải Pháp Phòng Ngừa

- **Rủi ro 1: Dung lượng thư viện logo mẫu quá lớn (`assets/library/catalog.json`)**
  - *Giải pháp:* Chỉ giữ lại metadata `catalog.json` phục vụ tìm kiếm từ khóa ý tưởng; không commit hàng nghìn file SVG thô của bên thứ ba vào git repository của IncomSG để tránh làm nặng repo.
- **Rủi ro 2: Agent tự ý sửa đổi code giao diện khi kích hoạt `unslop`**
  - *Giải pháp:* Ràng buộc nghiêm ngặt trong `SKILL.md` (Hard Checkpoint tại Bước 2): Agent bắt buộc phải in ra định hướng 5 dòng và chờ phản hồi của lập trình viên trước khi gọi tool chỉnh sửa file.
- **Rủi ro 3: Xung đột quy chuẩn thiết kế với mã nguồn có sẵn**
  - *Giải pháp:* Tệp `incomsg_guidelines.md` đóng vai trò ghi đè (override) ưu tiên cao nhất, luôn tham chiếu về `AGENTS.md` và `agent-docs/UI_UX_GUIDELINES.md`.
