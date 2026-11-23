import { useState } from "react";
import { Link } from "react-router-dom";
import type { LoyaltyConfigDto, MerchantLoyaltyPolicyVersionDto } from "../../api/commerce-types";

export type MerchantLoyaltyHistoryProps = {
  versions: MerchantLoyaltyPolicyVersionDto[];
  currentConfig?: LoyaltyConfigDto;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatNumber(value: number | string): string {
  return Number(value).toLocaleString("vi-VN");
}

function qualificationLabel(mode: "POINTS" | "SPEND" | null): string | null {
  if (mode === "POINTS") return "Điểm tích lũy";
  if (mode === "SPEND") return "Chi tiêu";
  return null;
}

function TierTrack({ tiers, mode, isCurrent }: { tiers: LoyaltyConfigDto["tiers"]; mode: "POINTS" | "SPEND" | null; isCurrent: boolean }) {
  if (tiers.length === 0) return <p className={`text-xs ${isCurrent ? "text-white/60" : "text-[#758078]"}`}>Chưa có hạng trong snapshot.</p>;
  return (
    <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Các hạng trong chính sách">
      {tiers.map((tier, index) => {
        const threshold = mode === "SPEND"
          ? `${formatNumber(tier.minSpendVnd ?? 0)} ₫ chi tiêu`
          : mode === "POINTS"
            ? `${formatNumber(tier.minLifetimePoints ?? 0)} điểm`
            : tier.minSpendVnd != null && tier.minLifetimePoints == null
              ? `${formatNumber(tier.minSpendVnd)} ₫ · loại xét hạng chưa lưu`
              : tier.minLifetimePoints != null && tier.minSpendVnd == null
                ? `${formatNumber(tier.minLifetimePoints)} điểm · loại xét hạng chưa lưu`
                : "Ngưỡng chưa xác định";
        const color = tier.color && /^#[0-9A-Fa-f]{6}$/.test(tier.color) ? tier.color : "#a7b6aa";
        return (
          <li key={`${tier.level}-${index}`} className="relative min-w-0 border-l-2 pl-3 py-0.5" style={{ borderColor: color }}>
            <p className="truncate text-sm font-semibold">{tier.name ?? tier.level}</p>
            <p className={`mt-0.5 text-xs ${isCurrent ? "text-white/65" : "text-[#65736a]"}`}>{threshold} <span aria-hidden="true">·</span> ×{tier.multiplier}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ResetSummary({ reset, tiers }: {
  reset: MerchantLoyaltyPolicyVersionDto["reset"] | LoyaltyConfigDto["reset"] | null;
  tiers: LoyaltyConfigDto["tiers"];
}) {
  if (!reset) return <span>Không được lưu trong phiên bản này</span>;
  if (!reset.enabled) return <span>Tắt</span>;
  const schedule = reset.month && reset.day ? ` · ${String(reset.day).padStart(2, "0")}/${String(reset.month).padStart(2, "0")}` : "";
  const strategy = reset.strategy === "SELECTED" ? "Về hạng đích" : reset.strategy === "ONE_DOWN" ? "Giảm một hạng" : "Chưa xác định";
  const targetTier = reset.targetLevel ? tiers.find((tier) => tier.level === reset.targetLevel) : undefined;
  return <span>{strategy}{schedule}{reset.targetLevel ? ` · ${targetTier?.name ?? reset.targetLevel}` : ""}</span>;
}

function PolicyDetails({
  version,
  currentConfig,
}: {
  version: MerchantLoyaltyPolicyVersionDto;
  currentConfig?: LoyaltyConfigDto;
}) {
  const isCurrent = version.isCurrent;
  const mode = isCurrent ? currentConfig?.qualificationMode ?? version.qualificationMode : version.qualificationMode;
  const tiers = isCurrent ? currentConfig?.tiers ?? version.tiers : version.tiers;
  const reset = isCurrent ? currentConfig?.reset ?? version.reset : version.reset;
  const isActive = isCurrent ? currentConfig?.isActive ?? version.isActive : version.isActive;
  const qualification = qualificationLabel(mode);
  return (
    <div className={`space-y-4 ${isCurrent ? "text-white" : "text-[#33463a]"}`}>
      <dl className={`grid gap-3 text-sm sm:grid-cols-3 ${isCurrent ? "text-white/75" : "text-[#65736a]"}`}>
        <div><dt className="text-[11px] uppercase tracking-[0.12em]">Trạng thái tích điểm</dt><dd className={`mt-1 font-medium ${isCurrent ? "text-white" : "text-[#33463a]"}`}>{isActive ? "Đang hoạt động" : "Đang tạm dừng"}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.12em]">Điều kiện xếp hạng</dt><dd className={`mt-1 font-medium ${isCurrent ? "text-white" : "text-[#33463a]"}`}>{qualification ?? "Không được lưu trong phiên bản này"}</dd></div>
        <div><dt className="text-[11px] uppercase tracking-[0.12em]">Reset hạng</dt><dd className={`mt-1 font-medium ${isCurrent ? "text-white" : "text-[#33463a]"}`}><ResetSummary reset={reset} tiers={tiers} /></dd></div>
      </dl>
      <div className={`border-t pt-4 ${isCurrent ? "border-white/15" : "border-[#e3e9e1]"}`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-[0.12em]">Các hạng</h4>
          <p className={`text-xs ${isCurrent ? "text-white/60" : "text-[#758078]"}`}>Ngưỡng · hệ số tích điểm</p>
        </div>
        <TierTrack tiers={tiers} mode={mode} isCurrent={isCurrent} />
      </div>
      {isCurrent && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
          <p className="text-xs text-white/60">Cập nhật thay đổi sẽ phát hành một phiên bản mới.</p>
          <Link to={`/merchant/loyalty/config?mode=edit${version.version ? `&version=${version.version}` : ""}`} className="inline-flex min-h-9 items-center rounded-full bg-[#d8f5bb] px-4 text-xs font-semibold text-[#20392a] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            Chỉnh sửa chính sách
          </Link>
        </div>
      )}
    </div>
  );
}

function VersionRow({ version }: { version: MerchantLoyaltyPolicyVersionDto }) {
  const [expanded, setExpanded] = useState(false);
  const publisher = version.publishedByEmail ?? (version.source === "LEGACY_BACKFILL" ? "Phiên bản chuyển đổi" : "Người phát hành không còn hoạt động");
  return (
    <li className="relative pl-7">
      <span className="absolute left-[5px] top-2 size-2.5 rounded-full border-2 border-[#edf1e9] bg-[#91a096]" />
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-[#f3f6f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b9270]">
        <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="font-semibold text-[#33463a]">Phiên bản {version.version}</span>
          <span className="text-xs text-[#78837b]">{formatDate(version.publishedAt)}</span>
        </span>
        <span className="mt-1 block text-xs text-[#78837b]">{formatNumber(version.vndPerPoint)} ₫ / điểm · {publisher}</span>
      </button>
      {expanded && <div className="mb-3 ml-3 mt-1 rounded-xl border border-[#e3e9e1] bg-white p-4"><PolicyDetails version={version} /></div>}
    </li>
  );
}

export function MerchantLoyaltyHistory({ versions, currentConfig }: MerchantLoyaltyHistoryProps) {
  const current = versions.find((policy) => policy.isCurrent);
  const previous = versions.filter((policy) => !policy.isCurrent);

  if (!current && !currentConfig) {
    return <p className="text-sm text-slate-500">Chưa có chính sách loyalty được phát hành.</p>;
  }

  const currentVersion = current ?? {
    id: 0,
    version: 0,
    vndPerPoint: currentConfig!.vndPerPoint,
    isActive: currentConfig!.isActive,
    qualificationMode: null,
    reset: null,
    tiers: currentConfig!.tiers,
    source: "LEGACY_BACKFILL" as const,
    publishedAt: "",
    publishedById: null,
    publishedByEmail: null,
    isCurrent: true,
  };

  return (
    <section aria-label="Chính sách điểm" className="mx-auto w-full max-w-5xl space-y-5">
      <article className="overflow-hidden rounded-2xl bg-[#20392a] shadow-[0_14px_36px_-24px_rgba(23,51,33,0.8)]">
        <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-5 sm:px-7 sm:pt-7">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c2d4c5]">Chính sách hiện tại</p>
            <h2 className="mt-1 text-3xl font-semibold leading-none text-white" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              v{currentVersion.version || "—"}
            </h2>
          </div>
          <div className="text-right text-xs text-white/60">
            <p>{formatNumber(currentConfig?.vndPerPoint ?? currentVersion.vndPerPoint)} ₫ cho mỗi điểm</p>
            <p className="mt-1">{currentVersion.publishedAt ? `Phát hành ${formatDate(currentVersion.publishedAt)}` : "Chưa có phiên bản phát hành"}</p>
            {currentVersion.publishedByEmail && <p className="mt-1">bởi {currentVersion.publishedByEmail}</p>}
          </div>
        </div>
        <details className="group border-t border-white/15">
          <summary className="cursor-pointer list-none px-5 py-3 text-xs font-semibold text-[#d8f5bb] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white sm:px-7">
            <span className="group-open:hidden">Xem chi tiết chính sách</span>
            <span className="hidden group-open:inline">Thu gọn chi tiết</span>
            <span className="ml-2 inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
          </summary>
          <div className="border-t border-white/15 px-5 py-5 sm:px-7">
            <PolicyDetails version={currentVersion} currentConfig={currentConfig} />
          </div>
        </details>
      </article>

      <section aria-label="Các phiên bản trước" className="rounded-2xl border border-[#e3e9e1] bg-white p-4 sm:p-5">
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#33463a]">Các phiên bản trước</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#78837b]">{previous.length} phiên bản</span>
            <Link to="/merchant/loyalty/config?mode=new" className="inline-flex min-h-9 items-center rounded-full bg-[#315e3c] px-4 text-xs font-semibold text-white hover:bg-[#244a30] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6b9270]">
              Tạo chính sách mới
            </Link>
          </div>
        </header>
        {previous.length === 0 ? (
          <p className="border-t border-[#edf0ec] pt-3 text-xs text-[#78837b]">Chưa có phiên bản trước.</p>
        ) : (
          <ol className="relative space-y-1 border-l border-[#dbe3d9] py-1" aria-label="Lịch sử phát hành chính sách">
            {previous.map((version) => <VersionRow key={version.id} version={version} />)}
          </ol>
        )}
      </section>
    </section>
  );
}
