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

export function LoyaltyResetSettings({
  configSection,
  form,
  setDraft,
  resetBusy,
  canEditPolicy,
  onRequestReset,
}: Props) {
  return (
    <>
      {configSection === "reset" && (
        <>
          <section
            aria-label="Thiết lập reset hạng"
            className="space-y-3 rounded-lg border border-[#e5ece3] p-3"
          >
            <h2 className="font-extrabold">Reset hạng hằng năm</h2>
            <Field label="Lịch reset">
              <Select
                value={form.reset.enabled ? "true" : "false"}
                onChange={(event) =>
                  setDraft({ ...form, reset: { ...form.reset, enabled: event.target.value === "true" } })
                }
              >
                <option value="false">Tắt</option>
                <option value="true">Bật</option>
              </Select>
            </Field>
            {form.reset.enabled && (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Tháng">
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
                <Field label="Ngày">
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
                <Field label="Điều chỉnh hạng">
                  <Select
                    value={form.reset.strategy}
                    onChange={(event) =>
                      setDraft({
                        ...form,
                        reset: {
                          ...form.reset,
                          strategy: event.target.value as "ONE_DOWN" | "SELECTED",
                          targetLevel:
                            event.target.value === "SELECTED" ? (form.tiers[0]?.level ?? null) : null,
                        },
                      })
                    }
                  >
                    <option value="ONE_DOWN">Giảm một hạng</option>
                    <option value="SELECTED">Về hạng được chọn</option>
                  </Select>
                </Field>
                {form.reset.strategy === "SELECTED" && (
                  <Field label="Hạng đích">
                    <Select
                      value={form.reset.targetLevel ?? ""}
                      onChange={(event) =>
                        setDraft({ ...form, reset: { ...form.reset, targetLevel: event.target.value } })
                      }
                    >
                      {form.tiers.map((tier) => (
                        <option key={tier.level} value={tier.level}>
                          {tier.name ?? tier.level}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <p className="text-xs muted sm:col-span-3">
                  Reset đặt lại tiến trình về ngưỡng của hạng đích nhưng giữ nguyên điểm có thể đổi. Đủ chi
                  tiêu duy trì sẽ giữ nguyên hạng hiện tại.
                </p>
              </div>
            )}
          </section>
          <section
            aria-label="Thực hiện reset"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead8d4] bg-[#fcf8f7] p-3"
          >
            <div>
              <h3 className="text-sm font-semibold text-[#7a4038]">Thực hiện reset</h3>
              <p className="mt-1 text-xs muted">
                Thao tác này cập nhật hạng và tiến trình xét hạng của hội viên khi đến lịch đã cấu hình.
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
