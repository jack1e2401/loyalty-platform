import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { LoyaltyConfigDto } from "../../api/commerce-types";
import { LoyaltyFormula } from "../../components/LoyaltyFormula";
import { Button } from "../../components/ui";

export const memberTierLabel: Record<string, string> = {
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
};

export function MemberLoyaltyPolicyDialog({ policy }: { policy: LoyaltyConfigDto }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline">Chính sách tích điểm</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-5 outline-none sm:p-7">
          <Dialog.Title className="pr-10 text-xl font-extrabold text-[#20392a]">
            Chính sách tích điểm
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button aria-label="Đóng" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X aria-hidden="true" size={20} />
            </Button>
          </Dialog.Close>

          <div className="mt-5 space-y-3">
            <LoyaltyFormula config={policy} />
            {policy.reset?.enabled && (
              <p className="rounded-xl border border-[#e5ece3] bg-[#f7f9f5] px-4 py-3 text-xs text-[#46614d]">
                Reset hạng theo mùa: Vào ngày{" "}
                <b>{String(policy.reset.day).padStart(2, "0")}/{String(policy.reset.month).padStart(2, "0")}</b>{" "}
                hằng năm, điểm khả dụng và điểm xét hạng sẽ được đặt lại về{" "}
                <b>{(policy.reset.targetPoints ?? 0).toLocaleString("vi-VN")} điểm</b>.
              </p>
            )}
          </div>

          <table className="mt-5 w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Ngưỡng tích lũy và hệ số theo hạng</caption>
            <thead className="text-[#53685a]">
              <tr>
                <th scope="col" className="pb-2">
                  Hạng
                </th>
                <th scope="col" className="pb-2 text-right">
                  Điểm tích lũy
                </th>
                <th scope="col" className="pb-2 text-right">
                  Hệ số
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9ede6] border-t border-[#e9ede6]">
              {policy.tiers.map((tier) => (
                <tr key={tier.level}>
                  <th scope="row" className="py-2.5 font-semibold">
                    {tier.name ?? memberTierLabel[tier.level] ?? tier.level}
                  </th>
                  <td className="py-2.5 text-right tabular-nums">
                    {policy.qualificationMode === "SPEND" ? `${Number(tier.minSpendVnd ?? 0).toLocaleString("vi-VN")} ₫` : `${(tier.minLifetimePoints ?? 0).toLocaleString("vi-VN")} điểm`}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {Number(tier.multiplier).toLocaleString("vi-VN")}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
