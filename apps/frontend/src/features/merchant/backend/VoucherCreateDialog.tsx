import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import type { VoucherDefinitionInput } from "../../../api/commerce-types";
import { useResource } from "../../../api/useResource";
import { Button, BusyLabel, Field, Input, Select } from "../../../components/ui";
import { ConfirmActionDialog } from "../../../components/ui/ConfirmActionDialog";
import { api, message } from "../merchant-page-support";

export function VoucherCreateDialog({ token, onCreated }: { token: string; onCreated(): void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [kind, setKind] = useState<VoucherDefinitionInput["type"] | "">("");
  const [title, setTitle] = useState("");
  const [pointsCost, setPointsCost] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("0");
  const [rewardProductId, setRewardProductId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isReward = kind === "REWARD";
  const rewardProducts = useResource(
    () =>
      isReward
        ? api
            .listOwnProducts(token, { kind: "REWARD", status: "ACTIVE", limit: 100 })
            .then(({ items }) =>
              items.filter((product) => product.kind === "REWARD" && product.status === "ACTIVE"),
            )
        : Promise.resolve([]),
    [token, isReward],
  );
  const selectedReward =
    rewardProducts.loading || rewardProducts.error
      ? undefined
      : rewardProducts.data?.find((product) => String(product.id) === rewardProductId);

  async function create() {
    if (!kind || busy || (isReward && !selectedReward)) return;
    setBusy(true);
    setError("");
    try {
      const terms = { title: title.trim(), pointsCost: Number(pointsCost) };
      const input: VoucherDefinitionInput =
        kind === "REWARD"
          ? { ...terms, type: kind, discountAmount: null, rewardProductId: Number(rewardProductId) }
          : {
              ...terms,
              type: kind,
              discountAmount,
              initialQuantity: Number(initialQuantity),
              rewardDescription: null,
            };
      await api.createVoucherDefinition(input, token);
      onCreated();
      setKind("");
      setTitle("");
      setPointsCost("");
      setDiscountAmount("");
      setInitialQuantity("0");
      setRewardProductId("");
      setConfirming(false);
      setOpen(false);
    } catch (reason) {
      const failure = message(reason);
      if (failure === "REWARD_PRODUCT_NOT_FOUND") {
        setError("Sản phẩm đổi thưởng không còn khả dụng. Hãy chọn sản phẩm khác.");
        setRewardProductId("");
        rewardProducts.reload();
      } else {
        setError(failure);
      }
    } finally {
      setBusy(false);
    }
  }


  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!busy && !confirming) setOpen(next); }}>
      <Dialog.Trigger asChild><Button type="button">+ Tạo voucher</Button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <Dialog.Title className="mb-5 text-xl font-bold text-[#20392a]">Tạo voucher</Dialog.Title>
          <Dialog.Description className="sr-only">Nhập thông tin voucher và xác nhận tạo.</Dialog.Description>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setConfirming(true); }}>
          <Field label="Loại voucher">
            <Select
              required
              disabled={busy}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="" disabled>
                Chọn loại voucher
              </option>
              <option value="DISCOUNT">Giảm giá</option>
              <option value="REWARD">Quà tặng</option>
            </Select>
          </Field>
          {kind && (
            <>
              <Field label="Tên voucher">
                <Input
                  required
                  maxLength={191}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </Field>
              <Field label="Điểm cần đổi">
                <Input
                  required
                  type="number"
                  min={1}
                  step={1}
                  value={pointsCost}
                  onChange={(event) => setPointsCost(event.target.value)}
                />
              </Field>
              {kind === "DISCOUNT" ? (
                <>
                  <Field label="Số tiền giảm (VND)">
                    <Input
                      required
                      inputMode="numeric"
                      pattern="[1-9][0-9]{0,14}"
                      value={discountAmount}
                      onChange={(event) => setDiscountAmount(event.target.value)}
                    />
                  </Field>
                  <Field label="Số lượt phát hành ban đầu">
                    <Input
                      required
                      type="number"
                      min={0}
                      max={2147483647}
                      step={1}
                      value={initialQuantity}
                      onChange={(event) => setInitialQuantity(event.target.value)}
                    />
                  </Field>
                </>
              ) : (
                <div>
                  <Field label="Sản phẩm đổi thưởng">
                    <Select
                      required
                      disabled={
                        busy ||
                        rewardProducts.loading ||
                        !!rewardProducts.error ||
                        !rewardProducts.data?.length
                      }
                      value={selectedReward ? rewardProductId : ""}
                      onChange={(event) => setRewardProductId(event.target.value)}
                    >
                      <option value="" disabled>
                        {rewardProducts.loading ? "Đang tải sản phẩm…" : "Chọn sản phẩm"}
                      </option>
                      {rewardProducts.data?.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} · #{product.id}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {rewardProducts.error ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p role="alert" className="text-xs text-[#a4473a]">
                        Không tải được sản phẩm đổi thưởng.
                      </p>
                      <Button type="button" size="sm" variant="outline" onClick={rewardProducts.reload}>
                        Thử lại
                      </Button>
                    </div>
                  ) : !rewardProducts.loading && !rewardProducts.data?.length ? (
                    <p className="mt-2 text-xs muted">
                      Chưa có sản phẩm chỉ đổi thưởng đang hoạt động.{" "}
                      <Link to="/merchant/products" className="underline">
                        Quản lý sản phẩm
                      </Link>
                    </p>
                  ) : null}
                </div>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="sm:col-span-2 text-sm text-[#a4473a]">
              {error}
            </p>
          )}
          {kind && (
            <div className="sm:col-span-2">
              <Button disabled={busy || (isReward && !selectedReward)}>
                {busy ? <BusyLabel>Đang lưu</BusyLabel> : "Tạo voucher"}
              </Button>
            </div>
          )}
        </form>
        </Dialog.Content>
      </Dialog.Portal>
      <ConfirmActionDialog open={confirming} onOpenChange={setConfirming} title="Tạo voucher?"
        description={`Tạo “${title.trim()}” với ${Number(pointsCost).toLocaleString("vi-VN")} điểm đổi.`}
        confirmLabel="Xác nhận tạo" busy={busy} error={error || undefined} onConfirm={() => void create()} />
    </Dialog.Root>
  );
}
