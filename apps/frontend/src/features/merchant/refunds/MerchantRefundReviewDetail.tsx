import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Flex,
  Input,
  Space,
  Spin,
  Typography,
  type TableColumnsType,
} from "antd";
import { createRefundsClient, translateRefundRequestError } from "../../../api/refunds-client";
import type {
  ManualRefundEvidenceInput,
  RefundRequestDetailResponse,
  RefundRequestStatus,
} from "../../../api/refunds-types";
import { MerchantPagination } from "../cms/MerchantPagination";
import { CmsDataTable, CmsDetailLayout, CmsStatusTag } from "../cms";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";
import { MerchantRefundReconciliationPanel } from "./MerchantRefundReconciliationPanel";
import { MerchantRefundPreview } from "./MerchantRefundPreview";

const api = createRefundsClient();
const money = (value: string) => `${Number(value).toLocaleString("vi-VN")} ₫`;

type Props = {
  requestId: number;
  token: string;
  onClose(): void;
  onUpdated(status: RefundRequestStatus): void;
};

export function MerchantRefundReviewDetail({ requestId, token, onClose, onUpdated }: Props) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [challengePage, setChallengePage] = useState(1);
  const [challengeLimit, setChallengeLimit] = useState(20);
  const [data, setData] = useState<RefundRequestDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    api
      .getMerchantRefundRequest(requestId, token, { page, limit, challengePage, challengeLimit })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
      });
    return () => {
      active = false;
    };
  }, [requestId, token, page, limit, challengePage, challengeLimit]);

  async function decide(action: "approve" | "reject") {
    if (busy || (action === "reject" && !note.trim())) return;
    setBusy(true);
    setError("");
    try {
      const { refundRequest } =
        action === "approve"
          ? await api.approveMerchantRefundRequest(requestId, token, note.trim() || undefined)
          : await api.rejectMerchantRefundRequest(requestId, note.trim(), token);
      onUpdated(refundRequest.status);
    } catch (cause) {
      setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  async function recordReconciliationOutcome(evidence: ManualRefundEvidenceInput) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.reconcileMerchantRefundRequest(requestId, evidence, token);
      onUpdated(response.refundRequest.status);
    } catch (cause) {
      setError(translateRefundRequestError(cause instanceof Error ? cause.message : "INVALID_INPUT"));
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error)
    return (
      <Flex justify="center" className="py-12">
        <Spin description="Đang tải yêu cầu hoàn tiền…" />
      </Flex>
    );
  if (error && !data)
    return (
      <Alert
        type="error"
        showIcon
        title="Không tải được yêu cầu hoàn tiền"
        description={error}
        action={<Button onClick={onClose}>Quay lại danh sách</Button>}
      />
    );
  if (!data) return null;

  const pending = isRefundAwaitingMerchant(data.refundRequest.status);
  const requiresManualReconciliation = data.order.paymentProvider !== "MOCK";
  const awaitingReconciliation = data.refundRequest.status === "PROCESSING" && requiresManualReconciliation;
  const paymentProviderLabel = data.order.paymentProvider === "VNPAY"
    ? "VNPay (lịch sử)"
    : data.order.paymentProvider === "MOCK"
      ? "Mock"
      : "Chưa xác định";
  const statusTone =
    data.refundRequest.status === "COMPLETED"
      ? "success"
      : data.refundRequest.status === "REJECTED" || data.refundRequest.status === "FAILED"
        ? "error"
        : pending || data.refundRequest.status === "PROCESSING"
          ? "warning"
          : "info";
  const orderColumns: TableColumnsType<RefundRequestDetailResponse["order"]["items"][number]> = [
    { title: "Sản phẩm", dataIndex: "productName", key: "productName" },
    { title: "Số lượng", dataIndex: "quantity", key: "quantity", align: "right", width: 110 },
    {
      title: "Đơn giá",
      dataIndex: "unitPrice",
      key: "unitPrice",
      align: "right",
      render: (value: string) => money(value),
    },
    {
      title: "Thành tiền",
      dataIndex: "lineTotal",
      key: "lineTotal",
      align: "right",
      render: (value: string) => money(value),
    },
  ];

  return (
    <CmsDetailLayout
      title={`Yêu cầu hoàn tiền #${requestId}`}
      backTo="/merchant/refund-requests"
      backLabel="Quay lại yêu cầu hoàn tiền"
      status={<CmsStatusTag label={refundRequestStatusLabel(data.refundRequest.status)} tone={statusTone} />}
    >
      {error ? <Alert type="error" showIcon title={error} className="mb-4" /> : null}
      <Card title="Thông tin yêu cầu" size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
          <Descriptions.Item label="Đơn hàng">#{data.order.id}</Descriptions.Item>
          <Descriptions.Item label="Thành viên">
            {data.member?.email ?? `#${data.order.memberId}`}
          </Descriptions.Item>
          <Descriptions.Item label="Tổng tiền">{money(data.order.total)}</Descriptions.Item>
          <Descriptions.Item label="Nguồn thanh toán">{paymentProviderLabel}</Descriptions.Item>
          {data.order.paymentProviderReference ? <Descriptions.Item label="Mã thanh toán">{data.order.paymentProviderReference}</Descriptions.Item> : null}
          {data.order.paymentProviderTransactionNo ? <Descriptions.Item label="Mã giao dịch nhà cung cấp">{data.order.paymentProviderTransactionNo}</Descriptions.Item> : null}
          <Descriptions.Item label="Gửi lúc">
            {new Date(data.refundRequest.requestedAt).toLocaleString("vi-VN")}
          </Descriptions.Item>
          <Descriptions.Item label="Lý do" span={{ xs: 1, sm: 2, lg: 3 }}>
            {data.refundRequest.reason}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="Sản phẩm trong đơn" size="small">
        <CmsDataTable
          label="Sản phẩm trong đơn"
          rows={data.order.items}
          columns={orderColumns}
          rowKey="productId"
        />
        {data.itemPagination && <MerchantPagination {...data.itemPagination}
          onChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }} />}
      </Card>
      {pending ? (
        <Card title="Tác động dự kiến khi hoàn tiền" size="small">
          {requiresManualReconciliation ? (
            <Alert
              type="warning"
              showIcon
              title="Cần đối soát hoàn tiền thủ công"
              description="Duyệt yêu cầu chỉ chuyển sang đối soát. Hệ thống không xác nhận hoàn tiền, hoàn điểm hoặc khôi phục voucher trước khi nhà cung cấp xác nhận."
            />
          ) : (
            <>
              <Typography.Paragraph type="secondary" className="!mb-3">
                Thông tin này do hệ thống tính trước. Quyết định chỉ được gửi sau khi bạn xác nhận.
              </Typography.Paragraph>
              <MerchantRefundPreview preview={data.preview} onChallengePageChange={(nextPage, nextLimit) => {
                setChallengePage(nextPage); setChallengeLimit(nextLimit);
              }} />
            </>
          )}
        </Card>
      ) : (
        <Card title="Kết quả xử lý" size="small">
          <Typography.Paragraph className="!mb-0">
            {data.refundRequest.adminDecisionReason ??
              data.refundRequest.merchantDecisionReason ??
              refundRequestStatusLabel(data.refundRequest.status)}
          </Typography.Paragraph>
        </Card>
      )}
      {awaitingReconciliation ? (
        <MerchantRefundReconciliationPanel
          attempts={data.reconciliationAttempts ?? []}
          busy={busy}
          onSubmit={(evidence) => void recordReconciliationOutcome(evidence)}
        />
      ) : null}
      {pending ? (
        <Card title="Quyết định" size="small">
          <Space orientation="vertical" size={12} className="w-full">
            <Input.TextArea
              aria-label="Ghi chú hoặc lý do từ chối"
              maxLength={255}
              disabled={busy || confirming !== null}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Nhập ghi chú; bắt buộc khi từ chối"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            {confirming ? (
              <Alert
                type="warning"
                showIcon
                title={
                  confirming === "approve"
                    ? requiresManualReconciliation
                      ? `Chuyển yêu cầu của đơn #${data.order.id} sang đối soát thủ công?`
                      : `Xác nhận hoàn ${money(data.preview.refundAmountVnd)} cho đơn #${data.order.id}?`
                    : "Xác nhận từ chối yêu cầu hoàn tiền?"
                }
                description={
                  confirming === "approve"
                    ? requiresManualReconciliation
                      ? "Yêu cầu sẽ chuyển sang trạng thái đối soát. Hệ thống chưa xác nhận hoàn tiền hoặc điều chỉnh điểm, voucher."
                      : "Hành động này sẽ gửi yêu cầu hoàn tiền để hệ thống xử lý."
                    : `Yêu cầu sẽ bị từ chối với lý do: “${note.trim()}”.`
                }
                action={
                  <Flex gap={8} wrap>
                    <Button disabled={busy} onClick={() => setConfirming(null)}>
                      Quay lại
                    </Button>
                    <Button
                      type={confirming === "reject" ? "default" : "primary"}
                      danger={confirming === "reject"}
                      loading={busy}
                      onClick={() => void decide(confirming)}
                    >
                      {confirming === "approve"
                        ? requiresManualReconciliation ? "Xác nhận đối soát" : "Xác nhận hoàn tiền"
                        : "Xác nhận từ chối"}
                    </Button>
                  </Flex>
                }
              />
            ) : (
              <Flex gap={8} wrap>
                <Button danger disabled={busy || !note.trim()} onClick={() => setConfirming("reject")}>
                  Từ chối
                </Button>
                <Button
                  type="primary"
                  disabled={busy}
                  onClick={() => setConfirming("approve")}
                >
                  {requiresManualReconciliation ? "Chuyển đối soát" : "Duyệt hoàn tiền"}
                </Button>
              </Flex>
            )}
          </Space>
        </Card>
      ) : null}
    </CmsDetailLayout>
  );
}
