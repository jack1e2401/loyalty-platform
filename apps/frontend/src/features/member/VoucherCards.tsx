import type { MemberVoucherDto, MemberVoucherStatus, VoucherDefinitionDto } from "../../api/commerce-types";
import { Button, BusyLabel, Card, StatusText } from "../../components/ui";
import { money } from "../../lib/utils";
export function VoucherDefinitionCard({
  voucher,
  busy,
  disabled,
  canRedeem,
  onRedeem,
}: {
  voucher: VoucherDefinitionDto;
  busy: boolean;
  disabled: boolean;
  canRedeem: boolean;
  onRedeem: () => void;
}) {
  const redeemLabel = voucher.type === "REWARD" ? "Đổi quà" : "Đổi voucher";
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold break-words">{voucher.title}</h3>
        <StatusText tone="green" className="shrink-0">
          {voucher.type === "DISCOUNT" ? "Ưu đãi" : "Quà tặng"}
        </StatusText>
      </div>
      <p className="mt-3 text-sm muted break-words">
        {voucher.type === "DISCOUNT" && voucher.discountAmount
          ? `Giảm ${money(Number(voucher.discountAmount))}`
          : voucher.rewardDescription}
      </p>
      <p className="mt-4 text-sm font-bold tabular-nums">{voucher.pointsCost.toLocaleString("vi-VN")} điểm</p>
      <p className="mt-1 text-xs muted">
        {voucher.availableQuantity === null ? "Có sẵn" : `${voucher.availableQuantity} còn lại`}
      </p>
      <Button
        type="button"
        className="mt-4 w-full"
        disabled={disabled}
        aria-label={`${redeemLabel} “${voucher.title}”`}
        onClick={onRedeem}
      >
        {busy ? <BusyLabel>Đang đổi</BusyLabel> : redeemLabel}
      </Button>
      {voucher.availableQuantity !== null && voucher.availableQuantity <= 0 ? (
        <p className="mt-1.5 text-center text-[11px] text-[#a4473a]">Đã hết hàng</p>
      ) : !canRedeem ? (
        <p className="mt-1.5 text-center text-[11px] text-[#97682a]">Chưa đủ điểm để đổi</p>
      ) : null}
    </Card>
  );
}

function voucherStatusTone(status: MemberVoucherStatus): "neutral" | "green" | "amber" | "red" {
  if (status === "FULFILLED" || status === "USED") return "neutral";
  if (status === "CANCELLED") return "red";
  if (status === "PENDING_FULFILLMENT" || status === "RESERVED") return "amber";
  return "green";
}

export function OwnedVoucherCard({ voucher }: { voucher: MemberVoucherDto }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-extrabold break-words">{voucher.title}</h3>
        <StatusText tone={voucherStatusTone(voucher.status)} className="shrink-0">
          {voucherStatusLabel(voucher)}
        </StatusText>
      </div>
      <p className="mt-3 text-sm muted break-words">
        {voucher.type === "DISCOUNT" && voucher.discountAmount
          ? `Giảm ${money(Number(voucher.discountAmount))}`
          : voucher.rewardDescription}
      </p>
      <p className="mt-4 text-xs muted">
        Đổi ngày {new Date(voucher.redeemedAt).toLocaleDateString("vi-VN")}
      </p>
      {voucher.usedAt && (
        <p className="mt-1 text-xs muted">
          Đã sử dụng: {new Date(voucher.usedAt).toLocaleDateString("vi-VN")}
        </p>
      )}
    </Card>
  );
}

function voucherStatusLabel(voucher: MemberVoucherDto) {
  if (voucher.status === "PENDING_FULFILLMENT") return "Chờ cửa hàng trao";
  if (voucher.status === "CANCELLED") return "Đã hủy";
  if (voucher.status === "USED") return "Đã sử dụng";
  if (voucher.status === "FULFILLED") return "Đã trao";
  if (voucher.status === "RESERVED" || (voucher.status === "AVAILABLE" && voucher.reserved))
    return "Đang giữ cho đơn chờ";
  if (voucher.status === "AVAILABLE") {
    return voucher.type === "REWARD" ? "Chờ cửa hàng trao" : "Còn hiệu lực";
  }
  return voucher.status;
}
