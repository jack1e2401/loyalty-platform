import { Alert, Space, type TableColumnsType } from "antd";
import type { ExtendedRefundPreviewDto } from "../../../api/refunds-types";
import { MerchantPagination } from "../cms/MerchantPagination";
import { CmsDataTable } from "../cms";
import { challengeRewardStateLabel } from "../challenges/challenge-labels";

type PreviewRow = { key: string; metric: string; before: string; after: string };
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

export function MerchantRefundPreview({ preview, onChallengePageChange }: {
  preview: ExtendedRefundPreviewDto;
  onChallengePageChange: (page: number, limit: number) => void;
}) {
  const hasPointDebt = Number(preview.walletAfter.pointDebt ?? 0) > 0;
  const hasTierChange = preview.tierBefore !== preview.tierAfter;
  const rows: PreviewRow[] = [
    { key: "amount", metric: "Số tiền hoàn", before: "0 ₫", after: money(preview.refundAmountVnd) },
    {
      key: "reversal",
      metric: "Điểm tích lũy thu hồi",
      before: "—",
      after: `−${formatPts(preview.earningReversalExact)} điểm`,
    },
    {
      key: "available",
      metric: "Điểm khả dụng",
      before: String(preview.walletBefore.availablePoints ?? "—"),
      after: `${preview.walletAfter.availablePoints ?? "—"} (nợ ${preview.walletAfter.pointDebt ?? "—"}, dư ${preview.walletAfter.fractionalCarry ?? "—"})`,
    },
    {
      key: "lifetime",
      metric: "Điểm tích lũy trọn đời",
      before: String(preview.walletBefore.netLifetimeEarned ?? "—"),
      after: String(preview.walletAfter.netLifetimeEarned ?? "—"),
    },
    { key: "tier", metric: "Hạng thành viên", before: preview.tierBefore, after: preview.tierAfter },
    {
      key: "voucher",
      metric: "Voucher giảm giá",
      before: "—",
      after: preview.discountVoucherRestorable ? "Khôi phục" : "Không thay đổi",
    },
  ];
  const columns: TableColumnsType<PreviewRow> = [
    { title: "Chỉ số", dataIndex: "metric", key: "metric" },
    { title: "Hiện tại", dataIndex: "before", key: "before" },
    { title: "Dự kiến sau hoàn tiền", dataIndex: "after", key: "after" },
  ];
  const challengeRows = (preview.challenges ?? []).map((challenge) => ({
    key: String(challenge.challengeId),
    metric: `Nhiệm vụ: ${challenge.title}`,
    before: `${challenge.currentValueBefore} · ${challengeRewardStateLabel(challenge.rewardStateBefore)} · ${formatPts(challenge.budgetSpentBefore)} điểm`,
    after: `${challenge.currentValueAfter} · ${challengeRewardStateLabel(challenge.rewardStateAfter)} · ${formatPts(challenge.budgetSpentAfter)} điểm`,
  }));

  return (
    <Space orientation="vertical" size={12} className="w-full">
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
      <CmsDataTable label="Tác động dự kiến" rows={rows} columns={columns} rowKey="key" />
      {challengeRows.length > 0 ? (
        <CmsDataTable label="Tác động đến nhiệm vụ" rows={challengeRows} columns={columns} rowKey="key" />
      ) : null}
      {preview.challengePagination && preview.challengePagination.totalItems > 0 && <MerchantPagination
        {...preview.challengePagination} onChange={onChallengePageChange} />}
    </Space>
  );
}
