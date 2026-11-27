import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowClockwise, ArrowCounterClockwise, ArrowUpRight, FloppyDisk } from "@phosphor-icons/react";
import { Alert, Button, Flex, Skeleton, Tag, Typography } from "antd";
import { useAuthSession } from "../../../api/auth-session";
import { createCommerceClient } from "../../../api/commerce-http";
import type { ProductDto } from "../../../api/commerce-types";
import { createStorefrontClient } from "../../../api/storefront-client";
import type {
  StorefrontConfig,
  StorefrontSectionConfig,
  StorefrontSectionKey,
} from "../../../api/storefront-types";
import { useResource } from "../../../api/useResource";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { CmsCard, CmsPageHeader } from "../../merchant/cms";
import { StorefrontBrandingEditor } from "./StorefrontBrandingEditor";
import { StorefrontSectionsEditor } from "./StorefrontSectionsEditor";
import { FeaturedProductsEditor } from "./FeaturedProductsEditor";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const storefrontApi = createStorefrontClient(apiBase);
const commerceApi = createCommerceClient(apiBase);

function translateStorefrontError(code: string): string {
  switch (code) {
    case "FEATURED_PRODUCTS_LIMIT":
      return "Chọn tối đa 6 sản phẩm nổi bật khi thay đổi danh sách.";
    case "INVALID_FEATURED_PRODUCTS":
      return "Có sản phẩm nổi bật không hợp lệ hoặc không còn đang bán.";
    case "INVALID_INPUT":
      return "Dữ liệu chưa hợp lệ. Kiểm tra màu hex (#RRGGBB), đường dẫn (/s/... hoặc https://...) và không dùng thẻ HTML.";
    default:
      return code;
  }
}

export function MerchantStorefrontEditor() {
  const { accessToken } = useAuthSession();
  const state = useResource(async () => {
    const [storefront, productsRes] = await Promise.all([
      storefrontApi.getMerchantStorefront(accessToken!),
      commerceApi.listOwnProducts(accessToken!, { limit: 100 }),
    ]);
    return {
      storefront,
      saleProducts: productsRes.items.filter((p) => p.kind === "SALE" && p.status === "ACTIVE"),
    };
  }, [accessToken]);

  const [savedDraft, setSavedDraft] = useState<StorefrontConfig | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<StorefrontConfig | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state.data) return;
    setDraft(state.data.storefront.config);
    setSavedDraft(state.data.storefront.config);
  }, [state.data]);

  const orderedSections = useMemo(
    () =>
      draft
        ? draft.sections
            .filter((section) => section.key !== "store_info" && section.key !== "footer")
            .sort((a, b) => a.order - b.order)
        : [],
    [draft],
  );

  if (state.loading && !draft) {
    return (
      <CmsCard>
        <Skeleton active paragraph={{ rows: 6 }} />
      </CmsCard>
    );
  }
  if (state.error && !draft) {
    return (
      <section className="grid min-w-0 gap-5">
        <CmsPageHeader title="Giao diện cửa hàng" />
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Không tải được cấu hình giao diện"
          description={state.error}
          action={
            <Button size="small" onClick={state.reload}>
              Thử lại
            </Button>
          }
        />
      </section>
    );
  }
  if (!state.data || !draft) return null;

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const busy = savingDraft;
  const merchant = state.data.storefront.merchant;
  const saleProducts: ProductDto[] = state.data.saleProducts;

  function updateBranding<K extends keyof StorefrontConfig["branding"]>(
    key: K,
    value: StorefrontConfig["branding"][K],
  ) {
    setDraft((current) =>
      current ? { ...current, branding: { ...current.branding, [key]: value } } : current,
    );
  }

  function updateSection(key: StorefrontSectionKey, patch: Partial<StorefrontSectionConfig>) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) =>
          section.key === key ? { ...section, ...patch } : section,
        ),
      };
    });
  }

  function moveSection(index: number, delta: -1 | 1) {
    if (!draft) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= orderedSections.length) return;
    const next = [...orderedSections];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    const reindexed = next.map((section, idx) => ({ ...section, order: idx }));
    const fixedSections = ["store_info", "footer"].flatMap((key, idx) => {
      const section = draft.sections.find((item) => item.key === key);
      return section ? [{ ...section, order: reindexed.length + idx }] : [];
    });
    setDraft((current) => (current ? { ...current, sections: [...reindexed, ...fixedSections] } : current));
  }

  function toggleFeaturedProduct(productId: number) {
    setDraft((current) => {
      if (!current) return current;
      const exists = current.featuredProductIds.includes(productId);
      if (exists) {
        return {
          ...current,
          featuredProductIds: current.featuredProductIds.filter((id) => id !== productId),
        };
      }
      if (current.featuredProductIds.length >= 6) {
        setError("Tối đa 6 sản phẩm nổi bật.");
        return current;
      }
      setError("");
      return {
        ...current,
        featuredProductIds: [...current.featuredProductIds, productId],
      };
    });
  }

  async function handleSave() {
    if (!accessToken || !draft || busy) return;
    setSavingDraft(true);
    setNotice("");
    setError("");
    try {
      const response = await storefrontApi.saveConfig(draft, accessToken);
      setDraft(response.config);
      setSavedDraft(response.config);
      setPending(false);
      setNotice("Đã lưu giao diện cửa hàng.");
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Lưu giao diện thất bại"));
    } finally {
      setSavingDraft(false);
    }
  }

  function resetDraft() {
    if (!savedDraft || busy) return;
    setDraft(savedDraft);
    setError("");
    setNotice("Đã hoàn tác các thay đổi chưa lưu.");
  }

  return (
    <div className="space-y-6">
      <CmsPageHeader
        title="Giao diện cửa hàng"
        description={`Đường dẫn công khai: /s/${merchant.slug}`}
        action={
          <Flex gap={8} wrap>
            <Button icon={<ArrowClockwise size={15} />} loading={state.loading} onClick={state.reload}>
              Làm mới
            </Button>
            <Link to={`/s/${merchant.slug}`} target="_blank" rel="noopener noreferrer">
              <Button icon={<ArrowUpRight size={15} />} iconPlacement="end">
                Trang công khai
              </Button>
            </Link>
          </Flex>
        }
      />

      {error ? <Alert role="alert" type="error" showIcon title={error} /> : null}
      {notice ? <Alert role="status" type="success" showIcon title={notice} /> : null}

      <StorefrontBrandingEditor
        branding={draft.branding}
        slug={merchant.slug}
        onChange={updateBranding}
        onUpload={(file) => storefrontApi.uploadMedia(file, accessToken!).then((r) => r.url)}
      />

      <StorefrontSectionsEditor sections={orderedSections} onUpdate={updateSection} onMove={moveSection} />

      <FeaturedProductsEditor
        productIds={draft.featuredProductIds}
        products={saleProducts}
        onToggle={toggleFeaturedProduct}
      />

      {dirty ? (
        <div
          role="region"
          aria-label="Thanh lưu giao diện cửa hàng"
          className="sticky bottom-4 z-20 rounded-xl border border-[#e5b869] bg-[#fffcf5]/95 p-3.5 shadow-[0_6px_20px_rgba(32,57,42,0.10)] backdrop-blur"
        >
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex align="center" gap={8} wrap>
              <Tag color="warning" className="m-0">Có thay đổi chưa lưu</Tag>
              <Typography.Text type="secondary" className="text-xs">
                Thay đổi sẽ hiển thị trên trang cửa hàng công khai sau khi lưu.
              </Typography.Text>
            </Flex>
            <Flex align="center" gap={8} wrap>
              <Button icon={<ArrowCounterClockwise size={15} />} disabled={busy} onClick={resetDraft}>
                Hoàn tác
              </Button>
              <Button
                type="primary"
                icon={<FloppyDisk size={15} />}
                loading={savingDraft}
                disabled={busy}
                onClick={() => { setError(""); setPending(true); }}
              >
                {savingDraft ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </Flex>
          </Flex>
        </div>
      ) : null}
      <ConfirmActionDialog open={pending} onOpenChange={setPending} title="Lưu giao diện?"
        description="Thay đổi sẽ hiển thị ngay trên trang cửa hàng công khai." confirmLabel="Xác nhận lưu"
        busy={busy} error={error} onConfirm={() => void handleSave()} />
    </div>
  );
}
