import { useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { VoucherDefinitionDto, VoucherDefinitionPatch } from "../../api/commerce-types";
import { Button, BusyLabel, Field, Input, Textarea } from "../../components/ui";
export function VoucherEditForm({
  definition,
  busy,
  onSave,
}: {
  definition: VoucherDefinitionDto;
  busy: boolean;
  onSave(patch: VoucherDefinitionPatch): Promise<void>;
}) {
  const [title, setTitle] = useState(definition.title);
  const [pointsCost, setPointsCost] = useState(String(definition.pointsCost));
  const [discountAmount, setDiscountAmount] = useState(definition.discountAmount ?? "");
  const [rewardDescription, setRewardDescription] = useState(definition.rewardDescription ?? "");
  const [error, setError] = useState("");
  const isDiscount = definition.type === "DISCOUNT";
  const isLegacyReward = !isDiscount && definition.rewardProductId === null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name = title.trim();
    const description = rewardDescription.trim();
    if (!name || (isLegacyReward && !description)) {
      setError(!name ? "Vui lòng nhập tên voucher." : "Vui lòng nhập mô tả quà tặng.");
      return;
    }
    setError("");
    try {
      await onSave({
        title: name,
        pointsCost: Number(pointsCost),
        ...(isDiscount ? { discountAmount } : {}),
        ...(isLegacyReward ? { rewardDescription: description } : {}),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật voucher.");
    }
  }

  return (
    <form className="mt-5 grid gap-4" onSubmit={submit}>
      <Field label="Tên voucher">
        <Input
          required
          disabled={busy}
          maxLength={191}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </Field>
      <Field label="Điểm cần đổi">
        <Input
          required
          disabled={busy}
          type="number"
          min={1}
          max={2147483647}
          step={1}
          value={pointsCost}
          onChange={(event) => setPointsCost(event.target.value)}
        />
      </Field>
      {isDiscount && (
        <Field label="Số tiền giảm (VND)">
          <Input
            required
            disabled={busy}
            inputMode="numeric"
            pattern="[1-9][0-9]{0,14}"
            value={discountAmount}
            onChange={(event) => setDiscountAmount(event.target.value)}
          />
        </Field>
      )}
      {isLegacyReward && (
        <Field label="Mô tả quà tặng">
          <Textarea
            required
            disabled={busy}
            maxLength={1000}
            value={rewardDescription}
            onChange={(event) => setRewardDescription(event.target.value)}
          />
        </Field>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Dialog.Close asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Hủy
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={busy}>
          {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Lưu voucher"}
        </Button>
      </div>
    </form>
  );
}
