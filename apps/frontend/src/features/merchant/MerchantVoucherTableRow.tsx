import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsThreeVertical, PencilSimple } from "@phosphor-icons/react";
import { createCommerceClient } from "../../api/commerce-http";
import type { VoucherDefinitionDto, VoucherDefinitionPatch } from "../../api/commerce-types";
import { Button } from "../../components/ui";
import { ConfirmActionDialog } from "../../components/ui/ConfirmActionDialog";
import { money } from "../../lib/utils";
import { VoucherEditForm } from "./VoucherEditForm";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const menuItem =
  "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-sm outline-none hover:bg-[#edf4e9] focus:bg-[#edf4e9] data-disabled:pointer-events-none data-disabled:opacity-50";

const dialogTitles = {
  edit: "Chỉnh sửa voucher",
};
type RowProps = {
  definition: VoucherDefinitionDto;
  token: string;
  statusBusy: boolean;
  onToggle(): Promise<void>;
  onDefinitionChange(definition: VoucherDefinitionDto): void;
};

export function MerchantVoucherTableRow({
  definition,
  token,
  statusBusy,
  onToggle,
  onDefinitionChange,
}: RowProps) {
  const [mode, setMode] = useState<keyof typeof dialogTitles | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusError, setStatusError] = useState("");
  const navigate = useNavigate();
  const [dialogBusy, setDialogBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const isDiscount = definition.type === "DISCOUNT";
  const terms =
    isDiscount && definition.discountAmount
      ? `Giảm trực tiếp ${money(Number(definition.discountAmount))}`
      : definition.rewardProductName ? `Sản phẩm kho: ${definition.rewardProductName}` : definition.rewardDescription;

  async function saveDefinition(patch: VoucherDefinitionPatch) {
    setDialogBusy(true);
    try {
      const result = await api.updateVoucherDefinition(definition.id, patch, token);
      onDefinitionChange(result.definition);
      setMode(null);
    } finally {
      setDialogBusy(false);
    }
  }

  async function confirmToggleStatus() {
    if (statusBusy) return;
    setStatusError("");
    try {
      await onToggle();
      setStatusDialogOpen(false);
    } catch (reason) {
      setStatusError(reason instanceof Error ? reason.message : "Không thể cập nhật trạng thái voucher.");
    }
  }

  return (
    <>
      <tr className="border-t border-[#edf1ea] align-middle">
        <th scope="row" className="break-words px-5 py-4 font-bold text-[#20392a]">
          {definition.title}
          {terms && <span className="mt-1 block text-xs font-normal muted">{terms}</span>}
        </th>
        <td className="px-4 py-4 text-sm"><span className="rounded-full bg-[#edf4e9] px-2.5 py-1 text-xs font-semibold text-[#315e3c]">{isDiscount ? "Giảm giá" : "Quà tặng"}</span></td>
        <td className="whitespace-nowrap px-4 py-4 text-sm font-semibold">
          {definition.pointsCost.toLocaleString("vi-VN")} điểm
        </td>
        <td className="px-4 py-4 text-sm">
          {isDiscount ? (
            <div className="space-y-2">
              <p>{definition.availableQuantity ?? "—"} / {definition.issuedQuantity ?? "—"} lượt</p>
              <button type="button" className="text-xs font-semibold text-[#315e3c] underline underline-offset-2"
                onClick={() => navigate(`/merchant/inventory/voucher/${definition.id}`)}>
                + Nhập thêm lượt
              </button>
            </div>
          ) : <span>{definition.availableQuantity ?? "—"} quà còn lại</span>}
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold " +
                (definition.isActive ? "bg-[#edf4e9] text-[#357044]" : "bg-[#fff3dd] text-[#97682a]")
              }
            >
              {definition.isActive ? "● Hoạt động" : "Đã tắt"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={statusBusy}
              aria-label={`${definition.isActive ? "Tắt" : "Bật"} voucher ${definition.title}`}
              onClick={() => {
                setStatusError("");
                setStatusDialogOpen(true);
              }}
            >
              {definition.isActive ? "Tắt" : "Bật"}
            </Button>
          </div>
        </td>
        <td className="px-4 py-4 text-right">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                ref={trigger}
                type="button"
                aria-label={"Thao tác voucher " + definition.title}
                className="inline-grid h-9 w-9 place-items-center rounded-full text-[#516357] hover:bg-[#edf3e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8eae91]"
              >
                <DotsThreeVertical size={20} weight="bold" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="surface z-50 min-w-48 rounded-2xl p-1.5 shadow-xl"
              >
                {isDiscount && (
                  <>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() => navigate(`/merchant/inventory/voucher/${definition.id}`)}
                    >
                      Điều chỉnh lượt phát hành
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() => navigate(`/merchant/inventory/voucher/${definition.id}?tab=history`)}
                    >
                      Lịch sử phát hành
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
                  </>
                )}
                {!isDiscount && definition.rewardProductId !== null && (
                  <>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() => navigate(`/merchant/inventory/reward/${definition.rewardProductId}`)}
                    >
                      Điều chỉnh số lượng quà
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      className={menuItem}
                      onSelect={() =>
                        navigate(`/merchant/inventory/reward/${definition.rewardProductId}?tab=history`)
                      }
                    >
                      Lịch sử số lượng quà
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#edf1ea]" />
                  </>
                )}
                <DropdownMenu.Item
                  className={menuItem}
                  disabled={statusBusy}
                  onSelect={() => setMode("edit")}
                >
                  <PencilSimple size={16} /> Chỉnh sửa voucher
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </td>
      </tr>
      <Dialog.Root
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) setMode(null);
        }}
      >
        {mode && (
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-[#14251b]/45 backdrop-blur-[2px]" />
            <Dialog.Content
              className="surface fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl p-6 shadow-2xl outline-none sm:p-7"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                trigger.current?.focus();
              }}
            >
              <Dialog.Title className="text-xl font-extrabold text-[#20392a]">
                {dialogTitles[mode]}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm muted">{definition.title}</Dialog.Description>
              <VoucherEditForm definition={definition} busy={dialogBusy} onSave={saveDefinition} />
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </Dialog.Root>
      <ConfirmActionDialog
        open={statusDialogOpen}
        onOpenChange={(open) => {
          if (!statusBusy) {
            setStatusDialogOpen(open);
            if (!open) setStatusError("");
          }
        }}
        title={definition.isActive ? "Tắt voucher?" : "Bật voucher?"}
        description={
          definition.isActive
            ? `Tạm dừng lượt đổi mới cho “${definition.title}”.`
            : `Cho phép thành viên đổi “${definition.title}” trở lại.`
        }
        confirmLabel={definition.isActive ? "Tắt voucher" : "Bật voucher"}
        busy={statusBusy}
        error={statusError}
        onConfirm={confirmToggleStatus}
      />
    </>
  );
}
