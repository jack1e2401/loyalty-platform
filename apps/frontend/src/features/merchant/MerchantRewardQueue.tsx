import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Alert, Button, Empty, Form, Input, Segmented, Space, Spin, Typography, type TableColumnsType } from "antd";
import { X } from "@phosphor-icons/react";
import { useAuthSession } from "../../api/auth-session";
import { createCommerceClient } from "../../api/commerce-http";
import type { MemberVoucherDto } from "../../api/commerce-types";
import { useResource } from "../../api/useResource";
import { ErrorState } from "../../components/ui";
import { CmsDataTable, CmsStatusTag } from "./cms";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

type RewardFilterTab = "ALL" | "PENDING" | "FULFILLED" | "CANCELLED";

function useToken() {
  const { accessToken } = useAuthSession();
  if (!accessToken) throw new Error("Phiên đăng nhập đã hết hạn");
  return accessToken;
}

function formatActionDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : null;
}

export function MerchantRewardQueue({ voucherId }: { voucherId?: number } = {}) {
  const token = useToken();
  const resource = useResource(
    () =>
      api
        .listMerchantRewards(token)
        .then(({ rewards }) =>
          voucherId === undefined ? rewards : rewards.filter((reward) => reward.id === voucherId),
        ),
    [token, voucherId],
  );
  const [filterTab, setFilterTab] = useState<RewardFilterTab>("ALL");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rewardToCancel, setRewardToCancel] = useState<MemberVoucherDto | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function fulfill(voucher: MemberVoucherDto) {
    if (busyId !== null) return;
    setBusyId(voucher.id);
    setError("");
    setNotice("");
    try {
      const response = await api.fulfillReward(
        voucher.id,
        notes[voucher.id]?.trim() ? { note: notes[voucher.id].trim() } : {},
        token,
      );
      resource.setData((current) =>
        (current ?? []).map((item) =>
          item.id === response.reward.id ? { ...item, ...response.reward } : item,
        ),
      );
      setNotice(`Đã xác nhận trao “${response.reward.title}” cho thành viên #${response.reward.memberId}.`);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "Không thể xác nhận trao quà";
      setError(msg);
      if (msg.includes("REWARD_ALREADY_FULFILLED") || msg.includes("REWARD_NOT_FOUND")) resource.reload();
    } finally {
      setBusyId(null);
    }
  }

  async function submitCancelReward() {
    if (!rewardToCancel || !cancelReason.trim() || cancelBusy) return;
    setCancelBusy(true);
    setCancelError("");
    try {
      const response = await api.cancelReward(rewardToCancel.id, { reason: cancelReason.trim() }, token);
      const updatedReward = response.reward;
      resource.setData((current) =>
        (current ?? []).map((item) =>
          item.id === rewardToCancel.id ? { ...item, ...updatedReward, status: "CANCELLED" as const } : item,
        ),
      );
      setNotice(`Đã hủy trao “${rewardToCancel.title}” cho thành viên #${rewardToCancel.memberId}.`);
      setRewardToCancel(null);
    } catch (reason) {
      setCancelError(reason instanceof Error ? reason.message : "Không thể hủy trao quà");
    } finally {
      setCancelBusy(false);
    }
  }

  if (resource.loading) {
    return (
      <div className="flex justify-center py-10">
        <Spin description="Đang tải quà đổi thưởng…" />
      </div>
    );
  }
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;

  const allRewards = resource.data ?? [];
  const pending = allRewards.filter((v) => v.status === "AVAILABLE" || v.status === "PENDING_FULFILLMENT");
  const fulfilled = allRewards.filter((v) => v.status === "FULFILLED");
  const cancelled = allRewards.filter((v) => v.status === "CANCELLED");

  const displayedRewards =
    filterTab === "PENDING"
      ? pending
      : filterTab === "FULFILLED"
        ? fulfilled
        : filterTab === "CANCELLED"
          ? cancelled
          : allRewards;

  const columns: TableColumnsType<MemberVoucherDto> = [
    {
      title: "Quà tặng",
      key: "title",
      width: 220,
      render: (_: unknown, voucher) => (
        <div className="min-w-0">
          <div className="font-semibold text-[#20392a]">{voucher.title}</div>
          <Typography.Text type="secondary" className="text-xs">
            Voucher #{voucher.id}
            {voucher.rewardDescription ? ` · ${voucher.rewardDescription}` : ""}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Thành viên",
      dataIndex: "memberId",
      key: "memberId",
      width: 105,
      render: (memberId: number) => `#${memberId}`,
    },
    {
      title: "Điểm đổi",
      dataIndex: "pointsCost",
      key: "pointsCost",
      width: 110,
      align: "right",
      render: (pointsCost: number) => (
        <span className="tabular-nums font-medium">{pointsCost.toLocaleString("vi-VN")} điểm</span>
      ),
    },
    {
      title: "Ngày đổi",
      dataIndex: "redeemedAt",
      key: "redeemedAt",
      width: 120,
      render: (redeemedAt: string) => new Date(redeemedAt).toLocaleDateString("vi-VN"),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 115,
      render: (_: unknown, voucher) => {
        if (voucher.status === "FULFILLED") return <CmsStatusTag label="Đã trao" tone="success" />;
        if (voucher.status === "CANCELLED") return <CmsStatusTag label="Đã hủy" tone="error" />;
        return <CmsStatusTag label="Chờ trao" tone="warning" />;
      },
    },
    {
      title: "Ghi chú / Xử lý",
      key: "details",
      width: 230,
      render: (_: unknown, voucher) => {
        const isPending = voucher.status === "AVAILABLE" || voucher.status === "PENDING_FULFILLMENT";
        if (isPending) {
          return (
            <Input
              size="small"
              aria-label="Ghi chú trao quà (không bắt buộc)"
              placeholder="Ghi chú trao quà (không bắt buộc)"
              maxLength={255}
              value={notes[voucher.id] ?? ""}
              onChange={(event) =>
                setNotes((current) => ({ ...current, [voucher.id]: event.target.value }))
              }
            />
          );
        }
        if (voucher.status === "FULFILLED") {
          return (
            <div className="space-y-0.5 text-xs text-[#607767]">
              {voucher.fulfilledAt && <div>Đã trao {formatActionDate(voucher.fulfilledAt)}</div>}
              {voucher.fulfilledById != null && <div>Người xác nhận #{voucher.fulfilledById}</div>}
              {voucher.note && <div>Ghi chú: {voucher.note}</div>}
            </div>
          );
        }
        return (
          <div className="space-y-0.5 text-xs text-[#a4473a]">
            {voucher.cancelledAt && <div>Đã hủy {formatActionDate(voucher.cancelledAt)}</div>}
            {voucher.cancelledById != null && <div>Người xử lý #{voucher.cancelledById}</div>}
            {voucher.cancellationReason && <div>Lý do: {voucher.cancellationReason}</div>}
          </div>
        );
      },
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 210,
      render: (_: unknown, voucher) => {
        const isPending = voucher.status === "AVAILABLE" || voucher.status === "PENDING_FULFILLMENT";
        if (!isPending) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space size="small" wrap>
            <Button
              type="primary"
              size="small"
              loading={busyId === voucher.id}
              disabled={busyId !== null}
              onClick={() => void fulfill(voucher)}
              className="bg-[#20392a] text-xs hover:!bg-[#2e523c]"
            >
              {busyId === voucher.id ? "Đang xác nhận" : "Xác nhận đã trao"}
            </Button>
            <Button
              size="small"
              danger
              disabled={busyId !== null}
              onClick={() => {
                setRewardToCancel(voucher);
                setCancelReason("");
                setCancelError("");
              }}
              className="text-xs"
            >
              Hủy quà
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="grid gap-4">
      {error && <Alert type="error" showIcon title={error} className="rounded-lg text-xs" />}
      {notice && <Alert type="success" showIcon title={notice} className="rounded-lg text-xs" />}

      <div className="min-w-0 overflow-x-auto pb-1">
        <Segmented
          aria-label="Lọc trạng thái quà đổi thưởng"
          style={{ background: "#e9f0e9", border: "1px solid #d7e4d8", padding: 4 }}
          value={filterTab}
          onChange={(value) => setFilterTab(value as RewardFilterTab)}
          options={[
            { label: `Tất cả (${allRewards.length})`, value: "ALL" },
            { label: `Chờ trao (${pending.length})`, value: "PENDING" },
            { label: `Đã trao (${fulfilled.length})`, value: "FULFILLED" },
            { label: `Đã hủy (${cancelled.length})`, value: "CANCELLED" },
          ]}
        />
      </div>

      <CmsDataTable<MemberVoucherDto>
        label="Danh sách quà đổi thưởng"
        rowKey="id"
        columns={columns}
        rows={displayedRewards}
        emptyText={
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Không có quà tặng trong danh sách này."
          />
        }
      />

      {rewardToCancel && (
        <Dialog.Root open onOpenChange={(open) => !cancelBusy && !open && setRewardToCancel(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-[#0f1d14]/40 backdrop-blur-[2px]" />
            <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[#e3e9e1] p-6 shadow-2xl outline-none">
              <div className="relative mb-3 pr-8">
                <Dialog.Title className="text-base font-bold text-[#1f3829]">Hủy trao quà tặng</Dialog.Title>
                <Dialog.Description className="mt-1 text-xs text-[#607767]">
                  Hủy trao quà sẽ hoàn lại {rewardToCancel.pointsCost.toLocaleString("vi-VN")} điểm đã đổi cho
                  thành viên #{rewardToCancel.memberId}.
                </Dialog.Description>
                <button
                  type="button"
                  onClick={() => setRewardToCancel(null)}
                  disabled={cancelBusy}
                  aria-label="Đóng"
                  className="absolute -right-1 -top-1 rounded-lg p-1.5 text-[#738879] transition hover:bg-[#edf2ed] hover:text-[#1f3829]"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <Form layout="vertical" onFinish={() => void submitCancelReward()} requiredMark={false}>
                <Form.Item label={<span className="text-xs font-medium text-[#20392a]">Lý do hủy quà *</span>}>
                  <Input
                    required
                    aria-label="Lý do hủy quà"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy quà..."
                    className="rounded-lg border-[#dbe3d9] text-xs"
                  />
                </Form.Item>
                {cancelError && (
                  <Alert type="error" showIcon title={cancelError} className="mb-3 rounded-lg text-xs" />
                )}
                <div className="flex justify-end gap-2 border-t border-[#edf1ea] pt-3">
                  <Button disabled={cancelBusy} onClick={() => setRewardToCancel(null)} className="rounded-lg text-xs">
                    Đóng
                  </Button>
                  <Button
                    type="primary"
                    danger
                    htmlType="submit"
                    loading={cancelBusy}
                    disabled={!cancelReason.trim()}
                    className="rounded-lg text-xs font-semibold"
                  >
                    Xác nhận hủy quà
                  </Button>
                </div>
              </Form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
