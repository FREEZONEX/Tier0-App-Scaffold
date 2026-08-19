/**
 * Responsive contract analyzer.
 *
 * AGENTS.md states the contract: "Interactive pages remain usable at 375px
 * without page-level overflow." Nothing enforced it, so the two ways generated
 * apps break it both survive typecheck, lint and build:
 *
 *   1. A filter/search control given `flex-1` with no upper bound. On a wide
 *      screen it stretches across the whole toolbar; on a narrow one it fights
 *      its siblings for room. A search box wants a bounded width, not all of it.
 *   2. A hard `min-w-*` that exceeds the 375px budget while sitting outside any
 *      horizontal scroll region, which forces the whole page to scroll sideways.
 *
 * The scaffold's own `TableViewport` shows the sanctioned way to demand width:
 * put the `min-w-[720px]` INSIDE an `overflow-x-auto` viewport so the scroll is
 * contained. This analyzer therefore tracks scroll ancestry rather than banning
 * minimum widths outright.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import ts from "typescript";

/** 375px 视口下，超过这个宽度就无法容身（留出最小页面留白）。 */
export const NARROW_VIEWPORT_PX = 375;

const SCROLL_CLASSES = new Set([
  "overflow-x-auto",
  "overflow-x-scroll",
  "overflow-auto",
  "overflow-scroll",
]);

const GROW_CLASSES = new Set(["flex-1", "grow", "flex-auto"]);

/** 受本规则约束的表单控件：它们的宽度直接决定工具栏能否容身。 */
const FORM_CONTROLS = new Set(["input", "select", "textarea"]);

/** Tailwind 间距刻度：min-w-96 → 96 * 4px = 384px。 */
function widthToPx(token) {
  const arbitrary = /^min-w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(token);
  if (arbitrary) {
    const value = Number(arbitrary[1]);
    return arbitrary[2] === "rem" ? value * 16 : value;
  }
  const scale = /^min-w-(\d+(?:\.\d+)?)$/.exec(token);
  if (scale) return Number(scale[1]) * 4;
  return null;
}

/**
 * 从 className 属性里取出静态类名。
 *
 * 覆盖字符串字面量、模板串的静态段，以及 `cn(...)` / 条件表达式里的字面量——
 * 动态拼接的部分本就无法静态判断，跳过而不臆断。
 */
export function extractClassTokens(attributeValue, sf) {
  const tokens = [];
  const collect = (node) => {
    if (ts.isStringLiteralLike(node)) {
      tokens.push(...node.text.split(/\s+/).filter(Boolean));
    }
    if (ts.isTemplateExpression(node)) {
      tokens.push(...node.head.text.split(/\s+/).filter(Boolean));
      for (const span of node.templateSpans) {
        tokens.push(...span.literal.text.split(/\s+/).filter(Boolean));
      }
    }
    ts.forEachChild(node, collect);
  };
  collect(attributeValue);
  return tokens;
}

function classTokensOf(element, sf) {
  const attrs = element.attributes?.properties ?? [];
  for (const attr of attrs) {
    if (!ts.isJsxAttribute(attr) || attr.name.getText(sf) !== "className") continue;
    if (!attr.initializer) return [];
    const value = ts.isJsxExpression(attr.initializer)
      ? attr.initializer.expression
      : attr.initializer;
    return value ? extractClassTokens(value, sf) : [];
  }
  return [];
}

function tagNameOf(element, sf) {
  return element.tagName.getText(sf);
}

/**
 * 分析单个文件，返回违反 375px 契约的位置。
 *
 * 遍历时维护「祖先中是否已有横向滚动容器」，因此把宽度需求放进
 * overflow-x-auto 视口里的正确写法不会被误判。
 */
export function analyzeSource(source, filePath = "source.tsx") {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  const visit = (node, insideScrollRegion) => {
    let nextInsideScroll = insideScrollRegion;

    const element = ts.isJsxSelfClosingElement(node)
      ? node
      : ts.isJsxElement(node)
        ? node.openingElement
        : null;

    if (element) {
      const tokens = classTokensOf(element, sf);
      const tag = tagNameOf(element, sf);
      const line = sf.getLineAndCharacterOfPosition(element.getStart(sf)).line + 1;

      if (tokens.some((t) => SCROLL_CLASSES.has(t))) nextInsideScroll = true;

      // 规则 A：表单控件不能无上界地伸展
      if (FORM_CONTROLS.has(tag) && tokens.some((t) => GROW_CLASSES.has(t))) {
        const bounded = tokens.some((t) => t.startsWith("max-w-") || /^w-\d/.test(t));
        if (!bounded) {
          violations.push({
            rule: "unbounded-control-growth",
            file: filePath,
            line,
            tag,
            message:
              `<${tag}> at ${filePath}:${line} grows with "${tokens.find((t) => GROW_CLASSES.has(t))}" ` +
              `but declares no upper bound. A search or filter control should occupy a bounded width ` +
              `(e.g. "w-full max-w-xs", or "min-w-0 flex-1 max-w-sm" when it must share a row), ` +
              `otherwise it stretches across the whole toolbar on wide screens and crowds its siblings on narrow ones.`,
          });
        }
      }

      // 规则 B：超出 375px 预算的硬最小宽度必须待在横向滚动区里
      for (const token of tokens) {
        const px = widthToPx(token);
        if (px === null || px <= NARROW_VIEWPORT_PX) continue;
        if (insideScrollRegion || nextInsideScroll) continue;
        violations.push({
          rule: "min-width-breaks-narrow-viewport",
          file: filePath,
          line,
          tag,
          message:
            `<${tag}> at ${filePath}:${line} sets "${token}" (${px}px), which exceeds the ` +
            `${NARROW_VIEWPORT_PX}px viewport the scaffold promises to stay usable at, and it is not ` +
            `inside a horizontal scroll region. Either let it shrink, or wrap it the way TableViewport ` +
            `does: put the minimum width inside an "overflow-x-auto" container so the scroll stays local.`,
        });
      }
    }

    ts.forEachChild(node, (child) => visit(child, nextInsideScroll));
  };

  visit(sf, false);
  return violations;
}

function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkFiles(full, out);
    } else if (extname(full) === ".tsx") {
      out.push(full);
    }
  }
  return out;
}

/** 扫描应用界面层（routes + components），返回全部违规。 */
export function analyzeRepoResponsive(cwd = process.cwd()) {
  const violations = [];
  for (const root of ["src/routes", "src/components"]) {
    const dir = join(cwd, root);
    let files;
    try {
      files = walkFiles(dir);
    } catch {
      continue; // 目录不存在时跳过
    }
    for (const file of files) {
      const rel = relative(cwd, file);
      violations.push(...analyzeSource(readFileSync(file, "utf8"), rel));
    }
  }
  return violations;
}
