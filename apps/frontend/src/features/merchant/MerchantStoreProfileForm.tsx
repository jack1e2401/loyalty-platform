import { useState } from "react";
import { createStorefrontClient } from "../../api/storefront-client";
import type { StoreProfile, StoreProfileResponse } from "../../api/storefront-types";
import { Button, Card, Field, Input, Textarea } from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { StorefrontImageField } from "../storefront/StorefrontImageField";
import { StorefrontOpeningHoursEditor } from "../storefront/StorefrontOpeningHoursEditor";

const api = createStorefrontClient();

export function MerchantStoreProfileForm({ data, token }: { data: StoreProfileResponse; token: string }) {
  const [saved, setSaved] = useState(() => ({ ...data.profile, name: data.merchant.name }));
  const [draft, setDraft] = useState(saved);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const path = `/s/${data.merchant.slug}`;
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);

  function change<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.saveStoreProfile(draft, token);
      const next = { ...result.profile, name: result.merchant.name };
      setSaved(next);
      setDraft(next);
      setConfirming(false);
      setNotice("Đã cập nhật thông tin cửa hàng.");
    } catch (reason) {
      setError(reason instanceof Error && reason.message === "INVALID_INPUT"
        ? "Kiểm tra tên, thông tin liên hệ và giờ mở cửa."
        : "Không lưu được thông tin cửa hàng. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setNotice("Đã sao chép liên kết cửa hàng.");
    } catch {
      setNotice("Không thể sao chép tự động. Bạn có thể chọn và sao chép đường dẫn.");
    }
  }

  const upload = (file: File) => api.uploadMedia(file, token).then(({ url }) => url);
  const contacts = [
    ["contactPhone", "Số điện thoại liên hệ", 40, "tel"],
    ["contactEmail", "Email liên hệ", 191, "email"],
    ["address", "Địa chỉ", 255, "text"],
  ] as const satisfies readonly [keyof StoreProfile, string, number, string][];

  return (
    <form className="min-w-0 space-y-5" onSubmit={(event) => {
      event.preventDefault();
      if (!changed || busy) return;
      setError("");
      setConfirming(true);
    }}>
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="text-lg font-extrabold">Hồ sơ cửa hàng</h2>
        <Field label="Tên cửa hàng">
          <Input required value={draft.name} maxLength={191} onChange={(event) => change("name", event.target.value)} />
        </Field>
        <div className="flex flex-wrap items-end gap-2 [&>label]:flex-1">
          <Field label="Đường dẫn cửa hàng">
            <Input readOnly value={path} />
          </Field>
          <Button type="button" variant="outline" onClick={() => void copyLink()}>Sao chép liên kết</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map(([key, label, maxLength, type]) => (
            <Field key={key} label={label}>
              <Input type={type} maxLength={maxLength} value={draft[key] ?? ""} onChange={(event) => change(key, event.target.value || null)} />
            </Field>
          ))}
        </div>
        <Field label="Mô tả ngắn">
          <Textarea maxLength={500} value={draft.footerDescription ?? ""} onChange={(event) => change("footerDescription", event.target.value || null)} />
        </Field>
        <StorefrontImageField label="Logo cửa hàng" value={draft.logoUrl} onChange={(url) => change("logoUrl", url)} onUpload={upload} />
        <details className="space-y-3">
          <summary className="cursor-pointer text-sm font-semibold">Ảnh cửa hàng (tùy chọn)</summary>
          <StorefrontImageField label="Ảnh ở thẻ thông tin" value={draft.storeImageUrl ?? null} onChange={(url) => change("storeImageUrl", url)} onUpload={upload} />
        </details>
      </Card>
      <StorefrontOpeningHoursEditor value={draft.openingHours ?? null} onChange={(hours) => change("openingHours", hours)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!changed || busy}>Lưu thông tin</Button>
        {notice && <p role="status" className="text-sm">{notice}</p>}
      </div>
      <ConfirmActionDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Cập nhật thông tin cửa hàng?"
        description="Thông tin này sẽ hiển thị ngay trên trang cửa hàng công khai."
        confirmLabel="Xác nhận lưu"
        busy={busy}
        error={error}
        onConfirm={() => void save()}
      />
    </form>
  );
}
