import { Button } from "../../../components/ui";

type Props = {
  page: number;
  limit: number;
  totalItems: number;
  onChange: (page: number, limit: number) => void;
};

export function MerchantPagination({ page, limit, totalItems, onChange }: Props) {
  const totalPages = Math.ceil(totalItems / limit);
  const hasRows = (page - 1) * limit < totalItems;
  const first = hasRows ? (page - 1) * limit + 1 : 0;
  const last = hasRows ? Math.min(page * limit, totalItems) : 0;
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);

  return (
    <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
      <span className="text-sm text-[#53685a]">{first}–{last} / {totalItems}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1}
          onClick={() => onChange(page - 1, limit)}>Trước</Button>
        {pages.map((value, index) => (
          <span key={value} className="flex items-center gap-1">
            {index > 0 && value - pages[index - 1] > 1 && <span aria-hidden="true">…</span>}
            <Button type="button" size="sm" variant={value === page ? "default" : "outline"}
              aria-label={`Trang ${value}`} aria-current={value === page ? "page" : undefined}
              onClick={() => onChange(value, limit)}>{value}</Button>
          </span>
        ))}
        <Button type="button" size="sm" variant="outline" disabled={page >= totalPages}
          onClick={() => onChange(page + 1, limit)}>Sau</Button>
        <label className="ml-2 flex items-center gap-2 text-sm">
          <span className="sr-only">Số dòng mỗi trang</span>
          <select aria-label="Số dòng mỗi trang" value={limit} className="rounded-lg border border-[#dbe3d9] bg-white p-2"
            onChange={(event) => onChange(1, Number(event.target.value))}>
            {[10, 20, 50].map((size) => <option key={size} value={size}>{size} / trang</option>)}
          </select>
        </label>
      </div>
    </nav>
  );
}
