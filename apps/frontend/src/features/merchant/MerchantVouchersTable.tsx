import type { VoucherDefinitionDto } from "../../api/commerce-types";
import { MerchantVoucherTableRow } from "./MerchantVoucherTableRow";

type Props = {
  definitions: VoucherDefinitionDto[];
  token: string;
  busyId: number | null;
  onToggle: (definition: VoucherDefinitionDto) => Promise<void>;
  onDefinitionChange: (definition: VoucherDefinitionDto) => void;
};

export function MerchantVouchersTable({ definitions, token, busyId, onToggle, onDefinitionChange }: Props) {
  return (
    <div className="surface -mt-px overflow-x-auto rounded-b-2xl border-t-0">
      <table
        aria-label="Danh sách voucher"
        className="w-full min-w-[760px] table-fixed border-collapse text-left"
      >
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[13%]" />
          <col className="w-[12%]" />
          <col className="w-[23%]" />
          <col className="w-[16%]" />
          <col className="w-[8%]" />
        </colgroup>
        <thead className="bg-[#edf3ee] text-xs font-bold uppercase tracking-wide text-[#344b3b]">
          <tr>
            <th scope="col" className="px-5 py-4">
              Tên voucher
            </th>
            <th scope="col" className="px-4 py-4">
              Loại
            </th>
            <th scope="col" className="px-4 py-4">
              Điểm đổi
            </th>
            <th scope="col" className="px-4 py-4">
              Tồn kho / Đã đổi
            </th>
            <th scope="col" className="px-4 py-4">
              Trạng thái
            </th>
            <th scope="col" className="px-4 py-4">
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {definitions.map((definition) => (
            <MerchantVoucherTableRow
              key={definition.id}
              definition={definition}
              token={token}
              statusBusy={busyId !== null}
              onToggle={() => onToggle(definition)}
              onDefinitionChange={onDefinitionChange}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
