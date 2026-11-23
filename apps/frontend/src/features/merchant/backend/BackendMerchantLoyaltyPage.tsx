import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type {
  LoyaltyConfigInput,
  MerchantLoyaltyPreviewResponse,
  TierLevel,
} from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { LoyaltyFormula } from "../../../components/LoyaltyFormula";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Select,
} from "../../../components/ui";
import { MerchantLoyaltyTransactions } from "../MerchantLoyaltyTransactions";
import { MerchantLoyaltyHistory } from "../MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "../MerchantLoyaltyMembers";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { api, message, useToken } from "../merchant-page-support";

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
  const hasChanges = Boolean(config && form && JSON.stringify(form) !== JSON.stringify({
    vndPerPoint: config.vndPerPoint,
    isActive: config.isActive,
    qualificationMode: config.qualificationMode,
    reset: config.reset,
    tiers: config.tiers,
  }));
  const isDirty = isNewPolicy || hasChanges;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("loyalty-config-dirty", { detail: hasChanges }));
    return () => { window.dispatchEvent(new CustomEvent("loyalty-config-dirty", { detail: false })); };
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
      const result = await api.putLoyaltyConfig({ ...form, ...(isNewPolicy ? { publishAsNewVersion: true } : {}) }, token);
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
      setNotice(result.alreadyProcessed ? `Chu kỳ ${result.cycleYear} đã được xử lý (${result.processedCount} hội viên).` : `Đã xử lý ${result.processedCount} hội viên cho chu kỳ ${result.cycleYear}.`);
      return true;
    } catch (reason) {
      const code = message(reason);
      setError(code.includes("TIER_RESET_NOT_DUE") ? "Chỉ có thể chạy reset vào ngày đã cấu hình theo giờ Việt Nam." : code.includes("TIER_RESET_DISABLED") ? "Hãy bật và lưu lịch reset trước." : code);
      return false;
    } finally {
      setResetBusy(false);
    }
  }

  async function confirmPendingAction() {
    const succeeded = confirmingAction === "publish"
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
      {(activeTab === "config" || activeTab === "ledger" || activeTab === "history" || activeTab === "members") && <>
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
                <h1 className="text-xl font-semibold text-[#294833]">{isNewPolicy ? "Tạo chính sách mới" : "Chỉnh sửa chính sách hiện tại"}</h1>
                <p className="mt-1 text-xs text-[#718075]">Khi phát hành, hệ thống tạo phiên bản mới và giữ nguyên lịch sử trước đó.</p>
              </div>
              <Link to="/merchant/loyalty/history" onClickCapture={(event) => {
                if (hasChanges) {
                  event.preventDefault();
                  event.stopPropagation();
                  window.alert("Vui lòng lưu cấu hình trước khi rời trang.");
                }
              }} className="text-xs font-medium text-[#416b48] hover:underline">Quay lại chính sách điểm</Link>
            </div>
            <div className="rounded-lg bg-[#fff8eb] px-3 py-2 text-xs leading-4 text-[#97682a]">
              <p className="font-bold">
                Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau này.
              </p>
              <p className="mt-1">
                Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.
              </p>
            </div>

            <Card className="p-3 pb-20 sm:p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ece3]">
                <div className="flex gap-1">
                {([["program", "Chương trình"], ["tiers", "Các hạng"], ["reset", "Reset hạng"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setConfigSection(key)} className={`border-b-2 px-3 py-2 text-sm ${configSection === key ? "border-[#416b48] font-semibold text-[#294833]" : "border-transparent text-[#718075]"}`}>{label}</button>
                ))}
                </div>
                <div className="flex items-center gap-3">
                  {!isEditorRoute && <label className="flex items-center gap-2 text-xs text-[#53645a]"><input type="checkbox" checked={editingPolicy} onChange={(event) => setEditingPolicy(event.target.checked)} />Chỉnh sửa chính sách</label>}
                  {isDirty && <Button type="submit" form="loyalty-config-form" disabled={busy || !canEditPolicy} size="sm">{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}</Button>}
                </div>
              </div>
              <form id="loyalty-config-form" onSubmit={requestSave} className="space-y-3">
                <fieldset disabled={!canEditPolicy} className="space-y-3 disabled:opacity-70">
                {configSection === "program" && <>
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
                  <Select value={form.qualificationMode} onChange={(event) => setDraft(changeQualificationMode(form, event.target.value as "POINTS" | "SPEND"))}>
                    <option value="POINTS">Điểm tích lũy</option>
                    <option value="SPEND">Chi tiêu</option>
                  </Select>
                </Field>
                <details className="rounded-lg border border-[#e5ece3] p-3">
                  <summary className="cursor-pointer text-sm font-medium">Xem trước công thức (tùy chọn)</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label="Số tiền đơn hàng thử nghiệm (VND)"><Input type="number" min={1} value={previewAmount} onChange={(event) => setPreviewAmount(event.target.value)} placeholder="50000" /></Field>
                    <Field label="Hạng thành viên"><Select value={previewTier} onChange={(event) => setPreviewTier(event.target.value as TierLevel | "")}><option value="">Theo cấu hình</option>{config.tiers.map((tier) => <option key={tier.level} value={tier.level}>{tier.name ?? tier.level}</option>)}</Select></Field>
                    <div className="flex items-end"><Button type="button" disabled={previewBusy || !previewAmount} onClick={() => void runFormulaPreview()}>{previewBusy ? <BusyLabel>Đang tính</BusyLabel> : "Tính thử điểm"}</Button></div>
                  </div>
                  {previewError && <p role="alert" className="mt-2 text-xs text-[#a4473a]">{previewError}</p>}
                  {previewResult && <div className="mt-3 rounded-lg bg-[#edf4e9] p-3 text-xs text-[#46614d]">
                    <p className="text-sm font-bold text-[#294833]">Điểm ước tính: <span className="font-mono">{previewResult.estimatedPointsExact}</span> điểm</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      <span>Phần nguyên: <b>{previewResult.integerProjection}</b></span>
                      <span>Phần lẻ: <b>{previewResult.fractionalProjection}</b></span>
                      <span>Hệ số: <b>{previewResult.multiplier}×</b></span>
                      <span>Tỷ lệ: <b>{previewResult.vndPerPoint.toLocaleString("vi-VN")} ₫/điểm</b></span>
                    </div>
                    <p className="mt-2 text-[11px] text-[#637269]">Làm tròn: {previewResult.rounding} · Độ chính xác: {previewResult.scale} chữ số thập phân</p>
                  </div>}
                </details>
                </>}
                {configSection === "tiers" && <>
                <section aria-label="Cấu hình hạng" className="space-y-2">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><h2 className="font-extrabold">Các hạng</h2><p className="mt-1 text-xs muted">Hạng mặc định không thể xóa. Ngưỡng phải tăng dần.</p></div>
                    <Button type="button" variant="outline" onClick={() => {
                      const last = form.tiers.at(-1);
                      const level = `tier-${Date.now()}`;
                      const order = form.tiers.length;
                      const nextTier = { level, name: `Hạng ${order + 1}`, ...(form.qualificationMode === "POINTS" ? { minLifetimePoints: Number(last?.minLifetimePoints ?? 0) + 1 } : { minSpendVnd: String(Number(last?.minSpendVnd ?? 0) + 1) }), multiplier: "1.00", benefits: [], iconUrl: null, color: "#6B7280", maintenanceSpendVnd: null, sortOrder: order, isActive: true };
                      setDraft({ ...form, tiers: [...form.tiers, nextTier] });
                    }}>Thêm hạng</Button>
                  </div>
                  {form.tiers.map((tier, index) => (
                    <div key={tier.level} className="grid items-end gap-2 rounded-lg border border-[#e5ece3] bg-[#f7f9f5] p-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between sm:col-span-2">
                        <button type="button" aria-expanded={expandedTiers[tier.level] ?? false} onClick={() => setExpandedTiers((old) => ({ ...old, [tier.level]: !old[tier.level] }))} className="flex items-center gap-2 text-sm font-semibold text-[#294833]"><span aria-hidden="true">{expandedTiers[tier.level] ? "▾" : "▸"}</span>{tier.name || `Hạng ${index + 1}`}</button>
                        {index > 0 && <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-[#a4473a] hover:bg-[#f9e9e6]" onClick={() => setDraft({ ...form, tiers: form.tiers.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i })) })}>Xóa hạng</button>}
                      </div>
                      {expandedTiers[tier.level] && <>
                      <Field label="Tên hạng"><Input required maxLength={80} value={tier.name ?? tier.level} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></Field>
                      <Field label={form.qualificationMode === "POINTS" ? "Điểm tối thiểu" : "Chi tiêu tối thiểu (VND)"}>
                        <Input required type="number" min={index === 0 ? 0 : 1} step={1} disabled={index === 0} value={form.qualificationMode === "POINTS" ? tier.minLifetimePoints ?? (index === 0 ? 0 : "") : tier.minSpendVnd ?? (index === 0 ? "0" : "")} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? form.qualificationMode === "POINTS" ? { ...item, minLifetimePoints: event.target.value === "" ? undefined : Number(event.target.value), minSpendVnd: undefined } : { ...item, minSpendVnd: event.target.value, minLifetimePoints: undefined } : item) })} />
                      </Field>
                      <Field label="Hệ số"><Input required pattern="[0-9]{1,3}\.[0-9]{2}" value={tier.multiplier} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, multiplier: event.target.value } : item) })} /></Field>
                      <Field label="Màu hạng"><div className="flex items-center gap-2"><Input aria-label={`Mã HEX màu ${tier.name || `hạng ${index + 1}`}`} value={tier.color ?? "#6B7280"} pattern="^#[0-9A-Fa-f]{6}$" maxLength={7} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, color: event.target.value } : item) })} /><label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[#d5ded3] shadow-sm" style={{ backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(tier.color ?? "") ? tier.color! : "#ffffff" }} title="Chọn màu"><span className="sr-only">Mở bảng chọn màu</span><input aria-label={`Chọn màu cho ${tier.name || `hạng ${index + 1}`}`} type="color" value={/^#[0-9A-Fa-f]{6}$/.test(tier.color ?? "") ? tier.color! : "#6B7280"} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, color: event.target.value.toUpperCase() } : item) })} className="absolute inset-0 size-full cursor-pointer opacity-0" /></label></div></Field>
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-2 border-t border-[#e5ece3] pt-2">
                        <button type="button" className="text-xs font-medium text-[#416b48]" onClick={() => setShowOptional((old) => ({ ...old, [tier.level]: !old[tier.level] }))}>{showOptional[tier.level] ? "Ẩn tùy chọn" : "Tùy chọn"}</button>
                        {!showOptional[tier.level] && <span className="text-xs text-[#89958b]">Quyền lợi: chưa triển khai</span>}
                      </div>
                      {showOptional[tier.level] && <>
                        <Field label="Lợi ích"><Input disabled placeholder="Chưa triển khai" value="" /></Field>
                        <Field label="Chi tiêu duy trì hạng (VND)"><Input type="number" min={0} value={tier.maintenanceSpendVnd ?? ""} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, maintenanceSpendVnd: event.target.value || null } : item) })} /></Field>
                      </>}
                      </>}
                    </div>
                  ))}
                </section>
                </>}
                {configSection === "reset" && <>
                <section aria-label="Thiết lập reset hạng" className="space-y-3 rounded-lg border border-[#e5ece3] p-3">
                  <h2 className="font-extrabold">Reset hạng hằng năm</h2>
                  <Field label="Lịch reset"><Select value={form.reset.enabled ? "true" : "false"} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, enabled: event.target.value === "true" } })}><option value="false">Tắt</option><option value="true">Bật</option></Select></Field>
                  {form.reset.enabled && <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Tháng"><Input type="number" min={1} max={12} value={form.reset.month} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, month: Number(event.target.value) } })} /></Field>
                    <Field label="Ngày"><Input type="number" min={1} max={31} value={form.reset.day} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, day: Number(event.target.value) } })} /></Field>
                    <Field label="Điều chỉnh hạng"><Select value={form.reset.strategy} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, strategy: event.target.value as "ONE_DOWN" | "SELECTED", targetLevel: event.target.value === "SELECTED" ? form.tiers[0]?.level ?? null : null } })}><option value="ONE_DOWN">Giảm một hạng</option><option value="SELECTED">Về hạng được chọn</option></Select></Field>
                    {form.reset.strategy === "SELECTED" && <Field label="Hạng đích"><Select value={form.reset.targetLevel ?? ""} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, targetLevel: event.target.value } })}>{form.tiers.map((tier) => <option key={tier.level} value={tier.level}>{tier.name ?? tier.level}</option>)}</Select></Field>}
                    <p className="text-xs muted sm:col-span-3">Reset đặt lại tiến trình về ngưỡng của hạng đích nhưng giữ nguyên điểm có thể đổi. Đủ chi tiêu duy trì sẽ giữ nguyên hạng hiện tại.</p>
                  </div>}
                </section>
                <section aria-label="Thực hiện reset" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#ead8d4] bg-[#fcf8f7] p-3">
                  <div><h3 className="text-sm font-semibold text-[#7a4038]">Thực hiện reset</h3><p className="mt-1 text-xs muted">Thao tác này cập nhật hạng và tiến trình xét hạng của hội viên khi đến lịch đã cấu hình.</p></div>
                  <Button type="button" variant="outline" disabled={!form.reset.enabled || resetBusy || !canEditPolicy} onClick={() => setConfirmingAction("reset")}>{resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Chạy reset đến hạn"}</Button>
                </section>
                </>}
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
      </>}
      </div>
      <ConfirmActionDialog
        open={confirmingAction !== null}
        onOpenChange={(open) => { if (!open && !busy && !resetBusy) setConfirmingAction(null); }}
        title={confirmingAction === "reset" ? "Chạy reset hạng đến hạn?" : "Phát hành chính sách mới?"}
        description={confirmingAction === "reset"
          ? "Hạng và tiến trình xét hạng của hội viên đủ điều kiện sẽ được cập nhật theo lịch đã lưu. Ví điểm và lịch sử giao dịch được giữ nguyên."
          : "Thay đổi sẽ được lưu thành một phiên bản chính sách mới. Các phiên bản đã phát hành trước đó vẫn được giữ nguyên. Chỉ tiếp tục nếu bạn muốn áp dụng cấu hình này cho các đơn hàng sau."}
        confirmLabel={confirmingAction === "reset" ? "Chạy reset" : "Phát hành phiên bản mới"}
        busy={confirmingAction === "reset" ? resetBusy : busy}
        error={error || undefined}
        onConfirm={() => void confirmPendingAction()}
      />
    </>
  );
}
