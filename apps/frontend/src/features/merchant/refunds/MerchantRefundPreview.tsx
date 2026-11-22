import { Space, type TableColumnsType } from "antd";
import type { ExtendedRefundPreviewDto } from "../../../api/refunds-types";
import { CmsDataTable } from "../cms";
import { challengeRewardStateLabel } from "../challenges/challenge-labels";

type PreviewRow = { key: string; metric: string; before: string; after: string };
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatPts = (value: string) => Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });

export function MerchantRefundPreview({ preview }: { preview: ExtendedRefundPreviewDto }) {
  const rows: PreviewRow[] = [
    { key: "amount", metric: "Số tiền hoàn", before: "0 ₫", after: money(preview.refundAmountVnd) },
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
      <CmsDataTable label="Tác động dự kiến" rows={rows} columns={columns} rowKey="key" />
      {challengeRows.length > 0 ? (
        <CmsDataTable label="Tác động đến nhiệm vụ" rows={challengeRows} columns={columns} rowKey="key" />
      ) : null}
    </Space>
  );
}
