import type { StorefrontOpeningHoursDay, StorefrontWeekday } from "../../api/storefront-types";
import { Button, Input } from "../../components/ui";

const WEEKDAYS: { day: StorefrontWeekday; label: string }[] = [
  { day: 1, label: "Thứ 2" },
  { day: 2, label: "Thứ 3" },
  { day: 3, label: "Thứ 4" },
  { day: 4, label: "Thứ 5" },
  { day: 5, label: "Thứ 6" },
  { day: 6, label: "Thứ 7" },
  { day: 7, label: "Chủ nhật" },
];

export function StorefrontOpeningHoursEditor({
  value,
  onChange,
}: {
  value: StorefrontOpeningHoursDay[] | null;
  onChange: (value: StorefrontOpeningHoursDay[] | null) => void;
}) {
  function startSchedule() {
    onChange(WEEKDAYS.map(({ day }) => ({ day, closed: false, openTime: null, closeTime: null })));
  }

  function updateDay(day: number, patch: Partial<StorefrontOpeningHoursDay>) {
    onChange(value?.map((item) => (item.day === day ? { ...item, ...patch } : item)) ?? null);
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[#e5ece3] bg-[#fcfdf9] p-4" aria-labelledby="opening-hours-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 id="opening-hours-title" className="font-bold text-[#24452f]">Giờ mở cửa</h3>
          <p className="mt-1 text-xs muted">Nhập giờ cho ngày mở cửa hoặc đánh dấu ngày nghỉ.</p>
        </div>
        {value ? (
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(null)}>
            Xóa lịch
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={startSchedule}>
            Thiết lập giờ
          </Button>
        )}
      </div>
      {value && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-72 text-left text-sm">
            <thead>
              <tr className="text-[#53685a]">
                <th scope="col" className="py-2">Ngày</th>
                <th scope="col" className="px-1">Giờ mở</th>
                <th scope="col" className="px-1">Giờ đóng</th>
                <th scope="col" className="px-1 text-center">Nghỉ</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map(({ day, label }) => {
                const schedule = value.find((item) => item.day === day);
                if (!schedule) return null;
                return (
                  <tr key={day} className="border-t border-[#e8eee6]">
                    <th scope="row" className="whitespace-nowrap py-2 font-semibold">{label}</th>
                    <td className="px-1">
                      <Input type="time" aria-label={`Mở cửa ${label}`} disabled={schedule.closed} value={schedule.openTime ?? ""}
                        onChange={(event) => updateDay(day, { openTime: event.target.value || null })} />
                    </td>
                    <td className="px-1">
                      <Input type="time" aria-label={`Đóng cửa ${label}`} disabled={schedule.closed} value={schedule.closeTime ?? ""}
                        onChange={(event) => updateDay(day, { closeTime: event.target.value || null })} />
                    </td>
                    <td className="px-1 text-center">
                      <input type="checkbox" className="size-4 accent-[#335e3d]" aria-label={`Nghỉ ${label}`}
                        checked={schedule.closed}
                        onChange={(event) => updateDay(day, { closed: event.target.checked, openTime: null, closeTime: null })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
