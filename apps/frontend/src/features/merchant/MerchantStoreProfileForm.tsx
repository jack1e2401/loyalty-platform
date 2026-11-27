import { useState } from "react";
import { ArrowCounterClockwise, ArrowUpRight, Copy } from "@phosphor-icons/react";
import { Alert, Button, Collapse, Flex, Form, Input, Tag, Typography } from "antd";
import { createStorefrontClient } from "../../api/storefront-client";
import type { StoreProfile, StoreProfileResponse } from "../../api/storefront-types";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { StorefrontImageField } from "../storefront/StorefrontImageField";
import { StorefrontOpeningHoursEditor } from "../storefront/StorefrontOpeningHoursEditor";
import { CmsCard } from "./cms";

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

  function resetDraft() {
    setDraft(saved);
    setError("");
    setNotice("Đã hoàn tác các thay đổi chưa lưu.");
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
    <Form
      layout="vertical"
      className="min-w-0 space-y-5"
      onSubmitCapture={(event) => {
        event.preventDefault();
        if (!changed || busy) return;
        setError("");
        setConfirming(true);
      }}
    >
      <CmsCard title="Hồ sơ cửa hàng">
        <div className="space-y-1">
          <Form.Item label="Tên cửa hàng" htmlFor="store-profile-name" required>
            <Input
              id="store-profile-name"
              required
              maxLength={191}
              value={draft.name}
              onChange={(event) => change("name", event.target.value)}
            />
          </Form.Item>

          <Form.Item label="Đường dẫn cửa hàng" htmlFor="store-profile-slug">
            <Flex gap={8} wrap>
              <Input id="store-profile-slug" readOnly value={path} className="min-w-[200px] flex-1 bg-[#f7faf6]" />
              <Button icon={<Copy size={15} />} onClick={() => void copyLink()}>
                Sao chép liên kết
              </Button>
              <Button
                icon={<ArrowUpRight size={15} />}
                href={path}
                target="_blank"
                rel="noopener"
              >
                Xem gian hàng
              </Button>
            </Flex>
          </Form.Item>

          <div className="grid gap-x-4 sm:grid-cols-2">
            {contacts.map(([key, label, maxLength, type]) => (
              <Form.Item key={key} label={label} htmlFor={`store-profile-${key}`}>
                <Input
                  id={`store-profile-${key}`}
                  type={type}
                  maxLength={maxLength}
                  value={draft[key] ?? ""}
                  onChange={(event) => change(key, event.target.value || null)}
                />
              </Form.Item>
            ))}
          </div>

          <Form.Item label="Mô tả ngắn" htmlFor="store-profile-description">
            <Input.TextArea
              id="store-profile-description"
              rows={3}
              maxLength={500}
              value={draft.footerDescription ?? ""}
              onChange={(event) => change("footerDescription", event.target.value || null)}
            />
          </Form.Item>

          <StorefrontImageField
            label="Logo cửa hàng"
            layout="horizontal"
            value={draft.logoUrl}
            onChange={(url) => change("logoUrl", url)}
            onUpload={upload}
          />

          <Collapse
            ghost
            className="mt-2 -mx-3"
            items={[
              {
                key: "store-image",
                label: <span className="font-semibold text-[#20392a]">Ảnh cửa hàng (tùy chọn)</span>,
                children: (
                  <StorefrontImageField
                    label="Ảnh ở thẻ thông tin"
                    value={draft.storeImageUrl ?? null}
                    onChange={(url) => change("storeImageUrl", url)}
                    onUpload={upload}
                  />
                ),
              },
            ]}
          />
        </div>
      </CmsCard>

      <StorefrontOpeningHoursEditor value={draft.openingHours ?? null} onChange={(hours) => change("openingHours", hours)} />

      <div
        role="region"
        aria-label="Thanh lưu thông tin cửa hàng"
        className={`sticky bottom-4 z-20 rounded-xl border p-3.5 shadow-[0_6px_20px_rgba(32,57,42,0.10)] backdrop-blur transition-colors ${
          changed ? "border-[#e5b869] bg-[#fffcf5]/95" : "border-[#e3e9e2] bg-white/95"
        }`}
      >
        <Flex align="center" justify="space-between" gap={12} wrap>
          <Flex align="center" gap={8} wrap className="min-w-0 flex-1">
            {changed ? (
              <>
                <Tag color="warning" className="m-0">Có thay đổi chưa lưu</Tag>
                <Typography.Text type="secondary" className="text-xs">
                  Lưu để cập nhật ngay lên trang cửa hàng công khai.
                </Typography.Text>
              </>
            ) : notice ? (
              <Alert role="status" type="success" showIcon title={notice} className="w-full py-1" />
            ) : (
              <Typography.Text type="secondary" className="text-xs">
                Mọi thay đổi đã được lưu.
              </Typography.Text>
            )}
          </Flex>
          <Flex align="center" gap={8} wrap>
            {changed ? (
              <Button icon={<ArrowCounterClockwise size={15} />} disabled={busy} onClick={resetDraft}>
                Hoàn tác
              </Button>
            ) : null}
            <Button type="primary" htmlType="submit" disabled={!changed || busy} loading={busy}>
              Lưu thông tin
            </Button>
          </Flex>
        </Flex>
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
    </Form>
  );
}
