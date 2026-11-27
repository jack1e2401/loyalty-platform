import { useId, useMemo, useState } from "react";

export interface RevenuePlotDay {
  label: string;
  amount: number;
  orderCount?: number;
}

export type RevenueChartMode = "bar" | "area";

const vndFull = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });
const compactNumber = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 });

const svgWidth = 640;
const svgHeight = 232;
const padLeft = 56;
const padRight = 16;
const padTop = 20;
const padBottom = 32;
const plotWidth = svgWidth - padLeft - padRight;
const plotHeight = svgHeight - padTop - padBottom;

function buildSmoothAreaPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return { line: "", area: "" };
  if (points.length === 1) {
    const p = points[0]!;
    return {
      line: `M ${p.x} ${p.y}`,
      area: `M ${p.x} ${padTop + plotHeight} L ${p.x} ${p.y} L ${p.x} ${padTop + plotHeight} Z`,
    };
  }
  let line = `M ${points[0]!.x.toFixed(2)} ${points[0]!.y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i]!;
    const p1 = points[i + 1]!;
    const cx = ((p0.x + p1.x) / 2).toFixed(2);
    line += ` C ${cx} ${p0.y.toFixed(2)}, ${cx} ${p1.y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
  }
  const baseY = (padTop + plotHeight).toFixed(2);
  const firstX = points[0]!.x.toFixed(2);
  const lastX = points[points.length - 1]!.x.toFixed(2);
  const area = `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  return { line, area };
}

export default function MerchantRevenuePlot({
  days,
  mode = "bar",
}: {
  days: RevenuePlotDay[];
  mode?: RevenueChartMode;
}) {
  const gradId = useId().replace(/:/g, "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { maxVal, yTicks, points, xStep } = useMemo(() => {
    const rawMax = Math.max(0, ...days.map((d) => d.amount));
    const safeMax = rawMax === 0 ? 100_000 : Math.ceil(rawMax * 1.15);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: Math.round(safeMax * ratio),
      y: padTop + plotHeight - plotHeight * ratio,
    }));

    const slotWidth = days.length > 0 ? plotWidth / days.length : plotWidth;
    const pts = days.map((day, idx) => {
      const x =
        days.length === 1
          ? padLeft + plotWidth / 2
          : mode === "bar"
            ? padLeft + idx * slotWidth + slotWidth / 2
            : padLeft + (idx / Math.max(1, days.length - 1)) * plotWidth;
      const ratio = safeMax > 0 ? Math.max(0, day.amount) / safeMax : 0;
      const y = padTop + plotHeight - ratio * plotHeight;
      return { x, y, day, idx };
    });

    const step = days.length > 14 ? Math.ceil(days.length / 7) : days.length > 8 ? 2 : 1;
    return { maxVal: safeMax, yTicks: ticks, points: pts, xStep: step };
  }, [days, mode]);

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] ?? null : null;
  const barWidth = Math.min(36, Math.max(8, (plotWidth / Math.max(1, days.length)) * 0.54));
  const areaPaths = useMemo(() => buildSmoothAreaPath(points), [points]);

  if (days.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-xs text-[#607767]">
        Chưa có dữ liệu biểu đồ trong khoảng thời gian này.
      </div>
    );
  }

  return (
    <div className="relative select-none" onMouseLeave={() => setHoveredIndex(null)}>
      <style>{`
        @keyframes cmsBarRise {
          from { transform: scaleY(0); opacity: 0.4; }
          to { transform: scaleY(1); opacity: 1; }
        }
        @keyframes cmsLineFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Floating Tooltip */}
      {activePoint && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-[#2d4f38] bg-[#162a1e]/95 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-xs transition-all duration-150"
          style={{
            left: `${(activePoint.x / svgWidth) * 100}%`,
            top: `${Math.max(18, (activePoint.y / svgHeight) * 100 - 4)}%`,
          }}
        >
          <div className="font-semibold text-[#b8dfc2]">{activePoint.day.label}</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{vndFull.format(activePoint.day.amount)}</div>
          {activePoint.day.orderCount !== undefined && (
            <div className="mt-0.5 text-[11px] text-[#d2e4d6]">{activePoint.day.orderCount} đơn hàng</div>
          )}
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="h-56 w-full overflow-visible"
        role="img"
        aria-label="Biểu đồ doanh thu"
      >
        <defs>
          <linearGradient id={`${gradId}-bar`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#356b43" />
            <stop offset="100%" stopColor="#5e9c6e" />
          </linearGradient>
          <linearGradient id={`${gradId}-bar-hover`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#235030" />
            <stop offset="100%" stopColor="#3c7d4d" />
          </linearGradient>
          <linearGradient id={`${gradId}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#356b43" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#356b43" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines & Y Labels */}
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={padLeft}
              x2={svgWidth - padRight}
              y1={tick.y}
              y2={tick.y}
              stroke={tick.value === 0 ? "#d3ded2" : "#edf2eb"}
              strokeDasharray={tick.value === 0 ? undefined : "4 4"}
              strokeWidth={1}
            />
            <text
              x={padLeft - 8}
              y={tick.y + 3.5}
              textAnchor="end"
              className="fill-[#68776d] text-[10.5px] font-medium tabular-nums"
            >
              {compactNumber.format(tick.value)}
            </text>
          </g>
        ))}

        {/* Hover Vertical Guide */}
        {activePoint && (
          <line
            x1={activePoint.x}
            x2={activePoint.x}
            y1={padTop}
            y2={padTop + plotHeight}
            stroke="#a8cdb0"
            strokeDasharray="3 3"
            strokeWidth={1.2}
          />
        )}

        {/* Mode: Bar Chart */}
        {mode === "bar" &&
          points.map((pt) => {
            const barHeight = Math.max(pt.day.amount > 0 ? 4 : 0, padTop + plotHeight - pt.y);
            const isHovered = hoveredIndex === pt.idx;
            const slotW = plotWidth / Math.max(1, days.length);
            return (
              <g key={pt.idx} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(pt.idx)}>
                {/* Invisible hit box for smooth hovering */}
                <rect
                  x={pt.x - slotW / 2}
                  y={padTop}
                  width={slotW}
                  height={plotHeight}
                  fill={isHovered ? "rgba(53, 107, 67, 0.05)" : "transparent"}
                  rx={6}
                />
                {barHeight > 0 && (
                  <rect
                    x={pt.x - barWidth / 2}
                    y={padTop + plotHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(6, barWidth / 2)}
                    fill={isHovered ? `url(#${gradId}-bar-hover)` : `url(#${gradId}-bar)`}
                    style={{
                      transformOrigin: `${pt.x}px ${padTop + plotHeight}px`,
                      animation: `cmsBarRise 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(pt.idx * 22, 300)}ms both`,
                      transition: "fill 150ms ease, filter 150ms ease",
                    }}
                  />
                )}
              </g>
            );
          })}

        {/* Mode: Area / Line Chart */}
        {mode === "area" && (
          <g style={{ animation: "cmsLineFade 0.45s ease-out both" }}>
            <path d={areaPaths.area} fill={`url(#${gradId}-area)`} />
            <path
              d={areaPaths.line}
              fill="none"
              stroke="#356b43"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((pt) => {
              const isHovered = hoveredIndex === pt.idx;
              const hitW = plotWidth / Math.max(1, days.length);
              return (
                <g key={pt.idx} className="cursor-pointer" onMouseEnter={() => setHoveredIndex(pt.idx)}>
                  <rect
                    x={pt.x - hitW / 2}
                    y={padTop}
                    width={hitW}
                    height={plotHeight}
                    fill="transparent"
                  />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5.5 : 3}
                    fill={isHovered ? "#20392a" : "#ffffff"}
                    stroke="#356b43"
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all duration-150"
                    style={{ opacity: isHovered || maxVal > 0 ? 1 : 0 }}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* X Axis Labels */}
        {points.map((pt) => {
          const showLabel = (days.length - 1 - pt.idx) % xStep === 0;
          if (!showLabel) return null;
          return (
            <text
              key={pt.idx}
              x={pt.x}
              y={svgHeight - 8}
              textAnchor="middle"
              className={`text-[10.5px] transition-colors ${
                hoveredIndex === pt.idx ? "fill-[#20392a] font-bold" : "fill-[#68776d] font-medium"
              }`}
            >
              {pt.day.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
