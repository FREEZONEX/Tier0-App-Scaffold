/**
 * Navigation icon library for the Shell sidebar (and a reference for action
 * icons). Icons are lucide-react glyphs (ISC license, 24px grid, 2px stroke),
 * imported by name so the bundle carries only these ~110 icons — never the
 * whole `icons` map (~1700 icons, +480 kB before gzip in the app chunk).
 *
 * How a sidebar entry gets its icon, in order:
 *  1. `icon` is a lucide component (`import { Wrench } from "lucide-react"`) — always preferred.
 *  2. `icon` is a name from `NAV_ICON_LIBRARY` ("Wrench", "wrench", "clipboard-list").
 *  3. no or unknown icon → the label is matched against `NAV_ICON_KEYWORDS`
 *     (「报修单」→ Wrench, 「库存」→ Warehouse …).
 *  4. nothing matches → `null`; the Shell draws the label's first character
 *     in a small box, so a collapsed rail never shows an empty entry.
 */
import {
  Activity,
  AlarmClock,
  Archive,
  ArrowLeftRight,
  Award,
  BadgeCheck,
  Ban,
  Barcode,
  Bell,
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Car,
  ChartColumn,
  ChartLine,
  ChartPie,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock,
  Coins,
  Container,
  Cpu,
  CreditCard,
  Database,
  Download,
  Droplets,
  Factory,
  FileInput,
  FileOutput,
  FileText,
  Files,
  Flag,
  FlaskConical,
  FolderOpen,
  Fuel,
  Funnel,
  Gauge,
  GitBranch,
  GraduationCap,
  Handshake,
  HardHat,
  Headset,
  History,
  House,
  Inbox,
  KeyRound,
  Landmark,
  Layers,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  ListTodo,
  Lock,
  Mail,
  Map,
  MapPin,
  Megaphone,
  MessageSquare,
  Microscope,
  Monitor,
  Network,
  Newspaper,
  NotebookPen,
  Package,
  PackageCheck,
  PackageOpen,
  Pencil,
  Phone,
  PlugZap,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Recycle,
  RefreshCw,
  Route,
  Ruler,
  ScanLine,
  ScrollText,
  Search,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Siren,
  SlidersHorizontal,
  SquareKanban,
  Stamp,
  Store,
  Tag,
  Target,
  Thermometer,
  Timer,
  Trash2,
  TriangleAlert,
  Truck,
  Upload,
  User,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Curated icons a sidebar entry may name as a string. */
export const NAV_ICON_LIBRARY = {
  Activity, AlarmClock, Archive, ArrowLeftRight, Award, BadgeCheck, Ban, Barcode, Bell, BookOpen,
  Bot, Boxes, Briefcase, Building2, Calculator, Calendar, CalendarCheck, CalendarClock, Car,
  ChartColumn, ChartLine, ChartPie, ClipboardCheck, ClipboardList, ClipboardPen, Clock, Coins,
  Container, Cpu, CreditCard, Database, Download, Droplets, Factory, FileInput, FileOutput,
  FileText, Files, Flag, FlaskConical, FolderOpen, Fuel, Funnel, Gauge, GitBranch, GraduationCap,
  Handshake, HardHat, Headset, History, House, Inbox, KeyRound, Landmark, Layers, LayoutDashboard,
  Lightbulb, ListChecks, ListTodo, Lock, Mail, Map, MapPin, Megaphone, MessageSquare, Microscope,
  Monitor, Network, Newspaper, NotebookPen, Package, PackageCheck, PackageOpen, Pencil, Phone,
  PlugZap, Plus, Printer, QrCode, Receipt, Recycle, RefreshCw, Route, Ruler, ScanLine, ScrollText,
  Search, Server, Settings, ShieldAlert, ShieldCheck, ShoppingCart, Siren, SlidersHorizontal,
  SquareKanban, Stamp, Store, Tag, Target, Thermometer, Timer, Trash2, TriangleAlert, Truck, Upload,
  User, UserCheck, UserCog, Users, Wallet, Warehouse, Workflow, Wrench, Zap,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICON_LIBRARY;

/** Older or common lucide names that map onto a library icon. */
const NAV_ICON_ALIASES: Record<string, NavIconName> = {
  Home: "House",
  Dashboard: "LayoutDashboard",
  BarChart: "ChartColumn",
  BarChart3: "ChartColumn",
  LineChart: "ChartLine",
  PieChart: "ChartPie",
  AlertTriangle: "TriangleAlert",
  Filter: "Funnel",
  Kanban: "SquareKanban",
  Edit: "Pencil",
  Delete: "Trash2",
  Trash: "Trash2",
  Cog: "Settings",
  Settings2: "Settings",
  Gear: "Settings",
};

const BY_LOWER_NAME = new globalThis.Map<string, NavIconName>(
  [
    ...(Object.keys(NAV_ICON_LIBRARY) as NavIconName[]).map((name) => [name, name] as const),
    ...Object.entries(NAV_ICON_ALIASES),
  ].map(([key, name]) => [key.toLowerCase(), name]),
);

/** "Wrench", "wrench", "clipboard-list", "clipboard_list", "ClipboardList" → library name. */
export function findNavIconName(name: string): NavIconName | null {
  const compact = name.trim().replace(/[-_\s./]+/g, "").toLowerCase();
  return compact ? (BY_LOWER_NAME.get(compact) ?? null) : null;
}

/**
 * Business keyword → icon, checked in order against the menu label (more
 * specific words first). Shared by the sidebar default and by generation
 * guidance, so the same concept gets the same glyph everywhere.
 */
export const NAV_ICON_KEYWORDS: readonly (readonly [NavIconName, readonly string[]])[] = [
  ["LayoutDashboard", ["首页", "工作台", "概览", "总览", "驾驶舱", "dashboard", "overview", "home"]],
  ["Wrench", ["报修", "维修", "检修", "维护", "保养", "repair", "maintenance"]],
  ["ClipboardCheck", ["巡检", "点检", "检验", "质检", "验收", "inspection", "qc"]],
  ["ShieldCheck", ["质量", "合规", "安全", "quality", "compliance", "safety"]],
  ["Siren", ["告警", "报警", "预警", "alarm", "alert"]],
  ["TriangleAlert", ["异常", "事故", "隐患", "incident", "exception"]],
  ["Stamp", ["审批", "审核", "签核", "approval", "review"]],
  ["ListTodo", ["待办", "任务", "todo", "task"]],
  ["ClipboardList", ["工单", "单据", "订单", "申请", "记录", "order", "ticket", "request", "record"]],
  ["CalendarClock", ["计划", "排产", "排班", "日程", "schedule", "plan", "shift"]],
  ["Factory", ["产线", "车间", "生产", "工厂", "production", "factory", "line", "plant"]],
  ["Cpu", ["设备", "机台", "资产", "equipment", "device", "machine", "asset"]],
  ["Warehouse", ["仓库", "库存", "库位", "warehouse", "inventory", "stock"]],
  ["Package", ["物料", "产品", "零件", "备件", "material", "product", "part"]],
  ["Truck", ["物流", "运输", "发货", "收货", "供应商", "logistics", "shipping", "delivery", "supplier"]],
  ["ShoppingCart", ["采购", "purchase", "procurement"]],
  ["Store", ["销售", "门店", "sales", "store"]],
  ["Building2", ["客户", "企业", "组织", "部门", "customer", "company", "organization", "department"]],
  ["Users", ["人员", "成员", "员工", "用户", "团队", "member", "people", "staff", "user", "team"]],
  ["Thermometer", ["温度", "环境", "temperature", "environment"]],
  ["Zap", ["能源", "能耗", "电力", "energy", "power"]],
  ["Gauge", ["监控", "监测", "看板", "仪表", "monitor", "board"]],
  ["ChartColumn", ["报表", "统计", "分析", "report", "statistics", "analytics"]],
  ["Coins", ["成本", "费用", "财务", "预算", "cost", "finance", "budget", "expense"]],
  ["FileText", ["文档", "档案", "合同", "document", "contract", "archive"]],
  ["GraduationCap", ["培训", "考试", "training", "exam"]],
  ["Bell", ["通知", "消息", "notification", "message"]],
  ["History", ["日志", "历史", "审计", "log", "history", "audit"]],
  ["Settings", ["设置", "配置", "系统", "参数", "setting", "config", "system"]],
];

/** Icon whose keyword appears in the label, or null. */
export function suggestNavIcon(label: string): NavIconName | null {
  const text = label.trim().toLowerCase();
  if (!text) return null;
  for (const [name, keywords] of NAV_ICON_KEYWORDS) {
    if (keywords.some((keyword) => (/^[a-z]+$/.test(keyword) ? new RegExp(`\\b${keyword}`).test(text) : text.includes(keyword)))) {
      return name;
    }
  }
  return null;
}

function isIconComponent(value: unknown): value is LucideIcon {
  return (
    typeof value === "function" ||
    (typeof value === "object" && value !== null && "$$typeof" in value && "render" in value)
  );
}

/**
 * Icon component for a sidebar entry: explicit component → library name →
 * label keyword → null (caller draws the letter mark).
 */
export function resolveNavIconComponent(icon: unknown, label: string): LucideIcon | null {
  if (isIconComponent(icon)) return icon;
  const named = typeof icon === "string" ? findNavIconName(icon) : null;
  const name = named ?? suggestNavIcon(label);
  return name ? NAV_ICON_LIBRARY[name] : null;
}
