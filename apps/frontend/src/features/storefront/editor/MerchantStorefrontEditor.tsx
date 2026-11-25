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
  Field,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
} from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { StorefrontVersionHistory } from "./StorefrontVersionHistory";
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

  const [savedDraft, setSavedDraft] = useState<StorefrontConfig | null>(null);
  const [unpublished, setUnpublished] = useState(false);
  const [pending, setPending] = useState<"save" | "publish" | number | null>(null);
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
    setSavedDraft(state.data.storefront.draft.config);
    setUnpublished(state.data.storefront.hasUnpublishedChanges);
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

  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);
  const busy = savingDraft || publishing || rollbackId !== null;
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

  async function handleSaveDraft() {
    if (!accessToken || !draft || busy) return;
    setSavingDraft(true);
    setNotice("");
    setError("");
    try {
      const response = await storefrontApi.saveDraft(draft, accessToken);
      setDraft(response.draft.config);
      setSavedDraft(response.draft.config);
      setUnpublished(true);
      setPending(null);
      setNotice("Đã lưu bản nháp thành công.");
    } catch (reason) {
      setError(translateStorefrontError(reason instanceof Error ? reason.message : "Lưu bản nháp thất bại"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublish() {
    if (!accessToken || !draft || busy) return;
    setPublishing(true);
    setNotice("");
    setError("");
    try {
      if (dirty) {
        const saved = await storefrontApi.saveDraft(draft, accessToken);
        setDraft(saved.draft.config);
        setSavedDraft(saved.draft.config);
        setUnpublished(true);
      }
      const res = await storefrontApi.publish(publishNote.trim() || undefined, accessToken);
      setPublished(res.published);
      setDraft(res.draft.config);
      setSavedDraft(res.draft.config);
      setUnpublished(false);
      setPending(null);
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
    if (!accessToken || busy) return;
    setRollbackId(versionId);
    setNotice("");
    setError("");
    try {
      const res = await storefrontApi.rollbackVersion(versionId, undefined, accessToken);
      setPublished(res.published);
      setDraft(res.draft.config);
      setSavedDraft(res.draft.config);
      setUnpublished(false);
      setPending(null);
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
              <Link to={`/s/${merchant.slug}?preview=draft`} target="_blank" rel="noopener noreferrer">
                Xem trước bản nháp <ArrowUpRight aria-hidden="true" size={15} />
              </Link>
            </Button>
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

      <details className="rounded-2xl border border-[#e4ece1] bg-white p-4">
        <summary className="cursor-pointer font-semibold text-[#20392a]">Lịch sử phiên bản ({versions.length})</summary>
        <StorefrontVersionHistory versions={versions} busyVersionId={rollbackId} onRollback={(id) => { setError(""); setPending(id); }} />
      </details>

      {(dirty || unpublished) && (
        <div className="sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border border-[#dce6d9] bg-white px-4 py-3 shadow-sm">
          <span className="text-sm text-[#53685a]">{dirty ? "Có thay đổi chưa lưu" : "Bản nháp chưa xuất bản"}</span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!dirty || busy} onClick={() => { setError(""); setPending("save"); }}>
              {savingDraft ? <BusyLabel>Đang lưu</BusyLabel> : <><FloppyDisk aria-hidden="true" size={16} /> Lưu bản nháp</>}
            </Button>
            <Button type="button" disabled={busy} onClick={() => { setError(""); setPending("publish"); }}>
              {publishing ? <BusyLabel>Đang xuất bản</BusyLabel> : <><RocketLaunch aria-hidden="true" size={16} /> Xuất bản</>}
            </Button>
          </div>
        </div>
      )}
      <ConfirmActionDialog
        open={pending !== null}
        onOpenChange={(open) => { if (!open) setPending(null); }}
        title={pending === "save" ? "Lưu bản nháp?" : pending === "publish" ? "Xuất bản giao diện?" : "Khôi phục giao diện?"}
        description={pending === "save"
          ? "Lưu thay đổi để bạn tiếp tục chỉnh sửa. Khách vẫn thấy giao diện đang công khai."
          : pending === "publish"
            ? "Giao diện này sẽ hiển thị ngay trên trang cửa hàng công khai."
            : "Phiên bản được chọn sẽ thay thế giao diện công khai và bản nháp hiện tại."}
        confirmLabel={pending === "save" ? "Xác nhận lưu" : pending === "publish" ? "Xác nhận xuất bản" : "Xác nhận khôi phục"}
        busy={busy}
        error={error}
        onConfirm={() => {
          if (pending === "save") void handleSaveDraft();
          else if (pending === "publish") void handlePublish();
          else if (typeof pending === "number") void handleRollback(pending);
        }}
      >
        {pending === "publish" && (
          <Field label="Ghi chú xuất bản (tùy chọn)">
            <Input maxLength={255} value={publishNote} onChange={(event) => setPublishNote(event.target.value)} />
          </Field>
        )}
      </ConfirmActionDialog>
    </div>
  );
}
