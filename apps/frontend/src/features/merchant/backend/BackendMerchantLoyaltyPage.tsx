import { useState, type FormEvent } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
  PageHeader,
  Select,
} from "../../../components/ui";
import { MerchantLoyaltyTransactions } from "../MerchantLoyaltyTransactions";
import { MerchantLoyaltyHistory } from "../MerchantLoyaltyHistory";
import { MerchantLoyaltyMembers } from "../MerchantLoyaltyMembers";
import { api, formatPrice, message, useToken } from "../merchant-page-support";

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
  const { pathname } = useLocation();
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

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.putLoyaltyConfig(form, token);
      resource.setData(result);
      history.reload();
      setDraft(null);
      setNotice("Đã lưu cấu hình.");
    } catch (reason) {
      setError(message(reason));
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

  async function runTierReset() {
    if (resetBusy) return;
    setResetBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.runTierReset(token);
      setNotice(result.alreadyProcessed ? `Chu kỳ ${result.cycleYear} đã được xử lý (${result.processedCount} hội viên).` : `Đã xử lý ${result.processedCount} hội viên cho chu kỳ ${result.cycleYear}.`);
    } catch (reason) {
      const code = message(reason);
      setError(code.includes("TIER_RESET_NOT_DUE") ? "Chỉ có thể chạy reset vào ngày đã cấu hình theo giờ Việt Nam." : code.includes("TIER_RESET_DISABLED") ? "Hãy bật và lưu lịch reset trước." : code);
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={
          activeTab === "ledger"
            ? "Giao dịch điểm"
            : activeTab === "history"
              ? "Lịch sử chính sách"
              : activeTab === "members"
                ? "Thành viên"
                : "Cấu hình điểm"
        }
      />

      {activeTab === "config" ? (
        resource.loading ? (
          <LoadingState cards={2} />
        ) : resource.error ? (
          <ErrorState message={resource.error} retry={resource.reload} />
        ) : !config || !form ? (
          <EmptyState title="Chưa có cấu hình" description="Cấu hình chưa khả dụng." />
        ) : (
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <div className="rounded-2xl bg-[#fff8eb] p-4 text-xs leading-5 text-[#97682a]">
              <p className="font-bold">
                Lưu ý: Thay đổi tỷ lệ hoặc hạng tích điểm chỉ áp dụng cho các đơn hàng phát sinh sau này.
              </p>
              <p className="mt-1">
                Số dư điểm hiện tại và phần điểm lẻ của hội viên sẽ được bảo lưu nguyên vẹn.
              </p>
            </div>

            <Card className="p-6 sm:p-8">
              <LoyaltyFormula config={config} />
              <form onSubmit={save} className="mt-6 space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
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
                <section aria-label="Cấu hình hạng" className="space-y-3">
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
                    <div key={tier.level} className="grid items-end gap-3 rounded-xl bg-[#f7f9f5] p-4 sm:grid-cols-2">
                      <Field label="Tên hạng"><Input required maxLength={80} value={tier.name ?? tier.level} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></Field>
                      <Field label={form.qualificationMode === "POINTS" ? "Điểm tối thiểu" : "Chi tiêu tối thiểu (VND)"}>
                        <Input required type="number" min={index === 0 ? 0 : 1} step={1} disabled={index === 0} value={form.qualificationMode === "POINTS" ? tier.minLifetimePoints ?? (index === 0 ? 0 : "") : tier.minSpendVnd ?? (index === 0 ? "0" : "")} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? form.qualificationMode === "POINTS" ? { ...item, minLifetimePoints: event.target.value === "" ? undefined : Number(event.target.value), minSpendVnd: undefined } : { ...item, minSpendVnd: event.target.value, minLifetimePoints: undefined } : item) })} />
                      </Field>
                      <Field label="Hệ số"><Input required pattern="[0-9]{1,3}\.[0-9]{2}" value={tier.multiplier} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, multiplier: event.target.value } : item) })} /></Field>
                      <Field label="Lợi ích (mỗi dòng một lợi ích)"><Input value={(tier.benefits ?? []).join("\n")} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, benefits: event.target.value.split("\n").filter(Boolean) } : item) })} /></Field>
                      <Field label="Chi tiêu duy trì hạng (VND, tùy chọn)"><Input type="number" min={0} value={tier.maintenanceSpendVnd ?? ""} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, maintenanceSpendVnd: event.target.value || null } : item) })} /></Field>
                      <Field label="Màu hạng"><Input type="color" value={tier.color ?? "#6B7280"} onChange={(event) => setDraft({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, color: event.target.value } : item) })} /></Field>
                      {index > 0 && <Button type="button" variant="outline" onClick={() => setDraft({ ...form, tiers: form.tiers.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i })) })}>Xóa hạng</Button>}
                    </div>
                  ))}
                </section>
                <section aria-label="Thiết lập reset hạng" className="space-y-4 rounded-xl border border-[#e5ece3] p-4">
                  <h2 className="font-extrabold">Reset hạng hằng năm</h2>
                  <Field label="Lịch reset"><Select value={form.reset.enabled ? "true" : "false"} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, enabled: event.target.value === "true" } })}><option value="false">Tắt</option><option value="true">Bật</option></Select></Field>
                  {form.reset.enabled && <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Tháng"><Input type="number" min={1} max={12} value={form.reset.month} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, month: Number(event.target.value) } })} /></Field>
                    <Field label="Ngày"><Input type="number" min={1} max={31} value={form.reset.day} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, day: Number(event.target.value) } })} /></Field>
                    <Field label="Điều chỉnh hạng"><Select value={form.reset.strategy} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, strategy: event.target.value as "ONE_DOWN" | "SELECTED", targetLevel: event.target.value === "SELECTED" ? form.tiers[0]?.level ?? null : null } })}><option value="ONE_DOWN">Giảm một hạng</option><option value="SELECTED">Về hạng được chọn</option></Select></Field>
                    {form.reset.strategy === "SELECTED" && <Field label="Hạng đích"><Select value={form.reset.targetLevel ?? ""} onChange={(event) => setDraft({ ...form, reset: { ...form.reset, targetLevel: event.target.value } })}>{form.tiers.map((tier) => <option key={tier.level} value={tier.level}>{tier.name ?? tier.level}</option>)}</Select></Field>}
                    <p className="text-xs muted sm:col-span-3">Reset đặt lại tiến trình về ngưỡng của hạng đích nhưng giữ nguyên điểm có thể đổi. Đủ chi tiêu duy trì sẽ giữ nguyên hạng hiện tại.</p>
                  </div>}
                  <Button type="button" variant="outline" disabled={!form.reset.enabled || resetBusy} onClick={() => void runTierReset()}>{resetBusy ? <BusyLabel>Đang xử lý</BusyLabel> : "Chạy reset đến hạn"}</Button>
                </section>
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
                <Button disabled={busy}>{busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu cấu hình"}</Button>
              </form>
            </Card>

            <Card className="p-6 sm:p-8">
              <h2 className="text-lg font-extrabold">Xem trước công thức tích điểm</h2>
              <p className="mt-1 text-xs muted">
                Thử tính toán điểm số cho đơn hàng dựa trên công thức hiện tại mà không thay đổi dữ liệu.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Số tiền đơn hàng thử nghiệm (VNĐ)">
                  <Input
                    required
                    type="number"
                    min={1}
                    aria-label="Số tiền đơn hàng thử nghiệm"
                    value={previewAmount}
                    onChange={(event) => setPreviewAmount(event.target.value)}
                    placeholder="50000"
                  />
                </Field>
                <Field label="Hạng thành viên (tùy chọn)">
                  <Select
                    value={previewTier}
                    onChange={(event) => setPreviewTier(event.target.value as TierLevel | "")}
                  >
                    <option value="">Theo cấu hình</option>
                    {config.tiers.map((tier) => <option key={tier.level} value={tier.level}>{tier.name ?? tier.level}</option>)}
                  </Select>
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    disabled={previewBusy || !previewAmount}
                    onClick={() => void runFormulaPreview()}
                  >
                    {previewBusy ? <BusyLabel>Đang tính</BusyLabel> : "Tính thử điểm"}
                  </Button>
                </div>
              </div>

              {previewError && (
                <p role="alert" className="mt-3 text-xs text-[#a4473a]">
                  {previewError}
                </p>
              )}

              {previewResult && (
                <div className="mt-4 rounded-xl bg-[#edf4e9] p-4 text-xs">
                  <p className="text-sm font-bold text-[#294833]">
                    Điểm ước tính:{" "}
                    <span className="font-mono text-base">{previewResult.estimatedPointsExact}</span> điểm
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[#46614d] sm:grid-cols-4">
                    <p>
                      Phần nguyên: <b>{previewResult.integerProjection}</b>
                    </p>
                    <p>
                      Phần lẻ: <b>{previewResult.fractionalProjection}</b>
                    </p>
                    <p>
                      Hệ số: <b>{previewResult.multiplier}×</b>
                    </p>
                    <p>
                      Tỷ lệ: <b>{formatPrice(String(previewResult.vndPerPoint))}/điểm</b>
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-[#637269]">
                    Làm tròn: {previewResult.rounding} · Độ chính xác: {previewResult.scale} chữ số thập phân
                  </p>
                </div>
              )}
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
        <Card className="mx-auto w-full max-w-4xl p-5 sm:p-7">
          <MerchantLoyaltyHistory versions={history.data?.versions ?? []} />
        </Card>
      )}
    </>
  );
}
