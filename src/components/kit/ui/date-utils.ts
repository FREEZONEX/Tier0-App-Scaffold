/**
 * Date helpers for pickers and display. The business clock is Asia/Shanghai
 * (UTC+8, no DST) regardless of the browser time zone, so server-rendered and
 * client-rendered text always agree.
 *
 * Value conventions:
 * - DATE precision values are "YYYY-MM-DD" strings.
 * - DATETIME values are ISO instants ("2026-09-17T01:30:00.000Z") by default;
 *   pickers also accept "YYYY-MM-DD HH:mm[:ss]" wall-clock strings.
 */

export type DatePrecision = "DATE" | "DATETIME_MINUTE" | "DATETIME_SECOND";
/** date = "YYYY-MM-DD", iso = UTC ISO string, wall = "YYYY-MM-DD HH:mm:ss" (Shanghai). */
export type DateValueFormat = "date" | "iso" | "wall";

export const APP_UTC_OFFSET_MINUTES = 480;

export interface WallTime {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;

const pad2 = (value: number) => String(value).padStart(2, "0");

export function instantToWall(date: Date): WallTime {
  const shifted = new Date(date.getTime() + APP_UTC_OFFSET_MINUTES * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

export function wallToInstant(wall: WallTime): Date {
  return new Date(
    Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) -
      APP_UTC_OFFSET_MINUTES * 60_000,
  );
}

function validWall(wall: WallTime): WallTime | null {
  if (wall.month < 1 || wall.month > 12) return null;
  if (wall.day < 1 || wall.day > daysInMonth(wall.year, wall.month)) return null;
  if (wall.hour > 23 || wall.minute > 59 || wall.second > 59) return null;
  return wall;
}

const WALL_PATTERN =
  /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?)?$/;

/** Parse any supported value (Date, epoch ms, ISO, "YYYY-MM-DD[ HH:mm[:ss]]"). */
export function parseDateValue(value: unknown): WallTime | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : instantToWall(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? instantToWall(new Date(value)) : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  const wallMatch = WALL_PATTERN.exec(text);
  if (wallMatch) {
    return validWall({
      year: Number(wallMatch[1]),
      month: Number(wallMatch[2]),
      day: Number(wallMatch[3]),
      hour: Number(wallMatch[4] ?? 0),
      minute: Number(wallMatch[5] ?? 0),
      second: Number(wallMatch[6] ?? 0),
    });
  }
  const time = Date.parse(text);
  return Number.isNaN(time) ? null : instantToWall(new Date(time));
}

export function formatWall(wall: WallTime, precision: DatePrecision): string {
  const date = `${wall.year}-${pad2(wall.month)}-${pad2(wall.day)}`;
  if (precision === "DATE") return date;
  if (precision === "DATETIME_MINUTE") return `${date} ${pad2(wall.hour)}:${pad2(wall.minute)}`;
  return `${date} ${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}`;
}

/** Display text for a stored value; "" when empty or unparseable. */
export function formatDateValue(value: unknown, precision: DatePrecision = "DATETIME_SECOND"): string {
  const wall = parseDateValue(value);
  return wall ? formatWall(wall, precision) : "";
}

export function defaultValueFormat(precision: DatePrecision): DateValueFormat {
  return precision === "DATE" ? "date" : "iso";
}

/** Serialize a wall time for onChange. */
export function serializeWall(
  wall: WallTime,
  precision: DatePrecision,
  format: DateValueFormat = defaultValueFormat(precision),
): string {
  const normalized: WallTime =
    precision === "DATE"
      ? { ...wall, hour: 0, minute: 0, second: 0 }
      : precision === "DATETIME_MINUTE"
        ? { ...wall, second: 0 }
        : wall;
  if (format === "date") return formatWall(normalized, "DATE");
  if (format === "wall") return formatWall(normalized, "DATETIME_SECOND");
  return wallToInstant(normalized).toISOString();
}

export function nowWall(): WallTime {
  return instantToWall(new Date());
}

export function startOfDay(wall: WallTime): WallTime {
  return { ...wall, hour: 0, minute: 0, second: 0 };
}

export function endOfDay(wall: WallTime): WallTime {
  return { ...wall, hour: 23, minute: 59, second: 59 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function addDays(wall: WallTime, delta: number): WallTime {
  const base = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + delta));
  return {
    ...wall,
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

/** Compare by calendar day only. */
export function compareDay(a: WallTime, b: WallTime): number {
  return (a.year - b.year) * 10000 + (a.month - b.month) * 100 + (a.day - b.day);
}

export function compareWall(a: WallTime, b: WallTime): number {
  return (
    compareDay(a, b) * 100000 +
    (a.hour - b.hour) * 3600 +
    (a.minute - b.minute) * 60 +
    (a.second - b.second)
  );
}

export function isSameDay(a: WallTime | null, b: WallTime | null): boolean {
  return Boolean(a && b && compareDay(a, b) === 0);
}

/** Calendar cells (6 weeks, Monday first) for a month view. */
export function monthGrid(year: number, month: number): { wall: WallTime; inMonth: boolean }[] {
  const lead = weekdayIndex(year, month, 1);
  const first: WallTime = { year, month, day: 1, hour: 0, minute: 0, second: 0 };
  const cells: { wall: WallTime; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const wall = addDays(first, index - lead);
    cells.push({ wall, inMonth: wall.month === month && wall.year === year });
  }
  return cells;
}

export const DATE_PLACEHOLDER: Record<DatePrecision, string> = {
  DATE: "请选择日期",
  DATETIME_MINUTE: "请选择时间",
  DATETIME_SECOND: "请选择时间",
};
