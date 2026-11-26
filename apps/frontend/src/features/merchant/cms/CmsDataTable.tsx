import type { ReactNode } from "react";
import { Empty, Table, type TableProps } from "antd";

type CmsDataTableProps<T extends object> = Omit<
  TableProps<T>,
  "dataSource" | "loading" | "locale"
> & {
  label: string;
  rows: T[];
  loading?: boolean;
  emptyText?: ReactNode;
  containerClassName?: string;
};

export function CmsDataTable<T extends object>({
  label,
  rows,
  loading = false,
  emptyText,
  pagination,
  scroll = { x: "max-content" },
  containerClassName,
  className,
  ...tableProps
}: CmsDataTableProps<T>) {
  return (
    <div
      className={
        containerClassName ??
        "min-w-0 overflow-hidden rounded-xl border border-[#e3e9e2] bg-white shadow-[0_1px_3px_rgba(32,57,42,0.04)]"
      }
    >
      <Table<T>
        {...tableProps}
        className={className}
        aria-label={label}
        dataSource={rows}
        loading={loading}
        locale={{
          emptyText:
            emptyText ?? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Không có dữ liệu"
              />
            ),
        }}
        pagination={pagination ?? false}
        scroll={scroll}
        size="middle"
      />
    </div>
  );
}
