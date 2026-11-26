import { MagnifyingGlass } from "@phosphor-icons/react";

type VoucherType = "" | "DISCOUNT" | "REWARD";
type VoucherStatus = "" | "active" | "inactive";
type VoucherSort = "newest" | "name" | "points";

type Props = {
  counts?: { all: number; discount: number; reward: number };
  type: VoucherType;
  q: string;
  status: VoucherStatus;
  sort: VoucherSort;
  onType(value: VoucherType): void;
  onQuery(value: string): void;
  onStatus(value: VoucherStatus): void;
  onSort(value: VoucherSort): void;
};

export function VoucherListFilters({ counts, type, q, status, sort, onType, onQuery, onStatus, onSort }: Props) {
  const tabs: { value: VoucherType; label: string; count: number | undefined }[] = [
    { value: "", label: "Tất cả", count: counts?.all },
    { value: "DISCOUNT", label: "Giảm giá", count: counts?.discount },
    { value: "REWARD", label: "Quà tặng", count: counts?.reward },
  ];
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Loại voucher" className="flex gap-5 overflow-x-auto border-b border-[#e3e9e1]">
        {tabs.map((tab) => (
          <button key={tab.value} type="button" role="tab" aria-selected={type === tab.value}
            onClick={() => onType(tab.value)}
            className={`whitespace-nowrap border-b-2 px-1 pb-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#6b9270] ${type === tab.value ? "border-[#315e3c] text-[#315e3c]" : "border-transparent text-[#718075]"}`}>
            {tab.label} {tab.count !== undefined && `(${tab.count})`}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border,#e3e9e1)] bg-white p-4 shadow-sm">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-[var(--color-border,#dbe3d9)] bg-white px-3 focus-within:border-[var(--color-brand,#315e3c)]">
          <MagnifyingGlass aria-hidden="true" size={18} className="text-[#718075]" />
          <span className="sr-only">Tìm kiếm tên voucher</span>
          <input value={q} onChange={(event) => onQuery(event.target.value)} maxLength={191}
            placeholder="Tìm kiếm tên voucher..." className="min-h-9 w-full bg-transparent text-sm outline-none" />
        </label>
        <select aria-label="Trạng thái" value={status} onChange={(event) => onStatus(event.target.value as VoucherStatus)}
          className="min-h-9 rounded-lg border border-[var(--color-border,#dbe3d9)] bg-white px-3 text-sm text-[var(--color-ink,#20392a)]">
          <option value="">Trạng thái: Tất cả</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã tắt</option>
        </select>
        <select aria-label="Sắp xếp" value={sort} onChange={(event) => onSort(event.target.value as VoucherSort)}
          className="min-h-9 rounded-lg border border-[var(--color-border,#dbe3d9)] bg-white px-3 text-sm text-[var(--color-ink,#20392a)]">
          <option value="newest">Mới nhất</option>
          <option value="name">Tên A–Z</option>
          <option value="points">Điểm đổi tăng dần</option>
        </select>
      </div>
    </div>
  );
}
