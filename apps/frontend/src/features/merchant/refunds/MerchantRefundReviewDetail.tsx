import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  RefundRequestDetailResponse,
  RefundRequestStatus,
} from "../../../api/refunds-types";
import { MerchantPagination } from "../cms/MerchantPagination";
import { CmsDataTable, CmsDetailLayout, CmsStatusTag } from "../cms";
import { isRefundAwaitingMerchant, refundRequestStatusLabel } from "../../refunds/refund-status";
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
        : pending
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
          <Descriptions.Item label="Đơn hàng">
            <Link to={`/merchant/orders?orderId=${data.order.id}`} className="font-medium text-[#20392a] hover:underline">
              #{data.order.id}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Thành viên">
            <Link to={`/merchant/customers/${data.order.memberId}`} className="font-medium text-[#20392a] hover:underline">
              {data.member?.email ?? `#${data.order.memberId}`}
            </Link>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng tiền">{money(data.order.total)}</Descriptions.Item>
          <Descriptions.Item label="Voucher giảm giá">
            {Number(data.order.discountAmount) > 0 ? `−${money(data.order.discountAmount)}` : "Không"}
          </Descriptions.Item>
          <Descriptions.Item label="Thanh toán đơn">
            {data.order.paidAt ? new Date(data.order.paidAt).toLocaleString("vi-VN") : "—"}
          </Descriptions.Item>
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
          <Typography.Paragraph type="secondary" className="!mb-3">
            Thông tin này do hệ thống tính trước. Quyết định chỉ được gửi sau khi bạn xác nhận.
          </Typography.Paragraph>
          <MerchantRefundPreview preview={data.preview} onChallengePageChange={(nextPage, nextLimit) => {
            setChallengePage(nextPage); setChallengeLimit(nextLimit);
          }} />
        </Card>
      ) : (
        <Card title="Kết quả xử lý" size="small">
          <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="Trạng thái">
              <CmsStatusTag label={refundRequestStatusLabel(data.refundRequest.status)} tone={statusTone} />
            </Descriptions.Item>
            <Descriptions.Item label="Thời gian xử lý">
              {data.refundRequest.merchantReviewedAt
                ? new Date(data.refundRequest.merchantReviewedAt).toLocaleString("vi-VN")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi chú cửa hàng" span={{ xs: 1, sm: 2 }}>
              {data.refundRequest.merchantDecisionReason ?? refundRequestStatusLabel(data.refundRequest.status)}
            </Descriptions.Item>
            {data.settlement ? (
              <>
                <Descriptions.Item label="Số tiền hoàn thực tế">
                  {money(data.settlement.amountVnd)}
                </Descriptions.Item>
                <Descriptions.Item label="Hoàn tất giao dịch">
                  {data.settlement.completedAt
                    ? new Date(data.settlement.completedAt).toLocaleString("vi-VN")
                    : data.settlement.status}
                </Descriptions.Item>
              </>
            ) : null}
          </Descriptions>
        </Card>
      )}
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
            <Typography.Text type="secondary" className="text-xs">
              Bắt buộc nhập lý do nếu từ chối yêu cầu hoàn tiền.
            </Typography.Text>
            {confirming ? (
              <Alert
                type="warning"
                showIcon
                title={
                  confirming === "approve"
                    ? `Xác nhận hoàn ${money(data.preview.refundAmountVnd)} cho đơn #${data.order.id}?`
                    : "Xác nhận từ chối yêu cầu hoàn tiền?"
                }
                description={
                  confirming === "approve"
                    ? "Hành động này sẽ gửi yêu cầu hoàn tiền để hệ thống xử lý."
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
                      {confirming === "approve" ? "Xác nhận hoàn tiền" : "Xác nhận từ chối"}
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
                  Duyệt hoàn tiền
                </Button>
              </Flex>
            )}
          </Space>
        </Card>
      ) : null}
    </CmsDetailLayout>
  );
}
