import type { Dispatch, SetStateAction } from "react";
import type {
  LoyaltyConfigDto,
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { LoyaltyFormula } from "../../../components/LoyaltyFormula";
import { Button, BusyLabel, Field, Input, Select } from "../../../components/ui";

function changeQualificationMode(form: LoyaltyConfigInput, mode: "POINTS" | "SPEND"): LoyaltyConfigInput {
  if (form.qualificationMode === mode) return form;
  return {
    ...form,
    qualificationMode: mode,
    tiers: form.tiers.map((tier, index) => ({
      ...tier,
      minLifetimePoints: mode === "POINTS" && index === 0 ? 0 : undefined,
      minSpendVnd: mode === "SPEND" && index === 0 ? "0" : undefined,
    })),
  };
}

type Props = {
  configSection: "program" | "tiers" | "reset";
  config: LoyaltyConfigDto;
  form: LoyaltyConfigInput;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  previewAmount: string;
  setPreviewAmount: (value: string) => void;
  previewTier: TierLevel | "";
  setPreviewTier: (value: TierLevel | "") => void;
  previewBusy: boolean;
  previewError: string;
  previewResult: MerchantLoyaltyPreviewResponse | null;
  onRunPreview: () => void;
};

export function LoyaltyProgramSettings({
  configSection,
  config,
  form,
  setDraft,
  previewAmount,
  setPreviewAmount,
  previewTier,
  setPreviewTier,
  previewBusy,
  previewError,
  previewResult,
  onRunPreview,
}: Props) {
  return (
    <>
      {configSection === "program" && (
        <>
          <LoyaltyFormula config={config} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="VND cho mỗi điểm">
              <Input
                required
                type="number"
                min={1}
                step={1}
                value={form.vndPerPoint}
                onChange={(event) => setDraft({ ...form, vndPerPoint: Number(event.target.value) })}
              />
            </Field>
            <Field label="Quy tắc tích điểm">
              <Select
                value={form.isActive ? "true" : "false"}
                onChange={(event) => setDraft({ ...form, isActive: event.target.value === "true" })}
              >
                <option value="true">Hoạt động</option>
                <option value="false">Tạm dừng</option>
              </Select>
            </Field>
          </div>
          <Field label="Điều kiện xếp hạng">
            <Select
              value={form.qualificationMode}
              onChange={(event) =>
                setDraft(changeQualificationMode(form, event.target.value as "POINTS" | "SPEND"))
              }
            >
              <option value="POINTS">Điểm tích lũy</option>
              <option value="SPEND">Chi tiêu</option>
            </Select>
          </Field>
          <details className="rounded-lg border border-[#e5ece3] p-3">
            <summary className="cursor-pointer text-sm font-medium">Xem trước công thức (tùy chọn)</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Số tiền đơn hàng thử nghiệm (VND)">
                <Input
                  type="number"
                  min={1}
                  value={previewAmount}
                  onChange={(event) => setPreviewAmount(event.target.value)}
                  placeholder="50000"
                />
              </Field>
              <Field label="Hạng thành viên">
                <Select
                  value={previewTier}
                  onChange={(event) => setPreviewTier(event.target.value as TierLevel | "")}
                >
                  <option value="">Theo cấu hình</option>
                  {config.tiers.map((tier) => (
                    <option key={tier.level} value={tier.level}>
                      {tier.name ?? tier.level}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  disabled={previewBusy || !previewAmount}
                  onClick={() => void onRunPreview()}
                >
                  {previewBusy ? <BusyLabel>Đang tính</BusyLabel> : "Tính thử điểm"}
                </Button>
              </div>
            </div>
            {previewError && (
              <p role="alert" className="mt-2 text-xs text-[#a4473a]">
                {previewError}
              </p>
            )}
            {previewResult && (
              <div className="mt-3 rounded-lg bg-[#edf4e9] p-3 text-xs text-[#46614d]">
                <p className="text-sm font-bold text-[#294833]">
                  Điểm ước tính: <span className="font-mono">{previewResult.estimatedPointsExact}</span> điểm
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Phần nguyên: <b>{previewResult.integerProjection}</b>
                  </span>
                  <span>
                    Phần lẻ: <b>{previewResult.fractionalProjection}</b>
                  </span>
                  <span>
                    Hệ số: <b>{previewResult.multiplier}×</b>
                  </span>
                  <span>
                    Tỷ lệ: <b>{previewResult.vndPerPoint.toLocaleString("vi-VN")} ₫/điểm</b>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-[#637269]">
                  Làm tròn: {previewResult.rounding} · Độ chính xác: {previewResult.scale} chữ số thập phân
                </p>
              </div>
            )}
          </details>
        </>
      )}
    </>
  );
}
