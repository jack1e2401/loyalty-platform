import { useId, useState } from "react";
import { Alert, Button, Empty, Flex, Input, Segmented, Tag, Typography } from "antd";
import { ArrowDownLeft, ArrowUpRight, Package } from "@phosphor-icons/react";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";

export type InventoryBalance = {
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type InventoryMovement = {
  id: number | string;
  movementType: string;
  quantityDelta: number;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string;
  actorId?: number | null;
  actorEmail?: string | null;
  createdAt: string;
};

export type InventoryAdjustment = {
  direction: "in" | "out";
  quantity: number;
  reason: string;
  returnToStock?: boolean;
};

export type InventoryPanelProps = {
  balance: InventoryBalance;
  movements: InventoryMovement[];
  onAdjust: (adjustment: InventoryAdjustment) => Promise<unknown>;
  mode?: "adjust" | "history";
  subject?: "product" | "voucher";
  uninitialized?: boolean;
};

const dateTime = (value: string) => new Date(value).toLocaleString("vi-VN");

const movementLabels: Record<string, string> = {
  INITIAL_STOCK: "Tồn kho ban đầu",
  MANUAL_IN: "Nhập kho thủ công",
  MANUAL_OUT: "Xuất kho thủ công",
  RETURN_IN: "Nhập lại hàng trả",
  ORDER_RESERVE: "Giữ hàng cho đơn",
  ORDER_RELEASE: "Hoàn hàng giữ của đơn",
  SALE_OUT: "Đã bán",
  REWARD_RESERVE: "Giữ hàng đổi thưởng",
  REWARD_CANCEL_RELEASE: "Hoàn giữ quà bị hủy",
  REWARD_FULFILL_OUT: "Đã trao quà",
  VOUCHER_REDEMPTION_OUT: "Đã phát hành ưu đãi",
  REDEMPTION_REVERSAL_IN: "Hoàn số lượng ưu đãi",
  REWARD_LEGACY_RESERVE: "Giữ hàng cho lượt đổi trước đây",
  LEGACY_BACKFILL: "Chuyển dữ liệu tồn kho",
};

const voucherMovementLabels: Record<string, string> = {
  INITIAL_STOCK: "Lượt phát hành ban đầu",
  MANUAL_IN: "Tăng lượt phát hành",
  MANUAL_OUT: "Giảm lượt phát hành",
  LEGACY_BACKFILL: "Chuyển dữ liệu lượt phát hành",
};

function actorLabel(movement: InventoryMovement) {
  if (movement.actorEmail) return movement.actorEmail;
  if (movement.actorId !== null && movement.actorId !== undefined) return `Tài khoản #${movement.actorId}`;
  return "Hệ thống";
}

export function InventoryPanel({
  balance,
  movements,
  onAdjust,
  mode,
  subject = "product",
  uninitialized = false,
}: InventoryPanelProps) {
  const titleId = useId();
  const isVoucher = subject === "voucher";
  const subjectLabel = isVoucher ? "Lượt phát hành" : "Tồn kho";
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState<InventoryAdjustment | null>(null);

  const parsedQty = Number(quantity);
  const validPreviewQty = Number.isSafeInteger(parsedQty) && parsedQty > 0 && parsedQty <= 2_147_483_647 ? parsedQty : null;
  const quickReasons = isVoucher
    ? ["Bổ sung lượt phát hành", "Điều chỉnh chiến dịch", "Thu hồi lượt"]
    : ["Nhập lô hàng mới", "Kiểm kê bổ sung", "Hàng hỏng / hết hạn", "Khách trả hàng"];
  const filteredMovements = movements.filter((m) => {
    if (historyFilter === "IN") return m.quantityDelta > 0;
    if (historyFilter === "OUT") return m.quantityDelta < 0;
    return true;
  });

  async function submit(event: { preventDefault: () => void }, direction: InventoryAdjustment["direction"]) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const parsedQuantity = Number(quantity);
    const trimmedReason = reason.trim();
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 2_147_483_647) {
      setError("Số lượng phải là số nguyên dương.");
      return;
    }
    if (!trimmedReason) {
      setError("Vui lòng nhập ghi chú.");
      return;
    }

    setPending({ direction, quantity: parsedQuantity, reason: trimmedReason });
  }

  async function confirmAdjustment() {
    if (!pending || loading) return;
    setError("");
    setLoading(true);
    try {
      await onAdjust(pending);
      setPending(null);
      setSuccess(isVoucher ? "Đã cập nhật lượt phát hành." : "Tồn kho đã được cập nhật.");
      setQuantity("");
      setReason("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : isVoucher
            ? "Không thể cập nhật lượt phát hành."
            : "Không thể cập nhật tồn kho.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby={titleId}
      className={mode ? "space-y-5" : "space-y-5 rounded-2xl border border-[#e4e9e1] bg-white p-5"}
    >
      <h2 id={titleId} className={mode ? "sr-only" : "text-lg font-bold"}>
        {subjectLabel}
      </h2>
      {mode !== "history" && (
        <>
          {!uninitialized && (
            <div className={`grid gap-3 ${isVoucher ? "grid-cols-1" : "grid-cols-3"}`}>
              {!isVoucher && (
                <>
                  <div className="rounded-xl border border-[#e3e9e1] bg-[#fcfdfc] p-3">
                    <div className="text-xs text-[#607767]">Tồn thực tế</div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-[#1f3829]">{balance.onHandQuantity}</div>
                  </div>
                  <div className="rounded-xl border border-[#e3e9e1] bg-[#fcfdfc] p-3">
                    <div className="text-xs text-[#607767]">Đã giữ chỗ</div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-[#8c5a17]">{balance.reservedQuantity}</div>
                  </div>
                </>
              )}
              <div className="rounded-xl border border-[#d7e4d8] bg-[#f7faf7] p-3">
                <div className="text-xs font-medium text-[#2f5a3e]">
                  {isVoucher ? "Lượt còn lại" : "Có thể bán"}
                </div>
                <div className="mt-1 text-xl font-bold tabular-nums text-[#1f3829]">{balance.availableQuantity}</div>
              </div>
            </div>
          )}

          <form
            className="grid gap-3 rounded-xl border border-[#e3e9e1] bg-[#fcfdfc] p-4 sm:grid-cols-2"
            onSubmit={(event) => event.preventDefault()}
          >
            <div className="grid gap-1.5">
              <label htmlFor={`${titleId}-qty`} className="text-xs font-semibold text-[#20392a]">
                Số lượng
              </label>
              <Input
                id={`${titleId}-qty`}
                aria-label="Số lượng"
                inputMode="numeric"
                type="number"
                min="1"
                max="2147483647"
                step="1"
                placeholder="Nhập số lượng..."
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor={`${titleId}-reason`} className="text-xs font-semibold text-[#20392a]">
                Ghi chú
              </label>
              <Input
                id={`${titleId}-reason`}
                aria-label="Ghi chú"
                maxLength={255}
                placeholder="Lý do điều chỉnh kho..."
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                allowClear
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 sm:col-span-2">
              <Typography.Text type="secondary" className="text-xs">Gợi ý:</Typography.Text>
              {quickReasons.map((item) => (
                <Tag
                  key={item}
                  onClick={() => setReason(item)}
                  className="cursor-pointer rounded-md border-[#d7e4d8] bg-white text-xs text-[#2f5a3e] hover:border-[#2f5a3e]"
                >
                  {item}
                </Tag>
              ))}
            </div>
            {validPreviewQty !== null && !uninitialized && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-[#e3e9e1] bg-white px-3 py-2 text-xs text-[#607767] sm:col-span-2">
                <span>
                  Nếu nhập: <strong className="text-[#1f6a3f]">{balance.availableQuantity} → {balance.availableQuantity + validPreviewQty}</strong>
                </span>
                <span>
                  Nếu xuất: <strong className="text-[#a4473a]">{balance.availableQuantity} → {Math.max(0, balance.availableQuantity - validPreviewQty)}</strong>
                </span>
              </div>
            )}
            <Flex gap={8} wrap className="sm:col-span-2">
              <Button
                type="primary"
                icon={<ArrowDownLeft size={15} />}
                disabled={loading}
                onClick={(event) => void submit(event, "in")}
                className="bg-[#20392a] hover:!bg-[#2e523c]"
              >
                {loading ? "Đang lưu…" : isVoucher ? "Tăng lượt phát hành" : "Nhập kho"}
              </Button>
              <Button
                danger
                icon={<ArrowUpRight size={15} />}
                disabled={loading || uninitialized}
                onClick={(event) => void submit(event, "out")}
              >
                {loading ? "Đang lưu…" : isVoucher ? "Giảm lượt phát hành" : "Xuất kho"}
              </Button>
            </Flex>
            {error && !pending && (
              <Alert role="alert" type="error" showIcon title={error} className="sm:col-span-2" />
            )}
            {success && (
              <Alert role="status" type="success" showIcon title={success} className="sm:col-span-2" />
            )}
          </form>
        </>
      )}

      <ConfirmActionDialog open={pending !== null} onOpenChange={(open) => { if (!open && !loading) setPending(null); }}
        title="Xác nhận điều chỉnh?"
        description={`${uninitialized ? "Số dư ban đầu được ghi nhận là 0. " : ""}${pending?.direction === "in" ? "Tăng" : "Giảm"} ${pending?.quantity ?? 0} ${isVoucher ? "lượt phát hành" : "đơn vị tồn kho"}.`}
        confirmLabel="Xác nhận điều chỉnh" busy={loading} error={error} onConfirm={() => void confirmAdjustment()} />

      {mode !== "adjust" && (
        <div className="space-y-3">
          <Flex justify="space-between" align="center" wrap gap={8}>
            {mode !== "history" ? (
              <Typography.Title level={5} style={{ margin: 0 }}>Lịch sử điều chỉnh</Typography.Title>
            ) : <span />}
            {movements.length > 0 && (
              <Segmented
                size="small"
                aria-label="Lọc chiều biến động"
                value={historyFilter}
                onChange={(val) => setHistoryFilter(val as "ALL" | "IN" | "OUT")}
                options={[
                  { label: `Tất cả (${movements.length})`, value: "ALL" },
                  { label: "Nhập / Tăng", value: "IN" },
                  { label: "Xuất / Giảm", value: "OUT" },
                ]}
              />
            )}
          </Flex>
          {filteredMovements.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={isVoucher ? "Chưa có lịch sử phát hành." : "Chưa có lịch sử tồn kho."}
            />
          ) : (
            <ul className="grid gap-2.5">
              {filteredMovements.map((movement) => {
                const isPositive = movement.quantityDelta > 0;
                const typeText =
                  (isVoucher ? voucherMovementLabels[movement.movementType] : undefined) ??
                  movementLabels[movement.movementType] ??
                  movement.movementType;
                return (
                  <li
                    key={movement.id}
                    className="rounded-xl border border-[#e3e9e1] bg-white p-3.5 text-sm transition hover:border-[#cddac9]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-[#1f3829]">{movement.reason}</span>
                          <Tag
                            className="m-0 rounded-md border-0 text-[11px]"
                            color={isPositive ? "green" : "volcano"}
                          >
                            {typeText}
                          </Tag>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ${
                          isPositive ? "bg-[#e8f5ee] text-[#1f6a3f]" : "bg-[#fdeceb] text-[#a4473a]"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {movement.quantityDelta}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#607767]">
                      <span className="inline-flex items-center gap-1 font-medium text-[#20392a]">
                        <Package size={13} aria-hidden="true" />
                        {isVoucher ? "Lượt còn lại" : "Tồn"}: {movement.onHandBefore} → {movement.onHandAfter}
                      </span>
                      {!isVoucher && (
                        <span>
                          Đã giữ: {movement.reservedBefore} → {movement.reservedAfter}
                        </span>
                      )}
                      <span>Thực hiện bởi {actorLabel(movement)}</span>
                      <time dateTime={movement.createdAt}>{dateTime(movement.createdAt)}</time>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
