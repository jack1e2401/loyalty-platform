import { Form, Input } from "antd";
import type { StorefrontConfig } from "../../../api/storefront-types";
import { CmsCard } from "../../merchant/cms";
import { StorefrontImageField } from "../StorefrontImageField";

type Branding = StorefrontConfig["branding"];
type Props = {
  branding: Branding;
  slug: string;
  onChange: <K extends keyof Branding>(key: K, value: Branding[K]) => void;
  onUpload: (file: File) => Promise<string>;
};

export function StorefrontBrandingEditor({ branding, slug, onChange, onUpload }: Props) {
  return (
    <CmsCard title="Ảnh bìa và Hero">
      <Form layout="vertical" component="div" className="space-y-4">
        <StorefrontImageField
          label="Ảnh bìa cửa hàng"
          value={branding.bannerUrl}
          onChange={(url) => onChange("bannerUrl", url)}
          onUpload={onUpload}
          hint="Khuyến nghị 1200 × 400 px. Hiển thị đầu trang chủ."
          previewClassName="w-full aspect-[3/1]"
        />
        <div className="space-y-4 border-t border-[#e4ece1] pt-5">
          <h3 className="m-0 font-bold text-[#20392a]">Hero trang chủ</h3>
          <StorefrontImageField
            label="Ảnh Hero"
            value={branding.heroImageUrl}
            onChange={(url) => onChange("heroImageUrl", url)}
            onUpload={onUpload}
            hint="Khuyến nghị 800 × 600 px. Dùng làm nền cho phần giới thiệu."
            previewClassName="w-full max-w-md aspect-[4/3]"
          />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item label="Tiêu đề Hero" htmlFor="storefront-hero-title" required>
              <Input
                id="storefront-hero-title"
                required
                maxLength={120}
                value={branding.heroTitle}
                onChange={(event) => onChange("heroTitle", event.target.value)}
              />
            </Form.Item>
            <Form.Item label="Màu chủ đạo (#RRGGBB)" htmlFor="storefront-primary-color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Chọn màu chủ đạo"
                  value={/^#[0-9a-fA-F]{6}$/.test(branding.primaryColor) ? branding.primaryColor : "#335e3d"}
                  onChange={(event) => onChange("primaryColor", event.target.value)}
                  className="h-8 w-12 cursor-pointer rounded-lg border border-[#d9e0d7] bg-white p-0.5"
                />
                <Input
                  id="storefront-primary-color"
                  value={branding.primaryColor}
                  maxLength={7}
                  onChange={(event) => onChange("primaryColor", event.target.value)}
                  placeholder="#335e3d"
                />
              </div>
            </Form.Item>
          </div>

          <Form.Item label="Mô tả Hero" htmlFor="storefront-hero-description">
            <Input.TextArea
              id="storefront-hero-description"
              rows={3}
              maxLength={500}
              value={branding.heroDescription ?? ""}
              onChange={(event) => onChange("heroDescription", event.target.value || null)}
            />
          </Form.Item>

          <div className="grid gap-x-4 sm:grid-cols-2">
            <Form.Item label="Chữ nút kêu gọi (CTA)" htmlFor="storefront-hero-cta-text">
              <Input
                id="storefront-hero-cta-text"
                maxLength={60}
                value={branding.heroCtaText ?? ""}
                onChange={(event) => onChange("heroCtaText", event.target.value || null)}
              />
            </Form.Item>
            <Form.Item
              label="Liên kết nút CTA"
              htmlFor="storefront-hero-cta-link"
              extra={`/s/${slug}... hoặc https://...`}
            >
              <Input
                id="storefront-hero-cta-link"
                maxLength={2048}
                value={branding.heroCtaLink ?? ""}
                onChange={(event) => onChange("heroCtaLink", event.target.value || null)}
                placeholder={`/s/${slug}`}
              />
            </Form.Item>
          </div>
        </div>
      </Form>
    </CmsCard>
  );
}
