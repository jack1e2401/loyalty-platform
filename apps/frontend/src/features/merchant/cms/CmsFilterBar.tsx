import type { ReactNode } from "react";
import { Flex } from "antd";

export function CmsFilterBar({
  label = "Bộ lọc",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={`rounded-xl border border-[#e3e9e2] bg-white p-4 shadow-[0_1px_3px_rgba(32,57,42,0.04)] ${className ?? "mb-5"}`}
    >
      <Flex align="end" gap={12} wrap className="w-full">
        {children}
      </Flex>
    </section>
  );
}
