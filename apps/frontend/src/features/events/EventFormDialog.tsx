import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Alert, Button, Form, Input, Segmented } from "antd";
import { CalendarDots, MapPin, X } from "@phosphor-icons/react";
import type { CreateEventInput, MerchantEventDto, UpdateEventInput } from "../../api/events-types";
import {
  EVENT_SLUG_PATTERN,
  fromDateTimeLocalValue,
  isValidEventBannerUrl,
  toDateTimeLocalValue,
} from "./event-format";

interface EventFormState {
  title: string;
  slug: string;
  description: string;
  bannerUrl: string;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string;
}

const emptyForm: EventFormState = {
  title: "",
  slug: "",
  description: "",
  bannerUrl: "",
  startAt: "",
  endAt: "",
  locationName: "",
  locationAddress: "",
};

function toFormState(event: MerchantEventDto | "new"): EventFormState {
  if (event === "new") return emptyForm;
  return {
    title: event.title,
    slug: event.slug,
    description: event.description,
    bannerUrl: event.bannerUrl ?? "",
    startAt: toDateTimeLocalValue(event.startAt),
    endAt: toDateTimeLocalValue(event.endAt),
    locationName: event.locationName,
    locationAddress: event.locationAddress ?? "",
  };
}

interface EventFormDialogProps {
  target: MerchantEventDto | "new" | null;
  busy: boolean;
  error: string;
  onClose(): void;
  onSubmit(payload: CreateEventInput | UpdateEventInput): Promise<void>;
}

type EventTab = "schedule" | "content";

export function EventFormDialog({ target, busy, error, onClose, onSubmit }: EventFormDialogProps) {
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [activeTab, setActiveTab] = useState<EventTab>("schedule");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (target) {
      setForm(toFormState(target));
      setActiveTab("schedule");
      setValidationError("");
    }
  }, [target]);

  async function handleSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    if (busy || !target) return;

    const title = form.title.trim();
    const slug = form.slug.trim();
    const description = form.description.trim();
    const bannerUrl = form.bannerUrl.trim();
    const locationName = form.locationName.trim();
    const locationAddress = form.locationAddress.trim();

    if (!title) {
      setActiveTab("schedule");
      setValidationError("Vui lòng nhập tiêu đề sự kiện.");
      return;
    }
    if (slug && !EVENT_SLUG_PATTERN.test(slug)) {
      setActiveTab("schedule");
      setValidationError("Slug chỉ gồm chữ thường, số và dấu gạch nối (ví dụ: workshop-ca-phe).");
      return;
    }
    if (target !== "new" && !slug) {
      setActiveTab("schedule");
      setValidationError("Slug sự kiện không được để trống khi cập nhật.");
      return;
    }

    const startIso = fromDateTimeLocalValue(form.startAt);
    const endIso = fromDateTimeLocalValue(form.endAt);
    if (!startIso || !endIso) {
      setActiveTab("schedule");
      setValidationError("Vui lòng chọn thời gian bắt đầu và kết thúc hợp lệ.");
      return;
    }
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setActiveTab("schedule");
      setValidationError("Thời gian kết thúc phải sau thời gian bắt đầu.");
      return;
    }

    if (!locationName) {
      setActiveTab("content");
      setValidationError("Vui lòng nhập tên địa điểm.");
      return;
    }
    if (!description) {
      setActiveTab("content");
      setValidationError("Vui lòng nhập mô tả sự kiện.");
      return;
    }
    if (bannerUrl && !isValidEventBannerUrl(bannerUrl)) {
      setActiveTab("content");
      setValidationError("Ảnh bìa phải bắt đầu bằng https://, http://, /images/ hoặc /uploads/.");
      return;
    }

    setValidationError("");
    const payload: CreateEventInput | UpdateEventInput = {
      title,
      ...(slug ? { slug } : {}),
      description,
      bannerUrl: bannerUrl || null,
      startAt: startIso,
      endAt: endIso,
      locationName,
      locationAddress: locationAddress || null,
    };

    await onSubmit(payload);
  }

  const displayError = validationError || error;

  return (
    <Dialog.Root open={target !== null} onOpenChange={(open) => !open && !busy && onClose()}>
      {target && (
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#0f1d14]/40 backdrop-blur-[2px] transition-opacity" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[#e3e9e1] p-6 shadow-2xl outline-none">
            {/* Nội dung bên trong scale 80% */}
            <div className="merchant-cms" style={{ zoom: 0.82 }}>
              {/* Header with Close button */}
              <div className="relative mb-3.5 pr-8">
                <Dialog.Title className="text-base font-bold text-[#1f3829]">
                  {target === "new" ? "Tạo sự kiện mới" : `Chỉnh sửa sự kiện #${target.id}`}
                </Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-[#607767]">
                  Nội dung hiển thị dạng văn bản an toàn trên trang sự kiện cửa hàng.
                </Dialog.Description>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  aria-label="Đóng"
                  className="absolute -right-1 -top-1 rounded-lg p-1.5 text-[#738879] transition hover:bg-[#edf2ed] hover:text-[#1f3829]"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              {/* Ant Design Segmented Control */}
              <Segmented<EventTab>
                value={activeTab}
                onChange={setActiveTab}
                block
                options={[
                  {
                    value: "schedule",
                    label: (
                      <span className="flex items-center justify-center gap-1.5 py-0.5 text-xs font-semibold">
                        <CalendarDots size={15} />
                        Thông tin & Lịch trình
                      </span>
                    ),
                  },
                  {
                    value: "content",
                    label: (
                      <span className="flex items-center justify-center gap-1.5 py-0.5 text-xs font-semibold">
                        <MapPin size={15} />
                        Địa điểm & Nội dung
                      </span>
                    ),
                  },
                ]}
                className="mb-4 bg-[#edf2ed] p-1"
              />

              {/* Ant Design Form */}
              <Form layout="vertical" onFinish={() => void handleSubmit()} requiredMark={false}>
                {/* Tab 1: Thông tin & Lịch trình */}
                <div
                  className={activeTab === "schedule" ? "space-y-1" : "hidden"}
                  role="tabpanel"
                  aria-label="Thông tin & Lịch trình"
                >
                  <div className="grid grid-cols-1 gap-x-3.5 sm:grid-cols-2">
                    <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Tiêu đề sự kiện *</span>}>
                      <Input
                        aria-label="Tiêu đề sự kiện"
                        maxLength={191}
                        placeholder="Ví dụ: Workshop pha chế cuối tuần"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                    <Form.Item
                      label={<span className="text-xs font-medium text-[#20392a]">Đường dẫn (slug)</span>}
                      extra={<span className="text-[11px] text-[#718576]">Để trống để tự tạo từ tiêu đề</span>}
                    >
                      <Input
                        aria-label="Đường dẫn (slug)"
                        maxLength={191}
                        placeholder="workshop-pha-che-cuoi-tuan"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                    <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Thời gian bắt đầu *</span>}>
                      <Input
                        type="datetime-local"
                        aria-label="Thời gian bắt đầu"
                        value={form.startAt}
                        onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                    <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Thời gian kết thúc *</span>}>
                      <Input
                        type="datetime-local"
                        aria-label="Thời gian kết thúc"
                        value={form.endAt}
                        onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                  </div>
                </div>

                {/* Tab 2: Địa điểm & Nội dung */}
                <div
                  className={activeTab === "content" ? "space-y-1" : "hidden"}
                  role="tabpanel"
                  aria-label="Địa điểm & Nội dung"
                >
                  <div className="grid grid-cols-1 gap-x-3.5 sm:grid-cols-2">
                    <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Tên địa điểm *</span>}>
                      <Input
                        aria-label="Tên địa điểm"
                        maxLength={191}
                        placeholder="Cửa hàng Quận 1"
                        value={form.locationName}
                        onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                    <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Địa chỉ chi tiết (tùy chọn)</span>}>
                      <Input
                        aria-label="Địa chỉ chi tiết"
                        maxLength={500}
                        placeholder="123 Lê Lợi, Quận 1, TP.HCM"
                        value={form.locationAddress}
                        onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
                        className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                      />
                    </Form.Item>
                    <div className="sm:col-span-2">
                      <Form.Item
                        label={<span className="text-xs font-medium text-[#20392a]">URL ảnh bìa (tùy chọn)</span>}
                        extra={<span className="text-[11px] text-[#718576]">Hỗ trợ https://..., http://..., /images/... hoặc /uploads/...</span>}
                      >
                        <Input
                          aria-label="URL ảnh bìa"
                          maxLength={2048}
                          placeholder="/images/independent-cafe.jpg"
                          value={form.bannerUrl}
                          onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                          className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                        />
                      </Form.Item>
                    </div>
                    <div className="sm:col-span-2">
                      <Form.Item
                        label={<span className="text-xs font-medium text-[#20392a]">Mô tả sự kiện *</span>}
                        extra={<span className="text-[11px] text-[#718576]">Tối đa 5.000 ký tự, giữ nguyên xuống dòng</span>}
                      >
                        <Input.TextArea
                          aria-label="Mô tả sự kiện"
                          maxLength={5000}
                          rows={4}
                          placeholder="Chia sẻ lịch trình, nội dung nổi bật và lưu ý cho khách ghé thăm..."
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          className="rounded-lg border-[#dbe3d9] text-xs focus:border-[#356b43]"
                        />
                      </Form.Item>
                    </div>
                  </div>
                </div>

                {displayError && (
                  <Alert
                    type="error"
                    showIcon
                    title={displayError}
                    className="mb-3.5 rounded-lg text-xs"
                  />
                )}

                <div className="flex justify-end gap-2.5 border-t border-[#edf1ea] pt-3.5">
                  <Button onClick={onClose} disabled={busy} className="rounded-lg text-xs font-medium">
                    Hủy
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={busy}
                    className="rounded-lg bg-[#20392a] text-xs font-semibold text-white hover:!bg-[#2e523c]"
                  >
                    {target === "new" ? "Tạo bản nháp" : "Lưu thay đổi"}
                  </Button>
                </div>
              </Form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
