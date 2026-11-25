import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FloppyDisk } from "@phosphor-icons/react";
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
import {
  BusyLabel,
  Button,
  ErrorState,
  LoadingState,
  PageHeader,
} from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
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

  if (state.loading && !draft) return <LoadingState cards={3} />;
  if (state.error && !draft) return <ErrorState message={state.error} retry={state.reload} />;
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giao diện cửa hàng"
        description={`Đường dẫn công khai: /s/${merchant.slug}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/s/${merchant.slug}`} target="_blank" rel="noopener noreferrer">
                Trang công khai <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </Button>
          </div>
        }
      />

      {error && (
        <div role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-sm font-semibold text-[#a4473a]">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-xl bg-[#e8f1e2] p-3 text-sm font-semibold text-[#357044]">
          {notice}
        </div>
      )}

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

      {dirty && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-[#dce6d9] bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-[#53685a]">Có thay đổi chưa lưu</span>
          <Button type="button" disabled={busy} onClick={() => { setError(""); setPending(true); }}>
            {savingDraft ? <BusyLabel>Đang lưu</BusyLabel> : <><FloppyDisk aria-hidden="true" size={16} /> Lưu thay đổi</>}
          </Button>
        </div>
      )}
      <ConfirmActionDialog open={pending} onOpenChange={setPending} title="Lưu giao diện?"
        description="Thay đổi sẽ hiển thị ngay trên trang cửa hàng công khai." confirmLabel="Xác nhận lưu"
        busy={busy} error={error} onConfirm={() => void handleSave()} />
    </div>
  );
}
