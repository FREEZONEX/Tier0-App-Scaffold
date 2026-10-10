import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export interface PageContainerProps {
  /** Page title shown above the content card (灵动：卡片外左上). */
  title: ReactNode;
  /** Right side of the title row: page-level links such as 「移动端卡片」「自定义事件」. */
  extra?: ReactNode;
  children?: ReactNode;
  /** Stretch to the viewport height so the last PageCard can fill it (list pages). */
  fill?: boolean;
  className?: string;
}

/** PageContainer — standard workspace page frame: title row + content cards on the canvas. */
export function PageContainer({ title, extra, children, fill = false, className }: PageContainerProps) {
  return (
    <div
      className={cn(
        "page-shell flex flex-col gap-3",
        fill && "flex-1",
        className,
      )}
    >
      <PageHeader
        title={title}
        actions={extra}
        className="min-h-9 items-center gap-y-1 px-1 [&_h1]:truncate"
      />
      {children}
    </div>
  );
}

export interface PageCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Inner padding (default md = 16px, 20px on large screens). */
  padding?: "none" | "sm" | "md";
  /** Grow to fill the remaining height of a `fill` PageContainer. */
  fill?: boolean;
}

const CARD_PADDING = { none: "", sm: "p-3", md: "p-3 sm:p-4 xl:p-5" } as const;

/** PageCard — white 12px-radius content card. */
export function PageCard({ padding = "md", fill = false, className, children, ...rest }: PageCardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "min-w-0 rounded-xl border border-[#e8e8e8] bg-card shadow-card",
        CARD_PADDING[padding],
        fill && "flex flex-1 flex-col",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderLinkProps {
  icon?: ReactNode;
  children: ReactNode;
  /** In-app route (client navigation). */
  to?: string;
  /** Plain URL (e.g. opening a monitor route in a new tab). */
  href?: string;
  newTab?: boolean;
  onClick?: () => void;
  className?: string;
}

const LINK_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-sm text-sm text-text-secondary transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-border [&_svg]:size-4";

/** PageHeaderLink — quiet text link in the page title row. */
export function PageHeaderLink({ icon, children, to, href, newTab = false, onClick, className }: PageHeaderLinkProps) {
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  if (to) {
    return (
      <Link
        to={to as never}
        target={newTab ? "_blank" : undefined}
        rel={newTab ? "noreferrer" : undefined}
        className={cn(LINK_CLASS, className)}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        target={newTab ? "_blank" : undefined}
        rel="noreferrer"
        className={cn(LINK_CLASS, className)}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }
  return (
    <button type="button" className={cn(LINK_CLASS, className)} onClick={onClick}>
      {content}
    </button>
  );
}
