"use client";

/**
 * 车间大屏的手写 SVG 图形：
 * - DualAxisChart：近 7 天 柱（左轴）+ 线（右轴）双轴图（07 §1.2 工单产出趋势、不良品趋势）。两轴都从 0 起、
 *   刻度等分共用网格线；图例常显；柱顶标注非零值、线标注最新点；悬停出现十字带与两个系列的数值。
 * - ProgressRingChain：工序进度圆环链（02 §1.2）：每道工序一个百分比圆环、环下工序名、环间短线，100% 为绿色。
 * 尺寸按容器实际像素绘制（useElementSize），不做整体缩放。
 */
import { useEffect, useId, useRef, useState } from "react";
import { useElementSize } from "@/lib/component-kit/use-element-size";
import { BOARD, niceMax, ringDash, ringSlot, roundedBarPath, tickText, ticks, uText } from "@/components/charts/board-theme";

export interface DualAxisPoint {
  key: string;
  label: string;
  bar: number;
  line: number | null;
}

export interface DualAxisSeries {
  name: string;
  /** 轴标题里的单位，如「张」「件」「%」。 */
  unit: string;
  color: string;
  format: (value: number) => string;
  integer?: boolean;
  /** 刻度后缀（百分比轴写 %）。 */
  tickSuffix?: string;
}

export interface DualAxisChartProps {
  points: readonly DualAxisPoint[];
  bar: DualAxisSeries;
  line: DualAxisSeries;
  title: string;
  /** board = dark console; card = light workspace (fig.4 navy/amber). */
  surface?: "board" | "card";
}

const INTERVALS = 4;

const CARD_INK_LIGHT = {
  axis: "#e8e8e8",
  grid: "#f4f4f5",
  ink: "#050b14",
  ink2: "#242424",
  ink3: "#878787",
  surface: "#ffffff",
  raised: "#ffffff",
  border: "#dcdcdc",
} as const;

const CARD_INK_DARK = {
  axis: "#2e2f33",
  grid: "#1a1b1e",
  ink: "#f4f4f5",
  ink2: "#d4d4d8",
  ink3: "#a1a1aa",
  surface: "#141518",
  raised: "#1a1b1e",
  border: "#2e2f33",
} as const;

function useHtmlDark() {
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false,
  );
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setDark(root.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function DualAxisChart({
  points,
  bar,
  line,
  title,
  surface = "board",
}: DualAxisChartProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(plotRef);
  const [hovered, setHovered] = useState<number | null>(null);
  const titleId = useId();
  const htmlDark = useHtmlDark();
  const light = surface === "card";
  const ink = light
    ? htmlDark
      ? CARD_INK_DARK
      : CARD_INK_LIGHT
    : {
        axis: BOARD.axis,
        grid: BOARD.line,
        ink: BOARD.ink,
        ink2: BOARD.ink2,
        ink3: BOARD.ink3,
        surface: BOARD.surface,
        raised: BOARD.surfaceRaised,
        border: BOARD.axis,
      };

  const { width, height } = size;
  const font = Math.max(11, Math.min(16, Math.round(Math.min(width / 30, height / 11))));
  const margin = { top: font + 10, right: font * 3, bottom: font + 12, left: font * 3 };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, height - margin.top - margin.bottom);
  const barMax = niceMax(Math.max(0, ...points.map((point) => point.bar)), INTERVALS, bar.integer);
  const lineMax = niceMax(Math.max(0, ...points.map((point) => point.line ?? 0)), INTERVALS, line.integer);
  const band = points.length ? plotWidth / points.length : 0;
  const barWidth = Math.max(4, Math.min(28, band * 0.48));
  const yBar = (value: number) => margin.top + plotHeight - (value / barMax) * plotHeight;
  const yLine = (value: number) => margin.top + plotHeight - (value / lineMax) * plotHeight;
  const xCenter = (index: number) => margin.left + band * index + band / 2;

  const linePoints = points
    .map((point, index) => (point.line === null ? null : { x: xCenter(index), y: yLine(point.line), index }))
    .filter((point): point is { x: number; y: number; index: number } => point !== null);
  const lastLine = linePoints[linePoints.length - 1];
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  // 线末端数值标签：与同一天柱顶数值重叠时抬到两者之上（放不下就放到点下方）。
  let lastLineLabelY = lastLine ? lastLine.y - 9 : 0;
  if (lastLine) {
    const lastBar = points[lastLine.index].bar;
    if (lastBar > 0) {
      const barLabelY = yBar(lastBar) - 5;
      if (Math.abs(barLabelY - lastLineLabelY) < font + 2) {
        lastLineLabelY = Math.min(barLabelY, lastLine.y) - font - 3;
      }
    }
    if (lastLineLabelY < font) lastLineLabelY = lastLine.y + font + 6;
  }
  const lastLineLabelOnBar =
    lastLine !== undefined &&
    points[lastLine.index].bar > 0 &&
    lastLineLabelY - font * 0.75 >= yBar(points[lastLine.index].bar);

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ gap: 4 }}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1" style={{ fontSize: light ? 12 : uText(13), color: ink.ink2 }}>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block size-2.5 rounded-[2px]" style={{ background: bar.color }} />
          {bar.name}（{bar.unit}，左轴）
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="18" height="10" viewBox="0 0 18 10">
            <line x1="1" y1="5" x2="17" y2="5" stroke={line.color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="5" r="3" fill="#ffffff" stroke={line.color} strokeWidth="2" />
          </svg>
          {line.name}（{line.unit}，右轴）
        </span>
      </div>
      <div ref={plotRef} className="relative min-h-0 flex-1">
        {width > 0 && height > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-labelledby={titleId}
            className="block overflow-visible"
            onPointerLeave={() => setHovered(null)}
          >
            <title id={titleId}>
              {`${title}：${points
                .map((point) => `${point.label} ${bar.name}${bar.format(point.bar)}、${line.name}${point.line === null ? "-" : line.format(point.line)}`)
                .join("；")}`}
            </title>
            {ticks(barMax, INTERVALS).map((value, index) => {
              const y = yBar(value);
              const lineValue = (lineMax / INTERVALS) * index;
              return (
                <g key={`tick-${index}`}>
                  <line
                    x1={margin.left}
                    x2={margin.left + plotWidth}
                    y1={y}
                    y2={y}
                    stroke={index === 0 ? ink.axis : ink.grid}
                    strokeWidth={1}
                  />
                  <text x={margin.left - 6} y={y} dy="0.32em" textAnchor="end" fontSize={font - 1} fill={ink.ink3} className="tabular-nums">
                    {tickText(value, bar.tickSuffix)}
                  </text>
                  <text
                    x={margin.left + plotWidth + 6}
                    y={y}
                    dy="0.32em"
                    textAnchor="start"
                    fontSize={font - 1}
                    fill={ink.ink3}
                    className="tabular-nums"
                  >
                    {tickText(lineValue, line.tickSuffix)}
                  </text>
                </g>
              );
            })}
            {hovered !== null ? (
              <rect x={margin.left + band * hovered} y={margin.top} width={band} height={plotHeight} fill={ink.ink} opacity={0.06} rx={4} />
            ) : null}
            {points.map((point, index) => {
              const barHeight = plotHeight * (point.bar / barMax);
              const x = xCenter(index) - barWidth / 2;
              const y = margin.top + plotHeight - barHeight;
              // 柱顶数值与同一天的线点重叠时：柱够高就放进柱内（深色字），否则只留在悬停提示里。
              const lineY = point.line === null ? null : yLine(point.line);
              const capCollides = lineY !== null && Math.abs(y - 5 - font / 2 - lineY) < font;
              const labelInside = capCollides && barHeight > font + 8;
              const showCapLabel = point.bar > 0 && (!capCollides || labelInside);
              return (
                <g key={point.key}>
                  {barHeight > 0 ? <path d={roundedBarPath(x, y, barWidth, barHeight)} fill={bar.color} /> : null}
                  {showCapLabel ? (
                    <text
                      x={xCenter(index)}
                      y={labelInside ? y + font + 1 : y - 5}
                      textAnchor="middle"
                      fontSize={font - 1}
                      fontWeight={labelInside ? 600 : undefined}
                      fill={labelInside ? inkOnFill(bar.color) : ink.ink2}
                      className="tabular-nums"
                    >
                      {bar.format(point.bar)}
                    </text>
                  ) : null}
                  <text x={xCenter(index)} y={margin.top + plotHeight + font + 4} textAnchor="middle" fontSize={font - 1} fill={ink.ink3}>
                    {point.label}
                  </text>
                </g>
              );
            })}
            {linePoints.length > 1 ? (
              <>
                {light ? (
                  <>
                    <defs>
                      <linearGradient id={`${titleId}-area`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={line.color} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={line.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <path
                      d={[
                        `M${linePoints[0].x},${margin.top + plotHeight}`,
                        ...linePoints.map((point) => `L${point.x},${point.y}`),
                        `L${linePoints[linePoints.length - 1].x},${margin.top + plotHeight}`,
                        "Z",
                      ].join(" ")}
                      fill={`url(#${titleId}-area)`}
                    />
                  </>
                ) : null}
                <polyline
                  points={linePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.25}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : null}
            {linePoints.map((point) => (
              <circle
                key={`dot-${point.index}`}
                cx={point.x}
                cy={point.y}
                r={hovered === point.index ? 5 : 3.5}
                fill="#ffffff"
                stroke={line.color}
                strokeWidth={2}
                className="transition-[r] duration-150 ease-out motion-reduce:transition-none"
              />
            ))}
            {lastLine && hovered === null ? (
              <text
                x={lastLine.x}
                y={lastLineLabelY}
                textAnchor="middle"
                fontSize={font - 1}
                fontWeight={600}
                fill={lastLineLabelOnBar ? inkOnFill(bar.color) : ink.ink}
                className="tabular-nums"
              >
                {line.format(points[lastLine.index].line ?? 0)}
              </text>
            ) : null}
            {points.map((point, index) => (
              <rect
                key={`hit-${point.key}`}
                x={margin.left + band * index}
                y={0}
                width={band}
                height={height}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${point.label} ${bar.name} ${bar.format(point.bar)}，${line.name} ${point.line === null ? "-" : line.format(point.line)}`}
                onPointerEnter={() => setHovered(index)}
                onPointerMove={() => setHovered(index)}
                onFocus={() => setHovered(index)}
                onBlur={() => setHovered(null)}
                className="outline-none"
              />
            ))}
          </svg>
        ) : null}
        {hoveredPoint && hovered !== null && width > 0 ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 min-w-28 rounded-[4px] border px-2.5 py-2 shadow-lg"
            style={{
              left: Math.min(Math.max(4, xCenter(hovered) - 60), Math.max(4, width - 132)),
              top: 4,
              background: ink.raised,
              borderColor: ink.border,
              fontSize: font,
            }}
          >
            <div style={{ color: ink.ink2 }}>{hoveredPoint.label}</div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5" style={{ color: ink.ink2 }}>
                <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: bar.color }} />
                {bar.name}
              </span>
              <span className="font-semibold tabular-nums" style={{ color: ink.ink }}>
                {bar.format(hoveredPoint.bar)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5" style={{ color: ink.ink2 }}>
                <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: line.color }} />
                {line.name}
              </span>
              <span className="font-semibold tabular-nums" style={{ color: ink.ink }}>
                {hoveredPoint.line === null ? "-" : line.format(hoveredPoint.line)}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export interface RingTask {
  id: string;
  processName: string;
  progress: number;
}

export interface ProgressRingChainProps {
  tasks: readonly RingTask[];
  /** 圆环直径（px）。 */
  ringSize: number;
  /** 所在列宽（px）；链比列宽长时右侧渐隐提示可横向滚动。 */
  availableWidth: number;
}

function ProgressRing({ task, size }: { task: RingTask; size: number }) {
  const stroke = Math.max(2, Math.round(size / 9));
  const radius = (size - stroke) / 2;
  const { circumference, offset } = ringDash(radius, task.progress);
  const done = task.progress >= 100;
  const color = done ? BOARD.good : BOARD.seriesBlue;
  const percent = Math.round(Math.min(100, Math.max(0, task.progress)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={BOARD.axis} strokeWidth={stroke} />
      {task.progress > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ) : null}
      <text
        x="50%"
        y="50%"
        dy="0.34em"
        textAnchor="middle"
        fontSize={Math.max(9, Math.round(size * 0.34))}
        fill={percent > 0 ? BOARD.ink : BOARD.ink3}
        className="tabular-nums"
      >
        {percent}
      </text>
    </svg>
  );
}

export function ProgressRingChain({ tasks, ringSize, availableWidth }: ProgressRingChainProps) {
  if (tasks.length === 0) {
    return <span style={{ color: BOARD.ink3 }}>未配置工序</span>;
  }
  const { nameFont, slot, connector } = ringSlot(ringSize);
  const summary = tasks.map((task) => `${task.processName} ${Math.round(task.progress)}%`).join("，");
  const overflowing = availableWidth > 0 && tasks.length * slot - connector > availableWidth;
  return (
    <div
      role="img"
      aria-label={summary}
      title={summary}
      className="scrollbar-none flex min-w-0 items-start overflow-x-auto overscroll-x-contain"
      style={
        overflowing
          ? { maskImage: "linear-gradient(90deg, #000 85%, transparent)", WebkitMaskImage: "linear-gradient(90deg, #000 85%, transparent)" }
          : undefined
      }
    >
      {tasks.map((task, index) => (
        <div key={task.id} className="flex shrink-0 items-start">
          {index > 0 ? (
            <span aria-hidden="true" className="block" style={{ width: connector, height: 1, marginTop: ringSize / 2, background: BOARD.axis }} />
          ) : null}
          <div className="flex flex-col items-center" style={{ width: slot - connector }}>
            <ProgressRing task={task} size={ringSize} />
            <span
              className="mt-0.5 block max-w-full truncate text-center leading-tight"
              title={`${task.processName} ${Math.round(task.progress)}%`}
              style={{ fontSize: nameFont, color: BOARD.ink2 }}
            >
              {task.processName}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Ink for text drawn ON a filled shape: dark on light fills (lime, yellow),
 * white on dark ones. Non-hex fills (CSS variables) fall back to dark ink, the
 * readable choice on the scaffold's lime / tinted bars.
 */
export function inkOnFill(fill: string): string {
  const hex = fill.trim().replace(/^#/, "");
  const full = /^[0-9a-f]{3}$/i.test(hex) ? hex.split("").map((c) => c + c).join("") : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#050b14";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Pick whichever ink has the higher contrast ratio against the fill.
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#050b14" : "#ffffff";
}

/** Chart series: lime / Tier0 blue / neutral tertiary (not cool slate fills). */
export const STACKED_PALETTE = ["#73b200", "#1d4ed8", "#7c3aed"] as const;

export interface StackedUsageSeries {
  key: string;
  name: string;
  color: string;
}

export interface StackedUsagePoint {
  key: string;
  label: string;
  values: Record<string, number>;
}

export interface StackedUsageChartProps {
  points: readonly StackedUsagePoint[];
  series: readonly StackedUsageSeries[];
  title: string;
  height?: number;
}

export function StackedUsageChart({
  points,
  series,
  title,
  height = 280,
}: StackedUsageChartProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const size = useElementSize(plotRef);
  const [hovered, setHovered] = useState<number | null>(null);
  const titleId = useId();
  const htmlDark = useHtmlDark();
  const grid = htmlDark ? "#2e2f33" : "#e8e8e8";
  const axis = htmlDark ? "#2e2f33" : "#dcdcdc";
  const label = htmlDark ? "#a1a1aa" : "#878787";
  const { width } = size;
  const chartH = height;
  const font = 12;
  const margin = { top: 12, right: 12, bottom: 28, left: 36 };
  const plotWidth = Math.max(0, width - margin.left - margin.right);
  const plotHeight = Math.max(0, chartH - margin.top - margin.bottom);
  const totals = points.map((p) => series.reduce((s, ser) => s + (p.values[ser.key] ?? 0), 0));
  const yMax = niceMax(Math.max(0, ...totals), INTERVALS, false);
  const band = points.length ? plotWidth / points.length : 0;
  const barWidth = Math.max(6, Math.min(28, band * 0.55));
  const y = (value: number) => margin.top + plotHeight - (value / yMax) * plotHeight;
  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const hoveredTotal = hovered !== null ? totals[hovered] : 0;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div ref={plotRef} className="relative w-full" style={{ height: chartH }}>
        {width > 0 ? (
          <svg
            width={width}
            height={chartH}
            role="img"
            aria-labelledby={titleId}
            className="block overflow-visible"
            onPointerLeave={() => setHovered(null)}
          >
            <title id={titleId}>{title}</title>
            {ticks(yMax, INTERVALS).map((value, index) => {
              const yy = y(value);
              return (
                <g key={`g-${index}`}>
                  <line
                    x1={margin.left}
                    x2={margin.left + plotWidth}
                    y1={yy}
                    y2={yy}
                    stroke={index === 0 ? axis : grid}
                    strokeWidth={1}
                  />
                  <text
                    x={margin.left - 6}
                    y={yy}
                    dy="0.32em"
                    textAnchor="end"
                    fontSize={font - 1}
                    fill={label}
                    className="tabular-nums"
                  >
                    {tickText(value)}
                  </text>
                </g>
              );
            })}
            {points.map((point, index) => {
              const x = margin.left + band * index + band / 2 - barWidth / 2;
              let stacked = 0;
              const segments = series
                .map((ser) => {
                  const value = point.values[ser.key] ?? 0;
                  const h = (value / yMax) * plotHeight;
                  const top = y(stacked + value);
                  stacked += value;
                  return { ser, value, h, top };
                })
                .filter((s) => s.h > 0);
              return (
                <g key={point.key}>
                  {segments.map((seg, segIndex) => {
                    const isTop = segIndex === segments.length - 1;
                    return (
                      <path
                        key={seg.ser.key}
                        d={
                          isTop
                            ? roundedBarPath(x, seg.top, barWidth, seg.h, 3)
                            : `M${x},${seg.top + seg.h}V${seg.top}H${x + barWidth}V${seg.top + seg.h}Z`
                        }
                        fill={seg.ser.color}
                      />
                    );
                  })}
                  <text
                    x={x + barWidth / 2}
                    y={margin.top + plotHeight + font + 6}
                    textAnchor="middle"
                    fontSize={font - 1}
                    fill={label}
                  >
                    {point.label}
                  </text>
                  <rect
                    x={margin.left + band * index}
                    y={0}
                    width={band}
                    height={chartH}
                    fill="transparent"
                    onPointerEnter={() => setHovered(index)}
                    onPointerMove={() => setHovered(index)}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}
        {hoveredPoint && hovered !== null && width > 0 ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 min-w-36 rounded-[4px] border border-border bg-card px-3 py-2 shadow-lg"
            style={{
              left: Math.min(
                Math.max(4, margin.left + band * hovered + band / 2 - 70),
                Math.max(4, width - 160),
              ),
              top: 8,
              fontSize: font,
            }}
          >
            <div className="font-semibold tabular-nums text-foreground">
              Total {Math.round(hoveredTotal * 10) / 10}
            </div>
            <ul className="mt-1.5 space-y-1">
              {series.map((ser) => (
                <li
                  key={ser.key}
                  className="flex items-center justify-between gap-4 text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-[2px]"
                      style={{ background: ser.color }}
                    />
                    {ser.name}
                  </span>
                  <span className="tabular-nums text-foreground">
                    {hoveredPoint.values[ser.key] ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {series.map((ser) => (
          <li key={ser.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-[2px]" style={{ background: ser.color }} />
            {ser.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
