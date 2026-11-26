import type { SVGProps } from "react";

type LogoVariant = "full" | "symbol" | "wordmark";
type LogoTheme = "dark" | "light";

interface HikariLogoProps extends SVGProps<SVGSVGElement> {
  variant?: LogoVariant;
  theme?: LogoTheme;
  className?: string;
  size?: number | string;
}

/**
 * Hikari Coffee Brand Symbol:
 * Minimalist geometric mark combining "Hikari" (Light / Sun ray) with a specialty coffee cup profile.
 * Clean, craft-focused vector geometry built for 16px to 512px crisp display.
 */
export function HikariSymbol({
  size = 32,
  theme = "dark",
  className,
  ...props
}: {
  size?: number | string;
  theme?: LogoTheme;
  className?: string;
} & SVGProps<SVGSVGElement>) {
  const isDark = theme === "dark";
  const sunColor = isDark ? "#fcd34d" : "#d97706";
  const cupColor = isDark ? "#ffffff" : "#292524";
  const steamColor = isDark ? "#c7ec9f" : "#44403c";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Hikari Coffee Symbol"
      {...props}
    >
      <rect
        width="32"
        height="32"
        rx="8"
        fill={isDark ? "rgba(255,255,255,0.08)" : "rgba(41,37,36,0.06)"}
      />
      <circle cx="16" cy="11" r="4.5" fill={sunColor} />
      <path
        d="M9 15H23V19C23 21.7614 20.7614 24 18 24H14C11.2386 24 9 21.7614 9 19V15Z"
        fill={cupColor}
      />
      <path
        d="M23 16.5H24.5C25.3284 16.5 26 17.1716 26 18C26 18.8284 25.3284 19.5 24.5 19.5H23V16.5Z"
        stroke={cupColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="10" y="25.5" width="12" height="1.5" rx="0.75" fill={steamColor} />
    </svg>
  );
}

export function HikariLogo({
  variant = "full",
  theme = "dark",
  size = 32,
  className,
  ...props
}: HikariLogoProps) {
  const isDark = theme === "dark";
  const textColor = isDark ? "text-white" : "text-[#1c1917]";
  const subColor = isDark ? "text-[#fcd34d]" : "text-[#b45309]";

  if (variant === "symbol") {
    return <HikariSymbol size={size} theme={theme} className={className} {...props} />;
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      {variant === "full" && <HikariSymbol size={size} theme={theme} {...props} />}
      <div className="flex flex-col leading-none select-none">
        <span className={`text-[17px] font-bold tracking-tight ${textColor}`}>
          Hikari
        </span>
        <span className={`text-[10px] font-medium tracking-widest uppercase ${subColor}`}>
          Coffee
        </span>
      </div>
    </div>
  );
}
