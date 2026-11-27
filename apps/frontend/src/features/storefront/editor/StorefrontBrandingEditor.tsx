import { Card, Field, Input, Textarea } from "../../../components/ui";
import type { StorefrontConfig } from "../../../api/storefront-types";
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
    <Card className="space-y-6 rounded-[1.75rem] border-[#e4ece1] bg-white p-5 shadow-[0_12px_36px_-28px_rgba(30,56,37,0.28)] sm:p-7 lg:p-8">
      <h2 className="text-lg font-extrabold text-[#20392a]">Ảnh bìa và Hero</h2>
      <StorefrontImageField
        label="Ảnh bìa cửa hàng"
        value={branding.bannerUrl}
        onChange={(url) => onChange("bannerUrl", url)}
        onUpload={onUpload}
        hint="Khuyến nghị 1200 × 400 px. Hiển thị đầu trang chủ."
        previewClassName="w-full aspect-[3/1]"
      />
      <div className="space-y-4 border-t border-[#e4ece1] pt-5">
        <h3 className="font-bold text-[#20392a]">Hero trang chủ</h3>
        <StorefrontImageField
          label="Ảnh Hero"
          value={branding.heroImageUrl}
          onChange={(url) => onChange("heroImageUrl", url)}
          onUpload={onUpload}
          hint="Khuyến nghị 800 × 600 px. Dùng làm nền cho phần giới thiệu."
          previewClassName="w-full max-w-md aspect-[4/3]"
        />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tiêu đề Hero *">
          <Input
            required
            maxLength={120}
            value={branding.heroTitle}
            onChange={(event) => onChange("heroTitle", event.target.value)}
          />
        </Field>
        <Field label="Màu chủ đạo (#RRGGBB)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Chọn màu chủ đạo"
              value={/^#[0-9a-fA-F]{6}$/.test(branding.primaryColor) ? branding.primaryColor : "#335e3d"}
              onChange={(event) => onChange("primaryColor", event.target.value)}
              className="h-11 w-14 cursor-pointer rounded-xl border border-[#e4eae2] bg-white p-1"
            />
            <Input
              value={branding.primaryColor}
              maxLength={7}
              onChange={(event) => onChange("primaryColor", event.target.value)}
              placeholder="#335e3d"
            />
          </div>
        </Field>
      </div>

      <Field label="Mô tả Hero">
        <Textarea
          maxLength={500}
          value={branding.heroDescription ?? ""}
          onChange={(event) => onChange("heroDescription", event.target.value || null)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Chữ nút kêu gọi (CTA)">
          <Input
            maxLength={60}
            value={branding.heroCtaText ?? ""}
            onChange={(event) => onChange("heroCtaText", event.target.value || null)}
          />
        </Field>
        <Field label="Liên kết nút CTA" hint={`/s/${slug}... hoặc https://...`}>
          <Input
            maxLength={2048}
            value={branding.heroCtaLink ?? ""}
            onChange={(event) => onChange("heroCtaLink", event.target.value || null)}
            placeholder={`/s/${slug}`}
          />
        </Field>
      </div>

      </div>
    </Card>
  );
}
