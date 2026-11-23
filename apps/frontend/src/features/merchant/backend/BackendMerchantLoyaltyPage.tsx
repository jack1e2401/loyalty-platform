import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type {
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { Button, BusyLabel, Card, EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { MerchantLoyaltyTransactions } from "../MerchantLoyaltyTransactions";
import { MerchantLoyaltyHistory } from "../MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "../MerchantLoyaltyMembers";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { api, message, useToken } from "../merchant-page-support";
import { LoyaltyTierSettings } from "./LoyaltyTierSettings";
import { LoyaltyProgramSettings } from "./LoyaltyProgramSettings";

export function MerchantLoyalty() {
  const token = useToken();
  const resource = useResource(() => api.getLoyaltyConfig(token), [token]);
  const history = useResource(() => api.getLoyaltyPolicyHistory(token), [token]);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const editorMode = params.get("mode");
  const isNewPolicy = editorMode === "new";
  const isEditorRoute = editorMode === "new" || editorMode === "edit";
  const activeTab = pathname.endsWith("/transactions")
    ? "ledger"
    : pathname.endsWith("/history")
      ? "history"
      : pathname.endsWith("/members")
        ? "members"
        : "config";
  const [draft, setDraft] = useState<LoyaltyConfigInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [configSection, setConfigSection] = useState<"program" | "tiers" | "reset">("program");
  const [showOptional, setShowOptional] = useState<Record<string, boolean>>({});
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({});
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<"publish" | "reset" | null>(null);

  // Formula preview state
  const [previewAmount, setPreviewAmount] = useState("");
  const [previewTier, setPreviewTier] = useState<TierLevel | "">("");
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewResult, setPreviewResult] = useState<MerchantLoyaltyPreviewResponse | null>(null);

  const config = resource.data?.config;
  const form =
    draft ??
    (config
      ? {
          vndPerPoint: config.vndPerPoint,
          isActive: config.isActive,
          qualificationMode: config.qualificationMode,
          reset: { ...config.reset },
          tiers: config.tiers.map((tier) => ({ ...tier })),
        }
      : null);
  const canEditPolicy = isEditorRoute || editingPolicy;
  const hasChanges = Boolean(
    config &&
    form &&
    JSON.stringify(form) !==
      JSON.stringify({
        vndPerPoint: config.vndPerPoint,
        isActive: config.isActive,
        qualificationMode: config.qualificationMode,
        reset: config.reset,
        tiers: config.tiers,
      }),
  );
  const isDirty = isNewPolicy || hasChanges;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("loyalty-config-dirty", { detail: hasChanges }));
    return () => {
      window.dispatchEvent(new CustomEvent("loyalty-config-dirty", { detail: false }));
    };
  }, [hasChanges]);

  function requestSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy || !isDirty || !canEditPolicy) return;
    setConfirmingAction("publish");
  }

  async function save(): Promise<boolean> {
    if (!form || busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.putLoyaltyConfig(
        { ...form, ...(isNewPolicy ? { publishAsNewVersion: true } : {}) },
        token,
      );
      resource.setData(result);
      history.reload();
      setDraft(null);
      setEditingPolicy(false);
      setNotice("Đã phát hành phiên bản chính sách mới.");
      navigate("/merchant/loyalty/history");
      return true;
    } catch (reason) {
      setError(message(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function runFormulaPreview() {
    if (!previewAmount || previewBusy) return;
    setPreviewBusy(true);
    setPreviewError("");
    try {
      const result = await api.previewMerchantLoyalty(
        {
          netOrderAmountVnd: previewAmount,
          ...(previewTier ? { tierLevel: previewTier } : {}),
        },
        token,
      );
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Không thể tính thử điểm");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function runTierReset(): Promise<boolean> {
    if (resetBusy) return false;
    setResetBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.runTierReset(token);
      setNotice(
        result.alreadyProcessed
          ? `Chu kỳ ${result.cycleYear} đã được xử lý (${result.processedCount} hội viên).`
          : `Đã xử lý ${result.processedCount} hội viên cho chu kỳ ${result.cycleYear}.`,
      );
      return true;
    } catch (reason) {
      const code = message(reason);
      setError(
        code.includes("TIER_RESET_NOT_DUE")
          ? "Chỉ có thể chạy reset vào ngày đã cấu hình theo giờ Việt Nam."
          : code.includes("TIER_RESET_DISABLED")
            ? "Hãy bật và lưu lịch reset trước."
            : code,
      );
      return false;
    } finally {
      setResetBusy(false);
    }
  }

  async function confirmPendingAction() {
    const succeeded =
      confirmingAction === "publish"
        ? await save()
        : confirmingAction === "reset"
          ? await runTierReset()
          : false;
    if (succeeded) setConfirmingAction(null);
  }

  if (activeTab === "config" && !isEditorRoute) {
    return <Navigate to="/merchant/loyalty/history" replace />;
  }

  return (
    <>
      <div className="space-y-2">
        {(activeTab === "config" ||
          activeTab === "ledger" ||
          activeTab === "history" ||
          activeTab === "members") && (
          <>
            {activeTab === "config" ? (
              resource.loading ? (
                <LoadingState cards={2} />
              ) : resource.error ? (
                <ErrorState message={resource.error} retry={resource.reload} />
              ) : !config || !form ? (
                <EmptyState title="Chưa có cấu hình" description="Cấu hình chưa khả dụng." />
              ) : (
                <div className="mx-auto w-full max-w-5xl space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h1 className="text-xl font-semibold text-[#294833]">
                        {isNewPolicy ? "Tạo chính sách mới" : "Chỉnh sửa chính sách hiện tại"}
                      </h1>
                      <p className="mt-1 text-xs text-[#718075]">
                        Khi phát hành, hệ thống tạo phiên bản mới và giữ nguyên lịch sử trước đó.
                      </p>
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
                      Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau
                      này.
                    </p>
                    <p className="mt-1">
                      Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.
                    </p>
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
                            onClick={() => setConfigSection(key)}
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
                              onChange={(event) => setEditingPolicy(event.target.checked)}
                            />
                            Chỉnh sửa chính sách
                          </label>
                        )}
                        {isDirty && (
                          <Button
                            type="submit"
                            form="loyalty-config-form"
                            disabled={busy || !canEditPolicy}
                            size="sm"
                          >
                            {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}
                          </Button>
                        )}
                      </div>
                    </div>
                    <form id="loyalty-config-form" onSubmit={requestSave} className="space-y-3">
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
                          onRunPreview={() => void runFormulaPreview()}
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
                          canEditPolicy={canEditPolicy}
                          onRequestReset={() => setConfirmingAction("reset")}
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
              )
            ) : activeTab === "ledger" ? (
              <MerchantLoyaltyTransactions />
            ) : activeTab === "members" ? (
              <MerchantLoyaltyMembers token={token} memberId={params.get("memberId")} />
            ) : history.loading ? (
              <LoadingState cards={2} />
            ) : history.error ? (
              <ErrorState message={history.error} retry={history.reload} />
            ) : (
              <Card className="mx-auto w-full max-w-5xl p-3 sm:p-4">
                <MerchantLoyaltyHistory versions={history.data?.versions ?? []} currentConfig={config} />
              </Card>
            )}
          </>
        )}
      </div>
      <ConfirmActionDialog
        open={confirmingAction !== null}
        onOpenChange={(open) => {
          if (!open && !busy && !resetBusy) setConfirmingAction(null);
        }}
        title={confirmingAction === "reset" ? "Chạy reset hạng đến hạn?" : "Phát hành chính sách mới?"}
        description={
          confirmingAction === "reset"
            ? "Hạng và tiến trình xét hạng của hội viên đủ điều kiện sẽ được cập nhật theo lịch đã lưu. Ví điểm và lịch sử giao dịch được giữ nguyên."
            : "Thay đổi sẽ được lưu thành một phiên bản chính sách mới. Các phiên bản đã phát hành trước đó vẫn được giữ nguyên. Chỉ tiếp tục nếu bạn muốn áp dụng cấu hình này cho các đơn hàng sau."
        }
        confirmLabel={confirmingAction === "reset" ? "Chạy reset" : "Phát hành phiên bản mới"}
        busy={confirmingAction === "reset" ? resetBusy : busy}
        error={error || undefined}
        onConfirm={() => void confirmPendingAction()}
      />
    </>
  );
}
