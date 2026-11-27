import type { ReactNode } from "react";
import { Wallet } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { PointTransactionType, WalletDto } from "../../api/commerce-types";
import { LoyaltyFormula } from "../../components/LoyaltyFormula";
import { Card, EmptyState } from "../../components/ui";
import { MemberLifetimeTierChart } from "./MemberLifetimeTierChart";
import { MemberSeasonHistoryDialog } from "./MemberSeasonHistoryDialog";

export function pointTransactionLabel(type: PointTransactionType) {
  const labels: Partial<Record<PointTransactionType, string>> = {
    EARN: "Tích điểm",
    REDEEM_DISCOUNT: "Đổi ưu đãi",
    REDEEM_REWARD: "Đổi quà",
    EARN_REVERSAL: "Thu hồi tích điểm",
    REDEMPTION_REVERSAL: "Hoàn điểm đổi thưởng",
    MERCHANT_ADJUSTMENT: "Điều chỉnh từ cửa hàng",
    LEGACY_BACKFILL: "Khởi tạo ban đầu",
    SEASON_RESET: "Reset điểm theo mùa",
  };
  return labels[type] ?? type;
}

export function formatPointDelta(delta: string) {
  return delta === "0" || delta.startsWith("-") ? delta : `+${delta}`;
}

function WalletReference({ to, children }: { to?: string; children: ReactNode }) {
  return (
    <p className="mt-1 text-xs">
      {to ? (
        <Link
          to={to}
          className="rounded font-medium underline hover:text-[#2f583a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
        >
          {children}
        </Link>
      ) : (
        children
      )}
    </p>
  );
}

export function LoyaltyWalletContent({
  wallet,
  tierArtwork,
  emptyAction,
  orderLink,
  voucherLink,
}: {
  wallet: WalletDto;
  tierArtwork?: ReactNode;
  emptyAction?: ReactNode;
  orderLink?: (id: number) => string;
  voucherLink?: string;
}) {
  const currentTier = wallet.policy?.tiers.find((tier) => tier.level === wallet.tier);
  const sortedTiers = [...(wallet.policy?.tiers ?? [])].sort(
    (a, b) => (a.minLifetimePoints ?? 0) - (b.minLifetimePoints ?? 0),
  );
  const qualPoints = Number(wallet.qualificationProgress ?? 0);
  const nextTier = sortedTiers.find((tier) => (tier.minLifetimePoints ?? 0) > qualPoints);
  const currentThreshold = currentTier?.minLifetimePoints ?? 0;
  const nextThreshold = nextTier?.minLifetimePoints ?? currentThreshold;
  const progressPercent = nextTier && nextThreshold > currentThreshold
    ? Math.min(100, Math.max(0, ((qualPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100))
    : 100;
  const currentSeason = wallet.currentSeason ?? new Date().getFullYear();
  const tierColor = currentTier?.color && /^#[0-9A-Fa-f]{6}$/.test(currentTier.color) ? currentTier.color : "#2f583a";
  const red = Number.parseInt(tierColor.slice(1, 3), 16);
  const green = Number.parseInt(tierColor.slice(3, 5), 16);
  const blue = Number.parseInt(tierColor.slice(5, 7), 16);
  const tierForeground = (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? "#20392a" : "#ffffff";
  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card
          className="relative overflow-hidden p-5 text-white sm:p-8"
          style={{ backgroundColor: "var(--storefront-accent, #2f583a)", color: "white" }}
        >
          <p className="text-sm font-semibold text-white/70">Điểm có thể sử dụng</p>
          <p className="mt-2 break-words text-3xl font-extrabold tracking-[-.05em] sm:text-5xl lg:text-6xl">
            <span className="tabular-nums">{wallet.availablePoints.toLocaleString("vi-VN")}</span>
            <span className="ml-2 text-base font-bold tracking-normal text-[#c5e89b]">điểm</span>
          </p>
          <p className="mt-2 break-words text-sm text-white/80">
            Phần lẻ:{" "}
            <span className="font-semibold tabular-nums text-[#c5e89b]">{wallet.fractionalCarry}</span>
          </p>
          {wallet.pointDebt !== "0" && (
            <p className="mt-1 break-words text-sm text-[#fca5a5]">
              Nợ điểm: <span className="font-semibold tabular-nums">{wallet.pointDebt}</span>
            </p>
          )}
          <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/15 pt-4 sm:mt-8 sm:pt-5">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/75">Dùng để đổi ưu đãi và phần thưởng</p>
              {wallet.policy?.reset?.enabled && (
                <p className="mt-1 text-xs text-white/65">
                  Reset mùa tiếp theo: {String(wallet.policy.reset.day).padStart(2, "0")}/
                  {String(wallet.policy.reset.month).padStart(2, "0")} về{" "}
                  {(wallet.policy.reset.targetPoints ?? 0).toLocaleString("vi-VN")} điểm
                </p>
              )}
            </div>
            <Wallet aria-hidden="true" size={24} weight="light" className="shrink-0 text-[#c5e89b]" />
          </div>
        </Card>
        <Card className="relative min-h-48 overflow-hidden border-0 p-5 sm:min-h-56 sm:p-8" style={{ backgroundColor: tierColor, color: tierForeground }}>
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full opacity-[0.08]" viewBox="0 0 160 100" preserveAspectRatio="none"><defs><pattern id="member-tier-texture" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.7" fill="currentColor" /><circle cx="8" cy="8" r="0.7" fill="currentColor" /></pattern></defs><rect width="160" height="100" fill="url(#member-tier-texture)" /></svg>
          <div className={tierArtwork ? "relative z-1 max-w-[68%] sm:max-w-[65%]" : undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold opacity-75">Hạng thành viên</p>
              <span className="rounded-full bg-black/15 px-2.5 py-0.5 text-xs font-bold">Mùa {currentSeason}</span>
            </div>
            <h2 className="mt-2 break-words text-2xl font-semibold leading-tight sm:mt-3 sm:text-3xl" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
              {wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : currentTier?.name ?? wallet.tier}
            </h2>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold opacity-90 sm:text-sm">
                Tiến độ thăng hạng mùa {currentSeason}: {qualPoints.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} điểm
              </p>
              {sortedTiers.length > 0 && (
                <>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-black/15">
                    <div className="h-full rounded-full bg-current transition-all" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="text-xs opacity-80">
                    {nextTier
                      ? `Cần thêm ${Math.max(0, (nextTier.minLifetimePoints ?? 0) - qualPoints).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} điểm để đạt ${nextTier.name ?? nextTier.level}.`
                      : "Bạn đang ở hạng cao nhất trong mùa."}
                  </p>
                </>
              )}
              <div className="pt-2">
                <MemberSeasonHistoryDialog wallet={wallet} />
              </div>
            </div>
          </div>
          {tierArtwork && (
            <div className="pointer-events-none absolute -bottom-3 -right-3 h-28 w-28 sm:h-48 sm:w-48">
              {tierArtwork}
            </div>
          )}
        </Card>
      </div>
      <MemberLifetimeTierChart wallet={wallet} />
      {!wallet.policy && (
        <div className="mt-7">
          <LoyaltyFormula />
        </div>
      )}
      <section className="mt-7">
        <h2 className="mb-4 text-xl font-extrabold">Lịch sử điểm</h2>
        {wallet.transactions.length === 0 ? (
          <EmptyState
            title="Chưa có giao dịch điểm"
            description="Giao dịch sẽ xuất hiện sau hoạt động tại cửa hàng này."
            action={emptyAction}
          />
        ) : (
          <div className="surface divide-y divide-[#edf1ea] overflow-hidden rounded-[1.5rem]">
            {wallet.transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-bold">{transaction.reason}</p>
                  <p className="mt-1 break-words text-xs muted">
                    {new Date(transaction.createdAt).toLocaleString("vi-VN")} ·{" "}
                    {pointTransactionLabel(transaction.type)}
                  </p>
                  {transaction.orderId != null && (
                    <WalletReference to={orderLink?.(transaction.orderId)}>
                      Đơn hàng #{transaction.orderId}
                    </WalletReference>
                  )}
                  {transaction.memberVoucherId != null && (
                    <WalletReference to={voucherLink}>Voucher #{transaction.memberVoucherId}</WalletReference>
                  )}
                </div>
                <div className="flex items-center justify-between sm:block sm:text-right">
                  <p
                    className={`break-words font-extrabold tabular-nums ${transaction.delta.startsWith("-") ? "text-[#a4473a]" : "text-[#357044]"}`}
                  >
                    {formatPointDelta(transaction.delta)}
                  </p>
                  <p className="break-words text-xs tabular-nums muted sm:mt-1">
                    Số dư {transaction.balanceAfter}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
