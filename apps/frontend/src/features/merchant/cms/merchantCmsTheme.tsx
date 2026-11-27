import type { ReactNode } from "react";
import { ConfigProvider, theme } from "antd";

export const merchantCmsTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: "#356b43",
    colorInfo: "#356b43",
    colorSuccess: "#28734d",
    colorWarning: "#97682a",
    colorError: "#a4473a",
    colorText: "#26352f",
    colorTextSecondary: "#68776d",
    colorBgLayout: "#f7f8f4",
    colorBgContainer: "#ffffff",
    colorBorder: "#e3e9e2",
    borderRadius: 8,
    controlHeight: 32,
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    fontSize: 13,
  },
  components: {
    Button: { fontWeight: 600, borderRadius: 8, controlHeight: 32 },
    Card: { bodyPadding: 14, borderRadiusLG: 10 },
    Table: {
      headerBg: "#edf3ee",
      headerColor: "#20392a",
      rowHoverBg: "#f4f9f4",
      borderColor: "#e3e9e2",
      headerSplitColor: "transparent",
      cellPaddingBlockMD: 8,
      cellPaddingInlineMD: 12,
    },
    Input: { borderRadius: 8, controlHeight: 32 },
    Select: { borderRadius: 8, controlHeight: 32 },
  },
};

export function MerchantCmsProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  if (!enabled) return children;
  return (
    <ConfigProvider theme={merchantCmsTheme}>
      <div className="merchant-cms min-h-full">{children}</div>
    </ConfigProvider>
  );
}
