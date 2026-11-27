import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Button, Flex, Input, Switch } from "antd";
import type { StorefrontSectionConfig, StorefrontSectionKey } from "../../../api/storefront-types";
import { CmsCard } from "../../merchant/cms";

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
    <CmsCard title="Bố cục các mục hiển thị">
      <div className="space-y-3">
        {sections.map((section, index) => (
          <div
            key={section.key}
            className="grid gap-3 rounded-xl border border-[#e5ece3] bg-[#fcfdf9] p-3.5 md:grid-cols-[200px_1fr_1fr_auto] md:items-center"
          >
            <Flex align="center" gap={10}>
              <Switch
                size="small"
                checked={section.enabled}
                aria-label={`Hiển thị ${SECTION_LABELS[section.key]}`}
                onChange={(checked) => onUpdate(section.key, { enabled: checked })}
              />
              <span className="text-sm font-bold text-[#24452f]">{SECTION_LABELS[section.key]}</span>
            </Flex>
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
            <Flex align="center" justify="end" gap={4}>
              <Button
                size="small"
                disabled={index === 0}
                aria-label={`Đưa ${SECTION_LABELS[section.key]} lên`}
                icon={<ArrowUp size={14} />}
                onClick={() => onMove(index, -1)}
              />
              <Button
                size="small"
                disabled={index === sections.length - 1}
                aria-label={`Đưa ${SECTION_LABELS[section.key]} xuống`}
                icon={<ArrowDown size={14} />}
                onClick={() => onMove(index, 1)}
              />
            </Flex>
          </div>
        ))}
      </div>
    </CmsCard>
  );
}
