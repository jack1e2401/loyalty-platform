import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Button, Card, Input } from "../../../components/ui";
import type { StorefrontSectionConfig, StorefrontSectionKey } from "../../../api/storefront-types";

const SECTION_LABELS: Record<StorefrontSectionKey, string> = {
  hero: "Hero đầu trang",
  featured_products: "Sản phẩm nổi bật",
  categories: "Danh mục sản phẩm",
  upcoming_events: "Sự kiện sắp tới",
  store_info: "Thông tin cửa hàng",
  footer: "Chân trang",
};

type Props = {
  sections: StorefrontSectionConfig[];
  onUpdate: (key: StorefrontSectionKey, patch: Partial<StorefrontSectionConfig>) => void;
  onMove: (index: number, delta: -1 | 1) => void;
};

export function StorefrontSectionsEditor({ sections, onUpdate, onMove }: Props) {
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <h2 className="text-lg font-extrabold text-[#20392a]">Bố cục các mục hiển thị</h2>
      <div className="space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.key}
            className="grid gap-3 rounded-2xl border border-[#e5ece3] bg-[#fcfdf9] p-4 md:grid-cols-[auto_1fr_1fr_auto] md:items-center"
          >
            <label className="flex items-center gap-2 text-sm font-bold text-[#24452f]">
              <input
                type="checkbox"
                checked={section.enabled}
                onChange={(event) => onUpdate(section.key, { enabled: event.target.checked })}
                className="size-4 accent-[#335e3d]"
              />
              {SECTION_LABELS[section.key]}
            </label>
            <Input
              value={section.title ?? ""}
              maxLength={120}
              placeholder="Tiêu đề mục (tùy chọn)"
              onChange={(event) => onUpdate(section.key, { title: event.target.value || null })}
            />
            <Input
              value={section.subtitle ?? ""}
              maxLength={255}
              placeholder="Phụ đề mục (tùy chọn)"
              onChange={(event) => onUpdate(section.key, { subtitle: event.target.value || null })}
            />
            <div className="flex items-center gap-1 justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === 0}
                aria-label={`Đưa ${SECTION_LABELS[section.key]} lên`}
                onClick={() => onMove(index, -1)}
              >
                <ArrowUp aria-hidden="true" size={14} />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={index === sections.length - 1}
                aria-label={`Đưa ${SECTION_LABELS[section.key]} xuống`}
                onClick={() => onMove(index, 1)}
              >
                <ArrowDown aria-hidden="true" size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
