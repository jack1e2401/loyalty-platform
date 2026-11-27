import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, CalendarDots, MapPin } from "@phosphor-icons/react";
import type { CreateEventInput, MerchantEventDto, UpdateEventInput } from "../../api/events-types";
import { BusyLabel, Button, Field, Input, Textarea } from "../../components/ui";
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
          <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7">
            <Dialog.Title className="text-lg font-extrabold text-[#20392a]">
              {target === "new" ? "Tạo sự kiện mới" : `Chỉnh sửa sự kiện #${target.id}`}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-xs muted">
              Nội dung sự kiện hiển thị dạng văn bản thuần an toàn trên trang công khai cửa hàng.
            </Dialog.Description>

            {/* Tab navigation */}
            <div className="mt-5 flex border-b border-[#e3e9e2] gap-2" role="tablist" aria-label="Phân nhóm sự kiện">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "schedule"}
                onClick={() => setActiveTab("schedule")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${
                  activeTab === "schedule"
                    ? "border-[#356b43] text-[#20392a]"
                    : "border-transparent text-[#607767] hover:text-[#20392a]"
                }`}
              >
                <CalendarDots size={16} aria-hidden="true" />
                1. Thông tin & Thời gian
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "content"}
                onClick={() => setActiveTab("content")}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition ${
                  activeTab === "content"
                    ? "border-[#356b43] text-[#20392a]"
                    : "border-transparent text-[#607767] hover:text-[#20392a]"
                }`}
              >
                <MapPin size={16} aria-hidden="true" />
                2. Địa điểm & Nội dung
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
              {/* Tab 1: Thông tin & Thời gian */}
              <div className={activeTab === "schedule" ? "space-y-4" : "hidden"} role="tabpanel" aria-label="Thông tin & Thời gian">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Tiêu đề sự kiện">
                    <Input
                      required
                      maxLength={191}
                      placeholder="Ví dụ: Workshop pha chế cuối tuần"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </Field>
                  <Field label="Đường dẫn (slug)" hint="Để trống để tự tạo từ tiêu đề">
                    <Input
                      maxLength={191}
                      placeholder="workshop-pha-che-cuoi-tuan"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    />
                  </Field>
                  <Field label="Thời gian bắt đầu">
                    <Input
                      type="datetime-local"
                      required
                      value={form.startAt}
                      onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                    />
                  </Field>
                  <Field label="Thời gian kết thúc">
                    <Input
                      type="datetime-local"
                      required
                      value={form.endAt}
                      onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => setActiveTab("content")}
                  >
                    Tiếp theo: Địa điểm & Nội dung <ArrowRight size={14} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Tab 2: Địa điểm & Nội dung */}
              <div className={activeTab === "content" ? "space-y-4" : "hidden"} role="tabpanel" aria-label="Địa điểm & Nội dung">
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <Field label="Tên địa điểm">
                    <Input
                      required
                      maxLength={191}
                      placeholder="Cửa hàng Quận 1"
                      value={form.locationName}
                      onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                    />
                  </Field>
                  <Field label="Địa chỉ chi tiết (tùy chọn)">
                    <Input
                      maxLength={500}
                      placeholder="123 Lê Lợi, Quận 1, TP.HCM"
                      value={form.locationAddress}
                      onChange={(e) => setForm({ ...form, locationAddress: e.target.value })}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field
                      label="URL ảnh bìa (tùy chọn)"
                      hint="Hỗ trợ https://..., http://..., /images/... hoặc /uploads/..."
                    >
                      <Input
                        maxLength={2048}
                        placeholder="/images/independent-cafe.jpg"
                        value={form.bannerUrl}
                        onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Mô tả sự kiện" hint="Tối đa 5.000 ký tự, giữ nguyên xuống dòng">
                      <Textarea
                        required
                        maxLength={5000}
                        rows={4}
                        placeholder="Chia sẻ lịch trình, nội dung nổi bật và lưu ý cho khách ghé thăm..."
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </Field>
                  </div>
                </div>
                <div className="flex justify-start pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-[#607767]"
                    onClick={() => setActiveTab("schedule")}
                  >
                    <ArrowLeft size={14} aria-hidden="true" /> Quay lại Thông tin & Thời gian
                  </Button>
                </div>
              </div>

              {displayError && (
                <p role="alert" className="rounded-xl bg-[#fae7e3] p-3 text-xs text-[#a4473a]">
                  {displayError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-[#edf1ea] pt-3">
                <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                  Hủy
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <BusyLabel>Đang lưu</BusyLabel> : target === "new" ? "Tạo bản nháp" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </Dialog.Root>
  );
}
