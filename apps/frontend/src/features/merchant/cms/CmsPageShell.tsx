import type { ReactNode } from "react";
import { Flex, Spin } from "antd";
import type { BreadcrumbProps } from "antd";
import { CmsPageHeader } from "./CmsPageHeader";
import { ErrorState } from "../../../components/ui";

export type CmsPageShellProps = {
  title?: string;
  description?: ReactNode;
  breadcrumbs?: BreadcrumbProps["items"];
  action?: ReactNode;
  header?: ReactNode;
  stats?: ReactNode;
  filters?: ReactNode;
  loading?: boolean;
  error?: string | null;
  retry?: () => void;
  className?: string;
  children?: ReactNode;
};

export function CmsPageShell({
  title,
  description,
  breadcrumbs,
  action,
  header,
  stats,
  filters,
  loading = false,
  error,
  retry,
  className = "w-full min-w-0 space-y-6",
  children,
}: CmsPageShellProps) {
  return (
    <div className={className}>
      {/* 1. Header Area */}
      {header ?? (title ? (
        <CmsPageHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          action={action}
        />
      ) : null)}

      {/* 2. Stats / KPIs Slot */}
      {stats ? <div className="min-w-0">{stats}</div> : null}

      {/* 3. Filters / Action Bar Slot */}
      {filters ? <div className="min-w-0">{filters}</div> : null}

      {/* 4. Main Body: Loading / Error / Content */}
      {loading ? (
        <Flex justify="center" align="center" className="py-16">
          <Spin size="large" description="Đang tải dữ liệu..." />
        </Flex>
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : (
        children
      )}
    </div>
  );
}
