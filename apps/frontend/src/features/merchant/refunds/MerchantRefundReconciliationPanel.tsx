import { useState } from "react";
import { Alert, Button, Card, Input, Select, Space } from "antd";
import type { ManualRefundEvidenceInput, RefundReconciliationAttemptDto } from "../../../api/refunds-types";

type Props = {
  attempts: RefundReconciliationAttemptDto[];
  busy: boolean;
  onSubmit(evidence: ManualRefundEvidenceInput): void;
};

export function MerchantRefundReconciliationPanel({ attempts, busy, onSubmit }: Props) {
  const [outcome, setOutcome] = useState<"SETTLED" | "FAILED">("SETTLED");
  const [providerReference, setProviderReference] = useState("");
  const [providerTransactionNo, setProviderTransactionNo] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const canSubmit = providerReference.trim() && (outcome === "SETTLED" || failureReason.trim());

  return (
    <Card title="Đối soát hoàn tiền" size="small">
      <Space orientation="vertical" size={12} className="w-full">
        <Alert
          type="info"
          showIcon
          title="Chưa ghi nhận kết quả từ nhà cung cấp"
          description="Sau khi đối soát bên ngoài, ghi lại mã giao dịch và kết quả. Chỉ kết quả đã xác nhận mới hoàn tất đơn và điều chỉnh điểm."
        />
        {attempts.map((attempt) => (
          <Alert
            key={attempt.id}
            type={attempt.outcome === "SETTLED" ? "success" : "error"}
            showIcon
            title={attempt.outcome === "SETTLED" ? "Đã xác nhận hoàn tiền" : "Nhà cung cấp báo thất bại"}
            description={`${attempt.providerReference}${attempt.providerTransactionNo ? ` · ${attempt.providerTransactionNo}` : ""}${attempt.failureReason ? ` · ${attempt.failureReason}` : ""}`}
          />
        ))}
        <Select
          aria-label="Kết quả đối soát"
          value={outcome}
          options={[
            { value: "SETTLED", label: "Nhà cung cấp đã hoàn tiền" },
            { value: "FAILED", label: "Nhà cung cấp báo thất bại" },
          ]}
          onChange={setOutcome}
        />
        <Input
          aria-label="Mã giao dịch hoàn tiền"
          value={providerReference}
          onChange={(event) => setProviderReference(event.target.value)}
          placeholder="Mã giao dịch hoàn tiền từ nhà cung cấp"
          maxLength={191}
        />
        <Input
          aria-label="Mã tham chiếu giao dịch nhà cung cấp"
          value={providerTransactionNo}
          onChange={(event) => setProviderTransactionNo(event.target.value)}
          placeholder="Mã tham chiếu bổ sung (không bắt buộc)"
          maxLength={64}
        />
        {outcome === "FAILED" ? (
          <Input
            aria-label="Lý do thất bại đối soát"
            value={failureReason}
            onChange={(event) => setFailureReason(event.target.value)}
            placeholder="Lý do nhà cung cấp báo thất bại"
            maxLength={255}
          />
        ) : null}
        <Button
          type="primary"
          loading={busy}
          disabled={!canSubmit}
          onClick={() => onSubmit({
            outcome,
            providerReference: providerReference.trim(),
            providerTransactionNo: providerTransactionNo.trim() || undefined,
            failureReason: outcome === "FAILED" ? failureReason.trim() : undefined,
          })}
        >
          Ghi nhận kết quả đối soát
        </Button>
      </Space>
    </Card>
  );
}
