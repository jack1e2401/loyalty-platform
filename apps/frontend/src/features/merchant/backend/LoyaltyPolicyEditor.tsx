import { Link } from "react-router-dom";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type {
  LoyaltyConfigDto,
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { Button, BusyLabel, Card } from "../../../components/ui";
import { LoyaltyProgramSettings } from "./LoyaltyProgramSettings";
import { LoyaltyTierSettings } from "./LoyaltyTierSettings";

type ConfigSection = "program" | "tiers" | "reset";
type Props = {
  config: LoyaltyConfigDto;
  form: LoyaltyConfigInput;
  isNewPolicy: boolean;
  hasChanges: boolean;
  isEditorRoute: boolean;
  isDirty: boolean;
  busy: boolean;
  canEditPolicy: boolean;
  configSection: ConfigSection;
  onConfigSectionChange: (section: ConfigSection) => void;
  editingPolicy: boolean;
  onEditingPolicyChange: (editing: boolean) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  previewAmount: string;
  setPreviewAmount: (value: string) => void;
  previewTier: TierLevel | "";
  setPreviewTier: (value: TierLevel | "") => void;
  previewBusy: boolean;
  previewError: string;
  previewResult: MerchantLoyaltyPreviewResponse | null;
  onRunPreview: () => void;
  expandedTiers: Record<string, boolean>;
  setExpandedTiers: Dispatch<SetStateAction<Record<string, boolean>>>;
  showOptional: Record<string, boolean>;
  setShowOptional: Dispatch<SetStateAction<Record<string, boolean>>>;
  resetBusy: boolean;
  manualResetTarget: number;
  onManualResetTargetChange: (value: number) => void;
  onRequestReset: () => void;
  onRequestManualReset: () => void;
  error: string;
  notice: string;
};

export function LoyaltyPolicyEditor({
  config,
  form,
  isNewPolicy,
  hasChanges,
  isEditorRoute,
  isDirty,
  busy,
  canEditPolicy,
  configSection,
  onConfigSectionChange,
  editingPolicy,
  onEditingPolicyChange,
  onSave,
  setDraft,
  previewAmount,
  setPreviewAmount,
  previewTier,
  setPreviewTier,
  previewBusy,
  previewError,
  previewResult,
  onRunPreview,
  expandedTiers,
  setExpandedTiers,
  showOptional,
  setShowOptional,
  resetBusy,
  manualResetTarget,
  onManualResetTargetChange,
  onRequestReset,
  onRequestManualReset,
  error,
  notice,
}: Props) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#294833]">
            {isNewPolicy ? "Tạo chính sách mới" : "Chỉnh sửa chính sách hiện tại"}
          </h1>
        </div>
        <Link
          to="/merchant/loyalty/history"
          onClickCapture={(event) => {
            if (hasChanges) {
              event.preventDefault();
              event.stopPropagation();
              window.alert("Vui lòng lưu cấu hình trước khi rời trang.");
            }
          }}
          className="text-xs font-medium text-[#416b48] hover:underline"
        >
          Quay lại chính sách điểm
        </Link>
      </div>
      <div className="rounded-lg bg-[#fff8eb] px-3 py-2 text-xs leading-4 text-[#97682a]">
        <p className="font-bold">
          Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau này.
        </p>
        <p className="mt-1">Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.</p>
      </div>

      <Card className="p-3 pb-20 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ece3]">
          <div className="flex gap-1">
            {(
              [
                ["program", "Chương trình"],
                ["tiers", "Các hạng"],
                ["reset", "Reset hạng"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onConfigSectionChange(key)}
                className={`border-b-2 px-3 py-2 text-sm ${configSection === key ? "border-[#416b48] font-semibold text-[#294833]" : "border-transparent text-[#718075]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {!isEditorRoute && (
              <label className="flex items-center gap-2 text-xs text-[#53645a]">
                <input
                  type="checkbox"
                  checked={editingPolicy}
                  onChange={(event) => onEditingPolicyChange(event.target.checked)}
                />
                Chỉnh sửa chính sách
              </label>
            )}
            {isDirty && (
              <Button type="submit" form="loyalty-config-form" disabled={busy || !canEditPolicy} size="sm">
                {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}
              </Button>
            )}
          </div>
        </div>
        <form id="loyalty-config-form" onSubmit={onSave} className="space-y-3">
          <fieldset disabled={!canEditPolicy} className="space-y-3 disabled:opacity-70">
            <LoyaltyProgramSettings
              configSection={configSection}
              config={config}
              form={form}
              setDraft={setDraft}
              previewAmount={previewAmount}
              setPreviewAmount={setPreviewAmount}
              previewTier={previewTier}
              setPreviewTier={setPreviewTier}
              previewBusy={previewBusy}
              previewError={previewError}
              previewResult={previewResult}
              onRunPreview={onRunPreview}
            />
            <LoyaltyTierSettings
              configSection={configSection}
              form={form}
              setDraft={setDraft}
              expandedTiers={expandedTiers}
              setExpandedTiers={setExpandedTiers}
              showOptional={showOptional}
              setShowOptional={setShowOptional}
              resetBusy={resetBusy}
              manualResetTarget={manualResetTarget}
              onManualResetTargetChange={onManualResetTargetChange}
              canEditPolicy={canEditPolicy}
              onRequestReset={onRequestReset}
              onRequestManualReset={onRequestManualReset}
            />
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-[#a4473a]">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-[#357044]">
              {notice}
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
