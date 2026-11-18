import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StreamText — markdown-lite transcript that can grow while `streaming`.
 * Adapted from ReUI reveal (close incomplete markers) + shadcnuikit message
 * body. No react-markdown / shiki: paragraphs, lists, **bold**, `code`, fences.
 *
 * The parent owns transport (SSE chunks or a simulated reveal). This only
 * renders the current buffer plus a caret while tokens are still arriving.
 */

function inlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-medium text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="rounded-[4px] bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function StreamCaret() {
  return (
    <span
      data-slot="stream-caret"
      className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.12em] bg-[color:var(--tier0-cta)] align-text-bottom motion-safe:animate-pulse"
      aria-hidden
    />
  );
}

function ProseBlock({ text, caret }: { text: string; caret?: ReactNode }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  let paragraph: string[] = [];
  let key = 0;

  const flushBullets = (tail?: ReactNode) => {
    if (!bullets.length) return;
    const last = bullets.length - 1;
    blocks.push(
      <ul key={`ul-${key++}`} className="my-1.5 list-disc space-y-0.5 pl-5">
        {bullets.map((item, index) => (
          <li key={index}>
            {inlineMarkdown(item)}
            {tail && index === last ? tail : null}
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };
  const flushOrdered = (tail?: ReactNode) => {
    if (!ordered.length) return;
    const last = ordered.length - 1;
    blocks.push(
      <ol key={`ol-${key++}`} className="my-1.5 list-decimal space-y-0.5 pl-5">
        {ordered.map((item, index) => (
          <li key={index}>
            {inlineMarkdown(item)}
            {tail && index === last ? tail : null}
          </li>
        ))}
      </ol>,
    );
    ordered = [];
  };
  const flushParagraph = (tail?: ReactNode) => {
    if (!paragraph.length && !tail) return;
    blocks.push(
      <p key={`p-${key++}`} className="my-2 first:mt-0 last:mb-0">
        {paragraph.length ? inlineMarkdown(paragraph.join("\n")) : null}
        {tail}
      </p>,
    );
    paragraph = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushOrdered();
      flushParagraph();
      bullets.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      flushBullets();
      flushParagraph();
      ordered.push(numbered[1]);
      continue;
    }
    if (line.trim() === "") {
      flushBullets();
      flushOrdered();
      flushParagraph();
      continue;
    }
    flushBullets();
    flushOrdered();
    paragraph.push(line);
  }
  if (bullets.length) flushBullets(caret);
  else if (ordered.length) flushOrdered(caret);
  else flushParagraph(caret);
  return <>{blocks}</>;
}

function MarkdownLite({ text, caret }: { text: string; caret?: ReactNode }) {
  const parts = text.split(/```/);
  const lastIndex = parts.length - 1;
  return (
    <>
      {parts.map((part, index) => {
        const tail = caret && index === lastIndex ? caret : undefined;
        if (index % 2 === 1) {
          const nl = part.indexOf("\n");
          const code = nl === -1 ? part : part.slice(nl + 1).replace(/\n$/, "");
          return (
            <pre
              key={index}
              className="my-2 overflow-x-auto rounded-[4px] bg-muted px-3 py-2 font-mono text-xs leading-5 text-foreground"
            >
              <code>{code}</code>
              {tail}
            </pre>
          );
        }
        return part || tail ? <ProseBlock key={index} text={part} caret={tail} /> : null;
      })}
    </>
  );
}

export interface StreamTextProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

export function StreamText({ text, streaming = false, className }: StreamTextProps) {
  return (
    <div
      data-slot="stream-text"
      data-streaming={streaming ? "true" : undefined}
      className={cn(
        "text-sm leading-6 text-foreground [&_p]:text-sm [&_p]:leading-6",
        className,
      )}
      aria-busy={streaming || undefined}
    >
      {text ? (
        <MarkdownLite text={text} caret={streaming ? <StreamCaret /> : undefined} />
      ) : streaming ? (
        <StreamCaret />
      ) : null}
    </div>
  );
}
