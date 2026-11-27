import * as Dialog from "@radix-ui/react-dialog";
import { ClockCounterClockwise, X } from "@phosphor-icons/react";
import type { WalletDto } from "../../api/commerce-types";
import { Button } from "../../components/ui";

export function MemberSeasonHistoryDialog({
  wallet,
  triggerClassName,
}: {
  wallet: WalletDto;
  triggerClassName?: string;
}) {
  const currentTier = wallet.policy?.tiers.find((tier) => tier.level === wallet.tier);
  const currentTierName = wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : currentTier?.name ?? wallet.tier;
  const qualPoints = Number(wallet.qualificationProgress ?? 0);
  const currentSeason = wallet.currentSeason ?? new Date().getFullYear();
  const seasonHistory = wallet.seasonHistory ?? [];

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={
            triggerClassName ??
            "inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-xs font-bold transition hover:bg-black/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          }
        >
          <ClockCounterClockwise aria-hidden="true" size={14} weight="bold" />
          Xem lịch sử hạng
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-5 outline-none sm:p-7">
          <Dialog.Title className="pr-10 text-xl font-extrabold text-[#20392a]">
            Lịch sử hạng các mùa
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-[#53685a]">
            Thứ hạng và điểm xét hạng của bạn qua từng mùa tích điểm.
          </Dialog.Description>
          <Dialog.Close asChild>
            <Button aria-label="Đóng" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X aria-hidden="true" size={20} />
            </Button>
          </Dialog.Close>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-[#cde0c8] bg-[#f4f9f2] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#49654e]">
                  Mùa {currentSeason}
                </span>
                <span className="rounded-full bg-[#315e3c] px-2.5 py-0.5 text-[11px] font-bold text-white">
                  Hiện tại
                </span>
              </div>
              <p className="mt-2 text-lg font-extrabold text-[#20392a]">{currentTierName}</p>
              <p className="mt-1 text-xs text-[#53685a]">
                Điểm xét hạng: {qualPoints.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} điểm
              </p>
            </div>

            {seasonHistory.length === 0 ? (
              <p className="rounded-2xl border border-[#e5ece3] bg-[#fafcf9] p-4 text-xs text-[#53685a]">
                Chưa có kỳ reset mùa trước nào được ghi nhận.
              </p>
            ) : (
              seasonHistory.map((entry) => (
                <div
                  key={`${entry.newSeasonYear}-${entry.resetAt}`}
                  className="rounded-2xl border border-[#e5ece3] bg-[#fafcf9] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#637269]">
                      Mùa {entry.seasonYear}
                    </span>
                    <span className="text-[11px] text-[#637269]">
                      {new Date(entry.resetAt).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-extrabold text-[#20392a]">{entry.previousTierName}</p>
                  <p className="mt-1 text-xs text-[#53685a]">
                    Reset sang mùa {entry.newSeasonYear}: {entry.newTierName} (
                    {Number(entry.resetToPoints).toLocaleString("vi-VN")} điểm)
                  </p>
                </div>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
