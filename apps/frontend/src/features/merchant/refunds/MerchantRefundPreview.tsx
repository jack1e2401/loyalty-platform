import { Alert, Space, Tag, Typography } from "antd";
import { ArrowRight } from "@phosphor-icons/react";
import type { ExtendedRefundPreviewDto } from "../../../api/refunds-types";
import { MerchantPagination } from "../cms/MerchantPagination";
import { challengeRewardStateLabel } from "../challenges/challenge-labels";

const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

export function MerchantRefundPreview({ preview, onChallengePageChange }: {
  preview: ExtendedRefundPreviewDto;
  onChallengePageChange: (page: number, limit: number) => void;
}) {
  const hasPointDebt = Number(preview.walletAfter.pointDebt ?? 0) > 0;
  const hasTierChange = preview.tierBefore !== preview.tierAfter;
  const challenges = preview.challenges ?? [];

  const diffCards = [
    {
      key: "available",
      label: "Điểm khả dụng",
      before: String(preview.walletBefore.availablePoints ?? "—"),
      after: `${preview.walletAfter.availablePoints ?? "—"} (nợ ${preview.walletAfter.pointDebt ?? "—"}, dư ${preview.walletAfter.fractionalCarry ?? "—"})`,
      highlight: hasPointDebt,
    },
    {
      key: "lifetime",
      label: "Điểm tích lũy trọn đời",
      before: String(preview.walletBefore.netLifetimeEarned ?? "—"),
      after: String(preview.walletAfter.netLifetimeEarned ?? "—"),
      highlight: false,
    },
    {
      key: "tier",
      label: "Hạng thành viên",
      before: preview.tierBefore,
      after: preview.tierAfter,
      highlight: hasTierChange,
    },
    {
      key: "voucher",
      label: "Voucher giảm giá",
      before: "Đã dùng",
      after: preview.discountVoucherRestorable ? "Khôi phục" : "Không thay đổi",
      highlight: preview.discountVoucherRestorable,
    },
  ];

  return (
    <Space orientation="vertical" size={14} className="w-full">
      {(hasPointDebt || hasTierChange) && (
        <Alert
          type="warning"
          showIcon
          title="Lưu ý tác động loyalty"
          description={[
            hasPointDebt ? `Khách đã sử dụng một phần điểm nên sẽ phát sinh nợ ${preview.walletAfter.pointDebt} điểm.` : null,
            hasTierChange ? `Hạng thành viên sẽ thay đổi từ ${preview.tierBefore} sang ${preview.tierAfter}.` : null,
          ].filter(Boolean).join(" ")}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#d7e4d8] bg-[#f7faf7] p-3.5">
          <Typography.Text type="secondary" className="text-xs">Số tiền hoàn</Typography.Text>
          <div className="mt-1 text-xl font-bold tabular-nums text-[#1f3829]">
            {money(preview.refundAmountVnd)}
          </div>
        </div>
        <div className="rounded-xl border border-[#e3e9e1] bg-[#fcfdfc] p-3.5">
          <Typography.Text type="secondary" className="text-xs">Điểm tích lũy thu hồi</Typography.Text>
          <div className="mt-1 text-xl font-bold tabular-nums text-[#a4473a]">
            −{formatPts(preview.earningReversalExact)} điểm
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {diffCards.map((card) => (
          <div
            key={card.key}
            className={`rounded-xl border p-3.5 ${
              card.highlight ? "border-[#f3d098] bg-[#fffcf5]" : "border-[#e3e9e1] bg-white"
            }`}
          >
            <div className="text-xs font-medium text-[#607767]">{card.label}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[#607767]">{card.before}</span>
              <ArrowRight size={14} className="text-[#8a9b8f]" aria-hidden="true" />
              <span className="font-semibold text-[#1f3829]">{card.after}</span>
            </div>
          </div>
        ))}
      </div>

      {challenges.length > 0 ? (
        <div className="space-y-2">
          <Typography.Text strong className="text-xs text-[#20392a]">
            Nhiệm vụ bị ảnh hưởng ({challenges.length})
          </Typography.Text>
          <div className="grid gap-2">
            {challenges.map((challenge) => (
              <div
                key={challenge.challengeId}
                className="flex flex-col gap-1.5 rounded-xl border border-[#e3e9e1] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#1f3829]">Nhiệm vụ: {challenge.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#607767]">
                    <span>
                      {challenge.currentValueBefore} ({challengeRewardStateLabel(challenge.rewardStateBefore)})
                    </span>
                    <ArrowRight size={12} aria-hidden="true" />
                    <span className="font-medium text-[#1f3829]">
                      {challenge.currentValueAfter} ({challengeRewardStateLabel(challenge.rewardStateAfter)})
                    </span>
                  </div>
                </div>
                <Tag className="w-fit rounded-md border-[#f2cfc8] bg-[#fff5f4] text-xs font-medium text-[#a4473a]">
                  Thu hồi {formatPts(challenge.pointsToReverseExact)} điểm
                </Tag>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {preview.challengePagination && preview.challengePagination.totalItems > 0 && (
        <MerchantPagination {...preview.challengePagination} onChange={onChallengePageChange} />
      )}
    </Space>
  );
}
