import type { Dispatch, SetStateAction } from "react";
import type { LoyaltyConfigInput } from "../../../api/commerce-types";
import { Button, Field, Input, BusyLabel, Select } from "../../../components/ui";

type Props = {
  configSection: "program" | "tiers" | "reset";
  form: LoyaltyConfigInput;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  resetBusy: boolean;
  manualResetTarget: number;
  onManualResetTargetChange: (value: number) => void;
  canEditPolicy: boolean;
  onRequestReset: () => void;
  onRequestManualReset: () => void;
};

export function resolvePreviewTierName(form: LoyaltyConfigInput, targetPoints: number): string {
  const sorted = [...form.tiers]
    .filter((tier) => (tier.minLifetimePoints ?? 0) <= targetPoints)
    .sort((a, b) => (b.minLifetimePoints ?? 0) - (a.minLifetimePoints ?? 0));
  const matched = sorted[0] ?? form.tiers[0];
  return matched?.name ?? matched?.level ?? "Default";
}

export function LoyaltyResetSettings({
  configSection,
  form,
  setDraft,
  resetBusy,
  manualResetTarget,
  onManualResetTargetChange,
  canEditPolicy,
  onRequestReset,
  onRequestManualReset,
}: Props) {
  const scheduledTarget = Number.isFinite(form.reset.targetPoints)
    ? Math.max(0, Math.floor(form.reset.targetPoints ?? 0))
    : 0;
  const scheduledTierName = resolvePreviewTierName(form, scheduledTarget);
  const manualTarget = Number.isFinite(manualResetTarget) ? Math.max(0, Math.floor(manualResetTarget)) : 0;
  const manualTierName = resolvePreviewTierName(form, manualTarget);

  return (
    <>
      {configSection === "reset" && (
        <>
          <section
            aria-label="Thiết lập reset hạng"
            className="space-y-4 rounded-lg border border-[#e5ece3] p-4"
          >
            <div>
              <h2 className="font-extrabold text-[#20392a]">Lịch reset tự động theo chu kỳ (Cronjob)</h2>
              <p className="mt-1 text-xs muted">
                Hệ thống tự động kiểm tra vào 00:05 hằng ngày (giờ Việt Nam) và reset 1 lần mỗi năm khi trùng ngày đã cấu hình.
              </p>
            </div>
            <Field label="Lịch reset">
              <Select
                value={form.reset.enabled ? "true" : "false"}
                onChange={(event) =>
                  setDraft({ ...form, reset: { ...form.reset, enabled: event.target.value === "true" } })
                }
              >
                <option value="false">Tắt</option>
                <option value="true">Bật reset tự động</option>
              </Select>
            </Field>
            {form.reset.enabled && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Ngày reset hằng năm">
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.reset.day}
                      onChange={(event) =>
                        setDraft({ ...form, reset: { ...form.reset, day: Number(event.target.value) } })
                      }
                    />
                  </Field>
                  <Field label="Tháng reset">
                    <Input
                      type="number"
                      min={1}
                      max={12}
                      value={form.reset.month}
                      onChange={(event) =>
                        setDraft({ ...form, reset: { ...form.reset, month: Number(event.target.value) } })
                      }
                    />
                  </Field>
                  <Field label="Điểm mục tiêu sau reset">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={form.reset.targetPoints ?? 0}
                      onChange={(event) => {
                        const raw = event.target.value === "" ? 0 : Math.max(0, Math.floor(Number(event.target.value)));
                        const nextVal = Number.isFinite(raw) ? raw : 0;
                        setDraft({ ...form, reset: { ...form.reset, targetPoints: nextVal } });
                        onManualResetTargetChange(nextVal);
                      }}
                    />
                  </Field>
                </div>
                <div className="rounded-xl border border-[#dce6d9] bg-[#f7f9f5] p-4">
                  <p className="text-xs font-bold uppercase tracking-[.06em] text-[#53685a]">Kết quả dự kiến</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-[#e5ece3] bg-white p-3">
                      <p className="text-xs text-[#637269]">Điểm khả dụng</p>
                      <p className="mt-1 text-xl font-extrabold tabular-nums text-[#20392a]">
                        {scheduledTarget.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#e5ece3] bg-white p-3">
                      <p className="text-xs text-[#637269]">Điểm xét hạng</p>
                      <p className="mt-1 text-xl font-extrabold tabular-nums text-[#20392a]">
                        {scheduledTarget.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#e5ece3] bg-white p-3">
                      <p className="text-xs text-[#637269]">Hạng sau reset</p>
                      <p className="mt-1 text-xl font-extrabold text-[#315e3c]">{scheduledTierName}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>

          <section
            aria-label="Reset mùa thủ công"
            className="space-y-4 rounded-lg border border-[#dce6d9] bg-[#f8fbf7] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-[#20392a]">Reset mùa thủ công ngay</h3>
                <p className="mt-1 text-xs muted">
                  Chốt mùa hiện tại và đưa toàn bộ hội viên về điểm mục tiêu ngay lập tức, không cần đợi đến ngày cronjob.
                </p>
              </div>
              <Button
                type="button"
                disabled={resetBusy || !canEditPolicy}
                onClick={() => onRequestManualReset()}
              >
                {resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Reset mùa ngay"}
              </Button>
            </div>
            <div className="grid items-end gap-4 sm:grid-cols-3">
              <Field label="Điểm mục tiêu reset ngay">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={manualTarget}
                  onChange={(event) => {
                    const raw = event.target.value === "" ? 0 : Math.max(0, Math.floor(Number(event.target.value)));
                    onManualResetTargetChange(Number.isFinite(raw) ? raw : 0);
                  }}
                />
              </Field>
              <div className="rounded-lg border border-[#e5ece3] bg-white p-3 sm:col-span-2">
                <p className="text-xs text-[#637269]">Dự kiến sau khi bấm Reset mùa ngay</p>
                <p className="mt-1 text-sm font-bold text-[#20392a]">
                  Điểm khả dụng &amp; xét hạng: <span className="tabular-nums">{manualTarget.toLocaleString("vi-VN")}</span> điểm · Hạng:{" "}
                  <span className="text-[#315e3c]">{manualTierName}</span>
                </p>
              </div>
            </div>
          </section>

          <section
            aria-label="Thực hiện reset"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead8d4] bg-[#fcf8f7] p-3"
          >
            <div>
              <h3 className="text-sm font-semibold text-[#7a4038]">Kiểm tra chạy reset định kỳ đến hạn</h3>
              <p className="mt-1 text-xs muted">
                Chỉ chạy khi hôm nay (giờ Việt Nam) trùng ngày/tháng đã bật ở lịch tự động phía trên, tối đa 1 lần mỗi năm.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!form.reset.enabled || resetBusy || !canEditPolicy}
              onClick={() => onRequestReset()}
            >
              {resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Chạy reset đến hạn"}
            </Button>
          </section>
        </>
      )}
    </>
  );
}
