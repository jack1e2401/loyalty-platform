import { useState, type ChangeEvent } from "react";
import { Trash, UploadSimple } from "@phosphor-icons/react";
import { resolveStorefrontAssetUrl } from "../../api/storefront-client";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { Button, Field, Input } from "../../components/ui";

function translateUploadError(code: string): string {
  switch (code) {
    case "FILE_REQUIRED":
      return "Vui lòng chọn tệp ảnh hợp lệ.";
    case "FILE_TOO_LARGE":
      return "Ảnh vượt quá giới hạn 5 MB.";
    case "INVALID_FILE_TYPE":
      return "Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.";
    default:
      return code;
  }
}

export function StorefrontImageField({
  label,
  value,
  onChange,
  onUpload,
  hint,
  previewClassName = "w-full max-w-md h-32 sm:h-36",
  layout = "vertical",
}: {
  label: string;
  value: string | null;
  onChange: (nextUrl: string | null) => void;
  onUpload: (file: File) => Promise<string>;
  hint?: string;
  previewClassName?: string;
  layout?: "vertical" | "horizontal";
}) {
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const previewSrc = resolveStorefrontAssetUrl(value);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setFileToUpload(file);
  }

  async function upload() {
    if (!fileToUpload || uploading) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await onUpload(fileToUpload);
      onChange(url);
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : "Tải ảnh thất bại";
      setUploadError(translateUploadError(code));
    } finally {
      setUploading(false);
      setFileToUpload(null);
    }
  }

  // 1. Layout nằm ngang (dành riêng cho cấu hình Logo / ảnh đại diện nhỏ)
  if (layout === "horizontal") {
    return (
      <div className="group rounded-2xl border border-[#e5ece3] bg-[#fbfcfa] p-4 transition-colors hover:border-[#c9d9c6] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-[#e5ece3] bg-[#edf2e9] sm:size-28">
            {previewSrc ? (
              <img src={previewSrc} alt={label} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center p-2 text-center text-xs text-[#7d8c7c]">
                Chưa có ảnh
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <Field label={label} hint={hint}>
              <Input
                type="text"
                value={value ?? ""}
                onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
                placeholder="https://... hoặc /uploads/..."
                className="border-[#e1e9dd] bg-white text-sm placeholder:text-[#93a092] focus-visible:ring-[#a8cdb0]"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#d7e2d5] bg-white px-3 py-1.5 text-xs font-bold text-[#2f563a] transition-colors hover:border-[#b8cdb5] hover:bg-[#edf4e9] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#a8cdb0]">
                <UploadSimple aria-hidden="true" size={15} />
                {uploading ? "Đang tải ảnh..." : "Tải ảnh lên"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={handleFileChange}
                />
              </label>
              {value && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(null)}
                  className="min-h-9 rounded-xl px-2.5 text-xs text-[#a4473a] hover:bg-[#fff3f0] hover:text-[#8d382d]"
                >
                  <Trash aria-hidden="true" size={15} /> Xóa ảnh
                </Button>
              )}
            </div>
          </div>
        </div>
        <ConfirmActionDialog
          open={fileToUpload !== null}
          onOpenChange={(open) => { if (!open) setFileToUpload(null); }}
          title="Tải ảnh lên?"
          description="Ảnh sẽ được tải lên kho ảnh của cửa hàng."
          confirmLabel="Tải ảnh lên"
          busy={uploading}
          onConfirm={() => void upload()}
        />
        {uploadError && (
          <p role="alert" className="mt-2 text-xs font-semibold text-[#a4473a]">
            {uploadError}
          </p>
        )}
      </div>
    );
  }

  // 2. Layout như cũ (dành cho Banner, Ảnh bìa, Hero khổ rộng full-width)
  return (
    <div className="group space-y-3.5 rounded-2xl border border-[#e5ece3] bg-[#fbfcfa] p-4 transition-colors hover:border-[#c9d9c6] sm:p-5">
      <Field label={label} hint={hint}>
        <Input
          type="text"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value.trim() ? event.target.value : null)}
          placeholder="https://... hoặc /uploads/..."
          className="border-[#e1e9dd] bg-white text-sm placeholder:text-[#93a092] focus-visible:ring-[#a8cdb0]"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2 border-t border-[#edf1eb] pt-3">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#d7e2d5] bg-white px-3.5 py-2 text-xs font-bold text-[#2f563a] transition-colors hover:border-[#b8cdb5] hover:bg-[#edf4e9] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#a8cdb0]">
          <UploadSimple aria-hidden="true" size={15} />
          {uploading ? "Đang tải ảnh..." : "Tải ảnh lên"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={handleFileChange}
          />
        </label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(null)}
            className="min-h-10 rounded-xl px-3 text-[#a4473a] hover:bg-[#fff3f0] hover:text-[#8d382d]"
          >
            <Trash aria-hidden="true" size={15} /> Xóa ảnh
          </Button>
        )}
      </div>
      <ConfirmActionDialog
        open={fileToUpload !== null}
        onOpenChange={(open) => { if (!open) setFileToUpload(null); }}
        title="Tải ảnh lên?"
        description="Ảnh sẽ được tải lên kho ảnh của cửa hàng."
        confirmLabel="Tải ảnh lên"
        busy={uploading}
        onConfirm={() => void upload()}
      />
      {uploadError && (
        <p role="alert" className="text-xs font-semibold text-[#a4473a]">
          {uploadError}
        </p>
      )}
      {previewSrc && (
        <div className={`mt-3 overflow-hidden rounded-xl border border-[#e5ece3] bg-[#edf2e9] ${previewClassName}`}>
          <img src={previewSrc} alt={label} className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
