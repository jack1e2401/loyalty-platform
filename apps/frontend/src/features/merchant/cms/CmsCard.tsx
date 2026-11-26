import type { ReactNode } from "react";
import { Card, Typography, type CardProps } from "antd";

export type CmsCardProps = Omit<CardProps, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

export function CmsCard({
  title,
  description,
  extra,
  children,
  variant = "outlined",
  className = "",
  ...rest
}: CmsCardProps) {
  const cardTitle =
    title && typeof title === "string" ? (
      <div className="py-1">
        <Typography.Text strong className="text-base text-[#20392a]">
          {title}
        </Typography.Text>
        {description ? (
          <Typography.Paragraph type="secondary" className="!mb-0 !mt-0.5 text-xs">
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
    ) : (
      title
    );

  return (
    <Card
      title={cardTitle}
      extra={extra}
      variant={variant}
      className={`rounded-xl border-[#e3e9e2] shadow-[0_1px_3px_rgba(32,57,42,0.04)] ${className}`}
      {...rest}
    >
      {children}
    </Card>
  );
}
