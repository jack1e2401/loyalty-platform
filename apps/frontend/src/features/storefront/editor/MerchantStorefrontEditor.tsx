import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FloppyDisk, RocketLaunch } from "@phosphor-icons/react";
import { useAuthSession } from "../../../api/auth-session";
import { createCommerceClient } from "../../../api/commerce-http";
import type { ProductDto } from "../../../api/commerce-types";
import { createStorefrontClient } from "../../../api/storefront-client";
import type {
  StorefrontConfig,
  StorefrontSectionConfig,
  StorefrontSectionKey,
  StorefrontVersionSummaryDto,
} from "../../../api/storefront-types";
import { useResource } from "../../../api/useResource";
import {
  BusyLabel,
  Button,
  Card,
  Field,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "../../../components/ui";
import { StorefrontVersionHistory } from "./StorefrontVersionHistory";
import { StorefrontBrandingEditor } from "./StorefrontBrandingEditor";
import { StorefrontSectionsEditor } from "./StorefrontSectionsEditor";
import { FeaturedProductsEditor } from "./FeaturedProductsEditor";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const storefrontApi = createStorefrontClient(apiBase);
const commerceApi = createCommerceClient(apiBase);

function translateStorefrontError(code: string): string {
  switch (code) {
    case "INVALID_FEATURED_PRODUCTS":
      return "Có sản phẩm nổi bật không hợp lệ hoặc không còn đang bán.";
    case "INVALID_INPUT":
      return "Dữ liệu chưa hợp lệ. Kiểm tra màu hex (#RRGGBB), đường dẫn (/s/... hoặc https://...) và không dùng thẻ HTML.";
    case "VERSION_NOT_FOUND":
      return "Không tìm thấy phiên bản để khôi phục.";
    default:
      return code;
  }
}

export function MerchantStorefrontEditor() {
  const { accessToken } = useAuthSession();
  const state = useResource(async () => {
    const [storefront, versionsRes, productsRes] = await Promise.all([
      storefrontApi.getMerchantStorefront(accessToken!),
      storefrontApi.listVersions(accessToken!),
      commerceApi.listOwnProducts(accessToken!, { limit: 100 }),
    ]);
    return {
      storefront,
      versions: versionsRes.versions,
      saleProducts: productsRes.items.filter((p) => p.kind === "SALE" && p.status === "ACTIVE"),
    };
  }, [accessToken]);

  const [draft, setDraft] = useState<StorefrontConfig | null>(null);
  const [versions, setVersions] = useState<StorefrontVersionSummaryDto[]>([]);
  const [published, setPublished] = useState<StorefrontVersionSummaryDto | null>(null);
  const [publishNote, setPublishNote] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [rollbackId, setRollbackId] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!state.data) return;
    setDraft(state.data.storefront.draft.config);
    setPublished(state.data.storefront.published);
    setVersions(state.data.versions);
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

  function hasIncompleteOpeningHours() {
    return (
      draft?.branding.openingHours?.some((day) => !day.closed && (!day.openTime || !day.closeTime)) ?? false
    );
  }

  async function handleSaveDraft() {
    if (!accessToken || !draft || savingDraft) return;
    if (hasIncompleteOpeningHours()) {
      setError("Nhập giờ mở và đóng cửa hoặc đánh dấu nghỉ cho từng ngày.");
      return;
    }
    setSavingDraft(true);
    setNotice("");
    setError("");
    try {
      const response = await storefrontApi.saveDraft(draft, accessToken);
      setDraft(response.draft.config);
      setNotice("Đã lưu bản nháp thành công.");
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Lưu bản nháp thất bại"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublish() {
    if (!accessToken || !draft || publishing) return;
    if (hasIncompleteOpeningHours()) {
      setError("Nhập giờ mở và đóng cửa hoặc đánh dấu nghỉ cho từng ngày.");
      return;
    }
    setPublishing(true);
    setNotice("");
    setError("");
    try {
      const saved = await storefrontApi.saveDraft(draft, accessToken);
      setDraft(saved.draft.config);
      const res = await storefrontApi.publish(publishNote.trim() || undefined, accessToken);
      setPublished(res.published);
      setPublishNote("");
      const nextVersions = await storefrontApi.listVersions(accessToken);
      setVersions(nextVersions.versions);
      setNotice(`Đã xuất bản phiên bản v${res.published.version}.`);
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Xuất bản thất bại"));
    } finally {
      setPublishing(false);
    }
  }

  async function handleRollback(versionId: number) {
    if (!accessToken || rollbackId !== null) return;
    setRollbackId(versionId);
    setNotice("");
    setError("");
    try {
      const res = await storefrontApi.rollbackVersion(versionId, undefined, accessToken);
      setDraft(res.draft.config);
      setPublished(res.published);
      const nextVersions = await storefrontApi.listVersions(accessToken);
      setVersions(nextVersions.versions);
      setNotice(`Đã khôi phục thành phiên bản v${res.published.version}.`);
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Khôi phục thất bại"));
    } finally {
      setRollbackId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giao diện cửa hàng"
        description={`Đường dẫn công khai: /s/${merchant.slug}${published ? ` · Đang hiển thị v${published.version}` : ""}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/s/${merchant.slug}?preview=draft`}>
                Xem trước bản nháp <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/s/${merchant.slug}`}>
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

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="flex-1">
          <Field label="Ghi chú xuất bản (tùy chọn)">
            <Input
              maxLength={255}
              value={publishNote}
              onChange={(event) => setPublishNote(event.target.value)}
              placeholder="Ví dụ: Cập nhật banner mùa lễ hội"
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={savingDraft || publishing}
            onClick={handleSaveDraft}
          >
            {savingDraft ? (
              <BusyLabel>Đang lưu</BusyLabel>
            ) : (
              <>
                <FloppyDisk aria-hidden="true" size={16} /> Lưu bản nháp
              </>
            )}
          </Button>
          <Button type="button" disabled={savingDraft || publishing} onClick={handlePublish}>
            {publishing ? (
              <BusyLabel>Đang xuất bản</BusyLabel>
            ) : (
              <>
                <RocketLaunch aria-hidden="true" size={16} /> Xuất bản
              </>
            )}
          </Button>
        </div>
      </Card>

      <StorefrontVersionHistory versions={versions} busyVersionId={rollbackId} onRollback={handleRollback} />
    </div>
  );
}
