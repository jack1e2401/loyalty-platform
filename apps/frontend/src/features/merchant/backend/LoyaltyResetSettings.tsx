import { useState, type Dispatch, type SetStateAction } from "react";
import { CalendarBlank, Lightning } from "@phosphor-icons/react";
import type { LoyaltyConfigInput, LoyaltyTierDto } from "../../../api/commerce-types";
import { BusyLabel, Button, Field, Input } from "../../../components/ui";

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

type ResetMode = "scheduled" | "manual";

function resolvePreviewTier(form: LoyaltyConfigInput, targetPoints: number): LoyaltyTierDto | undefined {
  const sorted = [...form.tiers]
    .filter((tier) => (tier.minLifetimePoints ?? 0) <= targetPoints)
    .sort((a, b) => (b.minLifetimePoints ?? 0) - (a.minLifetimePoints ?? 0));
  return sorted[0] ?? form.tiers[0];
}

export function resolvePreviewTierName(form: LoyaltyConfigInput, targetPoints: number): string {
  const matched = resolvePreviewTier(form, targetPoints);
  return matched?.name ?? matched?.level ?? "Default";
}

function tierDotColor(tier: LoyaltyTierDto | undefined): string {
  return tier?.color && /^#[0-9A-Fa-f]{6}$/.test(tier.color) ? tier.color : "#315e3c";
}

function TierPresetChips({
  tiers,
  activeTarget,
  disabled,
  onSelect,
}: {
  tiers: LoyaltyTierDto[];
  activeTarget: number;
  disabled: boolean;
  onSelect: (points: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Chọn nhanh theo ngưỡng hạng">
      {tiers.map((tier) => {
        const threshold = Math.max(0, Math.floor(tier.minLifetimePoints ?? 0));
        const selected = activeTarget === threshold;
        return (
          <button
            key={tier.level}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(threshold)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
              selected
                ? "border-[#315e3c] bg-[#edf5ea] text-[#20392a]"
                : "border-[#e2e9e0] bg-white text-[#53685a] hover:border-[#b9ccb4] hover:text-[#20392a]"
            } disabled:pointer-events-none disabled:opacity-60`}
          >
            <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: tierDotColor(tier) }} />
            <span>{tier.name ?? tier.level}</span>
            <span className="tabular-nums opacity-75">· {threshold.toLocaleString("vi-VN")}</span>
          </button>
        );
      })}
    </div>
  );
}

function ResetOutcomePreview({
  targetPoints,
  tier,
  label,
}: {
  targetPoints: number;
  tier: LoyaltyTierDto | undefined;
  label: string;
}) {
  const tierName = tier?.name ?? tier?.level ?? "Default";
  const formatted = targetPoints.toLocaleString("vi-VN");
  return (
    <div className="rounded-2xl border border-[#e3ebe0] bg-[#f7faf6] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[#5c7262]">{label}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(32,57,42,0.04)]">
          <p className="text-xs text-[#637269]">Điểm khả dụng</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-[#20392a]">{formatted}</p>
        </div>
        <div className="rounded-xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(32,57,42,0.04)]">
          <p className="text-xs text-[#637269]">Điểm xét hạng</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-[#20392a]">{formatted}</p>
        </div>
        <div className="rounded-xl bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(32,57,42,0.04)]">
          <p className="text-xs text-[#637269]">Hạng sau reset</p>
          <p className="mt-1.5 flex items-center gap-2 truncate text-base font-extrabold text-[#20392a]">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tierDotColor(tier) }} />
            <span className="truncate">{tierName}</span>
          </p>
        </div>
      </div>
    </div>
  );
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
  const [activeMode, setActiveMode] = useState<ResetMode>("scheduled");

  if (configSection !== "reset") return null;

  const scheduledTarget = Number.isFinite(form.reset.targetPoints)
    ? Math.max(0, Math.floor(form.reset.targetPoints ?? 0))
    : 0;
  const scheduledTier = resolvePreviewTier(form, scheduledTarget);
  const manualTarget = Number.isFinite(manualResetTarget) ? Math.max(0, Math.floor(manualResetTarget)) : 0;
  const manualTier = resolvePreviewTier(form, manualTarget);

  function updateScheduledTarget(nextVal: number) {
    setDraft({ ...form, reset: { ...form.reset, targetPoints: nextVal } });
    onManualResetTargetChange(nextVal);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2" role="tablist" aria-label="Chọn chế độ reset">
        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "scheduled"}
          onClick={() => setActiveMode("scheduled")}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-left transition ${
            activeMode === "scheduled"
              ? "border-[#315e3c] bg-[#f4f9f2] shadow-[0_6px_20px_-14px_rgba(49,94,60,0.45)]"
              : "border-[#e3ebe0] bg-white opacity-75 hover:border-[#c3d3be] hover:opacity-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
                activeMode === "scheduled" ? "bg-[#315e3c] text-white" : "bg-[#eef4ec] text-[#315e3c]"
              }`}
            >
              <CalendarBlank size={20} weight="duotone" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-[#20392a]">Lịch reset tự động</p>
              <p className="mt-0.5 text-xs text-[#637269]">Cronjob 00:05 hằng ngày · Tối đa 1 lần/năm</p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              form.reset.enabled ? "bg-[#dcebd7] text-[#295334]" : "bg-[#eef2ec] text-[#637269]"
            }`}
          >
            {form.reset.enabled
              ? `${String(form.reset.day).padStart(2, "0")}/${String(form.reset.month).padStart(2, "0")}`
              : "Đang tắt"}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeMode === "manual"}
          onClick={() => setActiveMode("manual")}
          className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-left transition ${
            activeMode === "manual"
              ? "border-[#315e3c] bg-[#f4f9f2] shadow-[0_6px_20px_-14px_rgba(49,94,60,0.45)]"
              : "border-[#e3ebe0] bg-white opacity-75 hover:border-[#c3d3be] hover:opacity-100"
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
                activeMode === "manual" ? "bg-[#315e3c] text-white" : "bg-[#eef4ec] text-[#315e3c]"
              }`}
            >
              <Lightning size={20} weight="fill" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-[#20392a]">Reset mùa thủ công</p>
              <p className="mt-0.5 text-xs text-[#637269]">Chốt mùa &amp; mở mùa mới ngay lúc bấm</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[#eef4ec] px-2.5 py-0.5 text-[11px] font-bold text-[#315e3c]">
            Tức thì
          </span>
        </button>
      </div>

      {activeMode === "scheduled" ? (
        <section
          aria-label="Thiết lập reset hạng"
          className="space-y-5 rounded-2xl border border-[#dce6d9] bg-white p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3ec] pb-4">
            <div>
              <h2 className="text-base font-extrabold text-[#20392a]">Cấu hình lịch tự động (Cronjob)</h2>
              <p className="mt-0.5 text-xs text-[#637269]">
                Hệ thống tự động kiểm tra vào 00:05 hằng ngày theo giờ Việt Nam và reset khi trùng ngày cấu hình.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.reset.enabled}
              aria-label="Bật lịch reset tự động"
              onClick={() => setDraft({ ...form, reset: { ...form.reset, enabled: !form.reset.enabled } })}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                form.reset.enabled
                  ? "border-[#315e3c] bg-[#315e3c] text-white"
                  : "border-[#dbe2d8] bg-[#f4f7f3] text-[#5d6e62]"
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${form.reset.enabled ? "bg-[#c5e89b]" : "bg-[#97a69b]"}`}
              />
              {form.reset.enabled ? "Đang bật" : "Đang tắt"}
            </button>
          </div>

          {form.reset.enabled ? (
            <div className="space-y-4">
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
                    value={scheduledTarget}
                    onChange={(event) => {
                      const raw = event.target.value === "" ? 0 : Math.max(0, Math.floor(Number(event.target.value)));
                      updateScheduledTarget(Number.isFinite(raw) ? raw : 0);
                    }}
                  />
                </Field>
              </div>
              <TierPresetChips
                tiers={form.tiers}
                activeTarget={scheduledTarget}
                disabled={!canEditPolicy}
                onSelect={updateScheduledTarget}
              />
              <ResetOutcomePreview targetPoints={scheduledTarget} tier={scheduledTier} label="Kết quả dự kiến theo lịch" />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#dce5d9] bg-[#fafcf9] p-5 text-sm text-[#637269]">
              Lịch reset tự động đang tắt. Bật công tắc phía trên để thiết lập ngày reset định kỳ hằng năm, hoặc chuyển sang tab{" "}
              <button
                type="button"
                onClick={() => setActiveMode("manual")}
                className="font-bold text-[#315e3c] underline underline-offset-2"
              >
                Reset mùa thủ công
              </button>{" "}
              để chốt mùa ngay.
            </div>
          )}

          <section
            aria-label="Thực hiện reset"
            className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef3ec] pt-4"
          >
            <p className="text-xs text-[#637269]">
              Chạy kiểm tra cronjob khi hôm nay trùng{" "}
              <span className="font-semibold text-[#20392a]">
                {String(form.reset.day).padStart(2, "0")}/{String(form.reset.month).padStart(2, "0")}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!form.reset.enabled || resetBusy || !canEditPolicy}
              onClick={() => onRequestReset()}
            >
              {resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Chạy reset đến hạn"}
            </Button>
          </section>
        </section>
      ) : (
        <section
          aria-label="Reset mùa thủ công"
          className="space-y-5 rounded-2xl border border-[#cfe0ca] bg-gradient-to-b from-[#f6faf4] to-white p-5 sm:p-6"
        >
          <div className="border-b border-[#e5efe2] pb-4">
            <h2 className="text-base font-extrabold text-[#20392a]">Reset mùa thủ công ngay</h2>
            <p className="mt-0.5 text-xs text-[#53685a]">
              Đặt lại điểm khả dụng và điểm xét hạng của toàn bộ hội viên ngay tại thời điểm bấm nút, không phụ thuộc lịch cronjob.
            </p>
          </div>

          <div className="space-y-3">
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
            <TierPresetChips
              tiers={form.tiers}
              activeTarget={manualTarget}
              disabled={!canEditPolicy}
              onSelect={onManualResetTargetChange}
            />
          </div>

          <ResetOutcomePreview targetPoints={manualTarget} tier={manualTier} label="Áp dụng ngay cho toàn bộ hội viên" />

          <div className="flex justify-end border-t border-[#e5efe2] pt-4">
            <Button
              type="button"
              disabled={resetBusy || !canEditPolicy}
              onClick={() => onRequestManualReset()}
            >
              {resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Reset mùa ngay"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
