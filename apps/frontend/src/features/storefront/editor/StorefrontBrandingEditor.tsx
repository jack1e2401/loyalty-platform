import { Card, Field, Input, StatusText, Textarea } from "../../../components/ui";
import type { StorefrontConfig } from "../../../api/storefront-types";
import { StorefrontImageField } from "../StorefrontImageField";
import { StorefrontOpeningHoursEditor } from "../StorefrontOpeningHoursEditor";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold text-[#20392a]">Thương hiệu & nội dung đầu trang</h2>
        <StatusText tone="neutral">/s/{slug}</StatusText>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:gap-6">
        <StorefrontImageField
          label="Logo cửa hàng"
          value={branding.logoUrl}
          onChange={(url) => onChange("logoUrl", url)}
          onUpload={onUpload}
        />
        <StorefrontImageField
          label="Ảnh cửa hàng"
          value={branding.storeImageUrl ?? null}
          onChange={(url) => onChange("storeImageUrl", url)}
          onUpload={onUpload}
          hint="Nếu để trống, logo cửa hàng sẽ được dùng thay thế."
        />
        <StorefrontImageField
          label="Ảnh bìa (Banner)"
          value={branding.bannerUrl}
          onChange={(url) => onChange("bannerUrl", url)}
          onUpload={onUpload}
        />
        <StorefrontImageField
          label="Ảnh Hero"
          value={branding.heroImageUrl}
          onChange={(url) => onChange("heroImageUrl", url)}
          onUpload={onUpload}
        />
      </div>

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

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Email liên hệ">
          <Input
            type="email"
            maxLength={191}
            value={branding.contactEmail ?? ""}
            onChange={(event) => onChange("contactEmail", event.target.value || null)}
          />
        </Field>
        <Field label="Số điện thoại">
          <Input
            maxLength={40}
            value={branding.contactPhone ?? ""}
            onChange={(event) => onChange("contactPhone", event.target.value || null)}
          />
        </Field>
        <Field label="Địa chỉ">
          <Input
            maxLength={255}
            value={branding.address ?? ""}
            onChange={(event) => onChange("address", event.target.value || null)}
          />
        </Field>
      </div>

      <StorefrontOpeningHoursEditor
        value={branding.openingHours ?? null}
        onChange={(openingHours) => onChange("openingHours", openingHours)}
      />
    </Card>
  );
}
