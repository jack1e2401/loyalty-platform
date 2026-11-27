import type { Dispatch, SetStateAction } from "react";
import type { LoyaltyConfigInput } from "../../../api/commerce-types";
import { Button, Field, Input, BusyLabel, Select } from "../../../components/ui";

type Props = {
  configSection: "program" | "tiers" | "reset";
  form: LoyaltyConfigInput;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  resetBusy: boolean;
  canEditPolicy: boolean;
  onRequestReset: () => void;
};

function resolvePreviewTierName(form: LoyaltyConfigInput, targetPoints: number): string {
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
  canEditPolicy,
  onRequestReset,
}: Props) {
  const targetPoints = Number.isFinite(form.reset.targetPoints) ? Math.max(0, Math.floor(form.reset.targetPoints ?? 0)) : 0;
  const previewTierName = resolvePreviewTierName(form, targetPoints);

  return (
    <>
      {configSection === "reset" && (
        <>
          <section
            aria-label="Thiết lập reset hạng"
            className="space-y-4 rounded-lg border border-[#e5ece3] p-4"
          >
            <h2 className="font-extrabold text-[#20392a]">Cấu hình reset mùa</h2>
            <Field label="Lịch reset">
              <Select
                value={form.reset.enabled ? "true" : "false"}
                onChange={(event) =>
                  setDraft({ ...form, reset: { ...form.reset, enabled: event.target.value === "true" } })
                }
              >
                <option value="false">Tắt</option>
                <option value="true">Bật reset</option>
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
                        setDraft({ ...form, reset: { ...form.reset, targetPoints: Number.isFinite(raw) ? raw : 0 } });
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
                        {targetPoints.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#e5ece3] bg-white p-3">
                      <p className="text-xs text-[#637269]">Điểm xét hạng</p>
                      <p className="mt-1 text-xl font-extrabold tabular-nums text-[#20392a]">
                        {targetPoints.toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[#e5ece3] bg-white p-3">
                      <p className="text-xs text-[#637269]">Hạng sau reset</p>
                      <p className="mt-1 text-xl font-extrabold text-[#315e3c]">{previewTierName}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-[#637269]">
                    Toàn bộ thành viên sẽ được đưa về {targetPoints.toLocaleString("vi-VN")} điểm khả dụng và{" "}
                    {targetPoints.toLocaleString("vi-VN")} điểm xét hạng, đồng thời tính lại hạng tương ứng.
                  </p>
                </div>
              </>
            )}
          </section>
          <section
            aria-label="Thực hiện reset"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead8d4] bg-[#fcf8f7] p-3"
          >
            <div>
              <h3 className="text-sm font-semibold text-[#7a4038]">Thực hiện reset</h3>
              <p className="mt-1 text-xs muted">
                Thao tác này đưa điểm khả dụng và điểm xét hạng của toàn bộ hội viên về mức mục tiêu khi đến ngày đã cấu hình.
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
