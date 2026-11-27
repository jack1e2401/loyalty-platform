import { MerchantPagination } from "./cms/MerchantPagination";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import type { LoyaltyConfigDto, MerchantLoyaltyPolicyVersionDto } from "../../api/commerce-types";

export type MerchantLoyaltyHistoryProps = {
  versions: MerchantLoyaltyPolicyVersionDto[];
  currentConfig?: LoyaltyConfigDto;
  currentVersion?: MerchantLoyaltyPolicyVersionDto | null;
  pagination?: { page: number; limit: number; totalItems: number };
  onPageChange?: (page: number, limit: number) => void;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function formatNumber(value: number | string): string {
  return Number(value).toLocaleString("vi-VN");
}

function qualificationLabel(mode: "POINTS" | "SPEND" | null): string | null {
  if (mode === "POINTS") return "Điểm tích lũy";
  if (mode === "SPEND") return "Chi tiêu";
  return null;
}

function TierTrack({ tiers, mode }: { tiers: LoyaltyConfigDto["tiers"]; mode: "POINTS" | "SPEND" | null }) {
  if (tiers.length === 0) return <p className="text-sm text-[#65736a]">Chưa có hạng trong snapshot.</p>;
  return (
    <ol className="flex flex-wrap gap-y-4" aria-label="Các hạng trong chính sách">
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
          <li key={`${tier.level}-${index}`} className="min-w-28 flex-1">
            <div className="mb-2 flex items-center" aria-hidden="true">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="h-px flex-1 bg-[#dbe3d9]" />
            </div>
            <p className="break-words pr-2 text-sm font-semibold">{tier.name ?? tier.level}</p>
            <p className="mt-1 pr-2 text-xs text-[#65736a]">{threshold}</p>
            <p className="mt-1 text-xs font-semibold text-[#315e3c]">×{tier.multiplier}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ResetSummary({ reset }: {
  reset: MerchantLoyaltyPolicyVersionDto["reset"] | LoyaltyConfigDto["reset"] | null;
  tiers?: LoyaltyConfigDto["tiers"];
}) {
  if (!reset) return <span>Không được lưu trong phiên bản này</span>;
  if (!reset.enabled) return <span>Đang tắt</span>;
  const schedule = reset.month && reset.day ? `${String(reset.day).padStart(2, "0")}/${String(reset.month).padStart(2, "0")}` : "";
  const targetPts = reset.targetPoints !== undefined ? `Về ${formatNumber(reset.targetPoints)} điểm` : "Reset theo mùa";
  return <span>{schedule ? `${schedule} · ` : ""}{targetPts}</span>;
}


const sectionTitle = "text-xs font-semibold text-[#526458]";
const primaryLink = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#315e3c] px-4 text-sm font-semibold text-white hover:bg-[#244a30] focus-visible:ring-2 focus-visible:ring-[#6b9270] focus-visible:ring-offset-2";
const secondaryButton = "inline-flex min-h-9 items-center rounded-lg border border-[#dbe3d9] bg-white px-3 text-sm font-semibold text-[#315e3c] hover:bg-[#f3f6f1] focus-visible:ring-2 focus-visible:ring-[#6b9270]";
const panel = "rounded-2xl border border-[#e3e9e1] bg-white";

function Status({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-[#e6f2e4] text-[#315e3c]" : "bg-[#f1f3f0] text-[#526458]"}`}>
      {active && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

function PolicySummary({ policy }: {
  policy: Pick<MerchantLoyaltyPolicyVersionDto, "vndPerPoint" | "qualificationMode" | "tiers"> & {
    reset: MerchantLoyaltyPolicyVersionDto["reset"] | LoyaltyConfigDto["reset"] | null;
  };
}) {
  const { vndPerPoint, qualificationMode, tiers, reset } = policy;
  const metrics: [string, ReactNode][] = [
    ["Tích điểm", `${formatNumber(vndPerPoint)} ₫ = 1 điểm`],
    ["Xếp hạng", qualificationLabel(qualificationMode) ?? "Không được lưu trong phiên bản này"],
    ["Hạng thành viên", `${tiers.length} hạng`],
    ["Reset hạng", <ResetSummary reset={reset} tiers={tiers} />],
  ];

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-[#e7ece5] bg-[#f7f9f6] p-3 sm:p-4">
            <dt className={sectionTitle}>{label}</dt>
            <dd className="mt-2 text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <h4 className={`mb-4 ${sectionTitle}`}>Cấu trúc hạng thành viên</h4>
        <TierTrack tiers={tiers} mode={qualificationMode} />
      </div>
    </>
  );
}

function VersionDetails({ version }: { version: MerchantLoyaltyPolicyVersionDto }) {
  const publisher = version.publishedByEmail ?? (version.source === "LEGACY_BACKFILL" ? "Phiên bản chuyển đổi" : "Người phát hành không còn hoạt động");

  return (
    <Dialog.Root>
      <Dialog.Trigger className={secondaryButton} aria-label={`Xem chi tiết v${version.version}`}>Xem chi tiết</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="surface fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-2xl p-5 text-[#33463a] shadow-2xl outline-none sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-xl font-semibold">Chính sách v{version.version}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[#65736a]">{formatDate(version.publishedAt)} · {publisher}</Dialog.Description>
            </div>
            <Dialog.Close className={secondaryButton}>Đóng</Dialog.Close>
          </div>
          <Status active={version.isActive}>{version.isActive ? "Đang hoạt động" : "Đang tạm dừng"}</Status>
          <PolicySummary policy={version} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function MerchantLoyaltyHistory({ versions, currentConfig, currentVersion, pagination, onPageChange }: MerchantLoyaltyHistoryProps) {
  const current = currentVersion ?? versions.find((policy) => policy.isCurrent);
  const currentPolicy = currentConfig ?? current;

  return (
    <section aria-labelledby="loyalty-history-title" className="mx-auto w-full max-w-5xl space-y-6 text-[#33463a]">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 id="loyalty-history-title" className="text-2xl font-semibold sm:text-3xl">Chính sách Loyalty</h1>
        </div>
        <Link to="/merchant/loyalty/config?mode=new" className={primaryLink}>
          <span aria-hidden="true">+</span> Tạo chính sách mới
        </Link>
      </header>

      <section aria-labelledby="loyalty-current-title" className="space-y-3">
        <h2 id="loyalty-current-title" className={sectionTitle}>Chính sách đang áp dụng</h2>
        {currentPolicy ? (
          <article className={`${panel} space-y-5 p-4 sm:p-6`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">{current ? `Chính sách v${current.version}` : "Cấu hình hiện tại"}</h3>
                <p className="mt-1 text-sm text-[#65736a]">{current ? `Phát hành: ${formatDate(current.publishedAt)}` : "Chưa có phiên bản phát hành"}</p>
              </div>
              <Status active={currentPolicy.isActive}>{currentPolicy.isActive ? "Đang hoạt động" : "Đang tạm dừng"}</Status>
            </div>
            <PolicySummary policy={currentPolicy} />
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3e9e1] pt-4">
              <p className="text-sm text-[#65736a]">
                {currentPolicy.isActive
                  ? "Chính sách này đang áp dụng cho các giao dịch mới."
                  : "Tính năng tích điểm đang tạm dừng."}
              </p>
              <Link to={`/merchant/loyalty/config?mode=edit${current ? `&version=${current.version}` : ""}`} className={secondaryButton}>
                Chỉnh sửa chính sách
              </Link>
            </footer>
          </article>
        ) : <p className={`${panel} p-4 text-sm text-[#65736a]`}>Chưa có chính sách đang áp dụng.</p>}
      </section>

      <section aria-labelledby="loyalty-versions-title" className="space-y-3">
        <header className="flex items-baseline justify-between gap-3">
          <h2 id="loyalty-versions-title" className={sectionTitle}>Lịch sử phiên bản</h2>
          <p className="text-sm text-[#65736a]">Tổng cộng: {pagination?.totalItems ?? versions.length}</p>
        </header>
        {versions.length > 0 ? (
          <div className={`${panel} overflow-x-auto`}>
            <table aria-labelledby="loyalty-versions-title" className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-[#f7f9f6] text-[#526458]">
                <tr>
                  {["Phiên bản", "Ngày phát hành", "Trạng thái", "Thao tác"].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3 font-semibold sm:px-6">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id} className="border-t border-[#e7ece5]">
                    <th scope="row" className="px-4 py-3 font-semibold sm:px-6">v{version.version}</th>
                    <td className="px-4 py-3 sm:px-6">{formatDate(version.publishedAt)}</td>
                    <td className="px-4 py-3 sm:px-6"><Status active={version.isCurrent}>{version.isCurrent ? "Hiện hành" : "Đã thay thế"}</Status></td>
                    <td className="px-4 py-3 sm:px-6"><VersionDetails version={version} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className={`${panel} p-4 text-sm text-[#65736a]`}>Chưa có phiên bản phát hành.</p>}
        {pagination && onPageChange && <MerchantPagination page={pagination.page} limit={pagination.limit} totalItems={pagination.totalItems} onChange={onPageChange} />}
      </section>
    </section>
  );
}
