import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type {
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { MerchantLoyaltyTransactions } from "../MerchantLoyaltyTransactions";
import { MerchantLoyaltyHistory } from "../MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "../MerchantLoyaltyMembers";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { api, message, useToken } from "../merchant-page-support";
import { LoyaltyPolicyEditor } from "./LoyaltyPolicyEditor";

export function MerchantLoyalty() {
  const token = useToken();
  const resource = useResource(() => api.getLoyaltyConfig(token), [token]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState(20);
  const history = useResource(() => api.getLoyaltyPolicyHistory(token, { page: historyPage, limit: historyLimit }), [token, historyPage, historyLimit]);
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
                <LoyaltyPolicyEditor
                  config={config}
                  form={form}
                  isNewPolicy={isNewPolicy}
                  hasChanges={hasChanges}
                  isEditorRoute={isEditorRoute}
                  isDirty={isDirty}
                  busy={busy}
                  canEditPolicy={canEditPolicy}
                  configSection={configSection}
                  onConfigSectionChange={setConfigSection}
                  editingPolicy={editingPolicy}
                  onEditingPolicyChange={setEditingPolicy}
                  onSave={requestSave}
                  setDraft={setDraft}
                  previewAmount={previewAmount}
                  setPreviewAmount={setPreviewAmount}
                  previewTier={previewTier}
                  setPreviewTier={setPreviewTier}
                  previewBusy={previewBusy}
                  previewError={previewError}
                  previewResult={previewResult}
                  onRunPreview={() => void runFormulaPreview()}
                  expandedTiers={expandedTiers}
                  setExpandedTiers={setExpandedTiers}
                  showOptional={showOptional}
                  setShowOptional={setShowOptional}
                  resetBusy={resetBusy}
                  onRequestReset={() => setConfirmingAction("reset")}
                  error={error}
                  notice={notice}
                />
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
              <MerchantLoyaltyHistory versions={history.data?.versions ?? []} currentConfig={config}
                currentVersion={history.data?.current} pagination={history.data?.pagination}
                onPageChange={(page, limit) => { setHistoryPage(page); setHistoryLimit(limit); }} />
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
