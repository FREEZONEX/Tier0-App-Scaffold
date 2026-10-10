import { cn } from "@/lib/utils";

export interface HighlightTextProps {
  text: string;
  /** Case-insensitive keyword to highlight; empty = plain text. */
  keyword?: string;
  className?: string;
  highlightClassName?: string;
}

/** HighlightText — marks keyword matches (菜单搜索 / 树搜索 结果高亮). */
export function HighlightText({ text, keyword, className, highlightClassName }: HighlightTextProps) {
  const needle = keyword?.trim();
  if (!needle) return <span className={className}>{text}</span>;
  const lower = text.toLowerCase();
  const target = needle.toLowerCase();
  const parts: { text: string; match: boolean }[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const found = lower.indexOf(target, cursor);
    if (found < 0) {
      parts.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (found > cursor) parts.push({ text: text.slice(cursor, found), match: false });
    parts.push({ text: text.slice(found, found + target.length), match: true });
    cursor = found + target.length;
  }
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className={cn("bg-transparent font-medium text-[#fa8c16]", highlightClassName)}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}
