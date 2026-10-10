/**
 * 自定义事件「条件表达式」：词法 / 语法分析、语法校验与求值（纯函数，前后端共用）。
 *
 * 表达式编辑器在前端用 `checkExpression` 实时提示语法错误；服务端保存规则时
 * 再校验一次（含字段是否存在），事件引擎用 `evaluateExpression` 求值。
 *
 * 语法
 * - 字段引用：`${对象.字段}`（如 `${记录.优先级}`）、`${字段}`、关联对象 `${对象.关联字段.字段}`
 *   （如 `${记录.关联对象.名称}`）、`${系统.系统时间}`、定时触发的 `${统计数据1}`。
 * - 字面量：数字 `12` / `3.5`；文本 `"加急"` 或 `'加急'`（反斜杠转义）；日期文本 `"2026-09-17"` /
 *   `"2026-09-17 08:30"` / `"2026-09-17 08:30:00"`（按 Asia/Shanghai）；`true` / `false` / `null`。
 * - 运算符（优先级从低到高）：`||`，`&&`，`==` `!=`，`>` `>=` `<` `<=`，`+` `-`，`*` `/`，一元 `!` `-`；括号 `( )`。
 * - 常用函数：`IN(值, 选项1, 选项2…)`、`NOT_IN(…)`、`LIKE(值, "关键字")`、`NOT_LIKE(…)`（函数名不区分大小写）。
 * - 支持空格与回车换行；末尾可以带分号 `;`。
 *
 * 比较口径
 * - 单选字段同时按选项值与选项名称比较（`${记录.优先级} == "加急"` 与 `== "urgent"` 都成立）；
 *   关联对象按 id / 名称 / 编码比较；多值字段（复选、多选人员）任一值满足即成立，`!=` 为全部不满足。
 * - `== null` / `== ""` 判断为空（空文本、空数组也为空）；有一侧为空时大小比较不成立。
 * - 日期与日期文本比较时按文本的精度截断（`${计划结束时间} > "2026-09-17"` = 晚于 9 月 17 日当天）；
 *   两个日期字段按较粗的精度比较；日期 ± 数字 = 前后若干天，日期 − 日期 = 相差天数。
 * - 文本比较前若两侧都是数字文本则按数字比较；`LIKE` 不含 `%` / `_` 时为包含（不区分大小写），
 *   含通配符时按整串匹配。
 */

export const EXPRESSION_MAX_LENGTH = 4000;

/** Variables `${系统.系统时间}`. */
export const SYSTEM_VARIABLE_OBJECT = "系统";
export const SYSTEM_TIME_VARIABLE = "系统时间";
/** Statistics slots of 定时触发: `${统计数据1}` … */
export const STATISTICS_VARIABLE_PREFIX = "统计数据";

export const EXPRESSION_FUNCTION_NAMES = ["IN", "NOT_IN", "LIKE", "NOT_LIKE"] as const;
export type ExpressionFunctionName = (typeof EXPRESSION_FUNCTION_NAMES)[number];

/** 常用符号 buttons of the expression editor. */
export const EXPRESSION_SYMBOLS: readonly { text: string; label: string; insert?: string }[] = [
  { text: "+", label: "加号", insert: " + " },
  { text: "-", label: "减号", insert: " - " },
  { text: "*", label: "乘号", insert: " * " },
  { text: "/", label: "除号", insert: " / " },
  { text: "&&", label: "且", insert: " && " },
  { text: "||", label: "或", insert: " || " },
  { text: "==", label: "等于", insert: " == " },
  { text: "!=", label: "不等于", insert: " != " },
  { text: ">", label: "大于", insert: " > " },
  { text: "<", label: "小于", insert: " < " },
  { text: ">=", label: "大于等于", insert: " >= " },
  { text: "<=", label: "小于等于", insert: " <= " },
  { text: "(", label: "左括号" },
  { text: ")", label: "右括号" },
  { text: ",", label: "逗号", insert: ", " },
  { text: ";", label: "分号" },
  { text: "\"", label: "双引号" },
  { text: "'", label: "单引号" },
  { text: "{", label: "左花括号" },
  { text: "}", label: "右花括号" },
  { text: "$", label: "美元符" },
];

/** 常用函数 of the expression editor. `template` is inserted with the caret after `(`. */
export const EXPRESSION_FUNCTIONS: readonly {
  name: ExpressionFunctionName;
  template: string;
  description: string;
  example: string;
}[] = [
  {
    name: "IN",
    template: "IN()",
    description: "字段值等于其中任意一个值时成立",
    example: 'IN(${记录.记录状态}, "未开始", "执行中")',
  },
  {
    name: "NOT_IN",
    template: "NOT_IN()",
    description: "字段值不等于其中任何一个值时成立",
    example: 'NOT_IN(${记录.记录状态}, "已结束", "已取消")',
  },
  {
    name: "LIKE",
    template: "LIKE()",
    description: "字段内容包含关键字时成立，可用 % 表示任意字符",
    example: 'LIKE(${记录.名称}, "齿轮")',
  },
  {
    name: "NOT_LIKE",
    template: "NOT_LIKE()",
    description: "字段内容不包含关键字时成立",
    example: 'NOT_LIKE(${记录.名称}, "样品")',
  },
];

/* ─── Syntax tree ─────────────────────────────────────────────────────── */

export interface ExpressionError {
  message: string;
  /** Character offsets in the source (end exclusive). */
  start: number;
  end: number;
}

export type BinaryOperator = "||" | "&&" | "==" | "!=" | ">" | ">=" | "<" | "<=" | "+" | "-" | "*" | "/";

interface NodeBase {
  start: number;
  end: number;
}

export type ExpressionNode =
  | (NodeBase & { kind: "literal"; value: number | string | boolean | null })
  | (NodeBase & { kind: "variable"; path: string[]; raw: string })
  | (NodeBase & { kind: "unary"; operator: "!" | "-"; operand: ExpressionNode })
  | (NodeBase & { kind: "binary"; operator: BinaryOperator; left: ExpressionNode; right: ExpressionNode })
  | (NodeBase & { kind: "call"; name: ExpressionFunctionName; args: ExpressionNode[] });

export interface VariableRef {
  path: string[];
  /** As written, e.g. "${记录.优先级}". */
  raw: string;
  start: number;
  end: number;
}

export type ParseResult = { ok: true; ast: ExpressionNode | null } | { ok: false; error: ExpressionError };

/* ─── Tokenizer ───────────────────────────────────────────────────────── */

type TokenType = "number" | "string" | "variable" | "identifier" | "operator" | "lparen" | "rparen" | "comma" | "semicolon";

interface Token {
  type: TokenType;
  /** number: numeric text; string: unescaped text; variable: inner text; identifier/operator: as written. */
  value: string;
  start: number;
  end: number;
}

class SyntaxProblem extends Error {
  constructor(
    message: string,
    readonly start: number,
    readonly end: number,
  ) {
    super(message);
    this.name = "SyntaxProblem";
  }
}

const FULL_WIDTH_HINTS: Record<string, string> = {
  "（": "(",
  "）": ")",
  "，": ",",
  "；": ";",
  "“": "\"",
  "”": "\"",
  "‘": "'",
  "’": "'",
  "＝": "==",
  "！": "!",
  "＞": ">",
  "＜": "<",
  "｛": "{",
  "｝": "}",
  "＄": "$",
};

const TWO_CHAR_OPERATORS = new Set(["==", "!=", ">=", "<=", "&&", "||"]);
const ONE_CHAR_OPERATORS = new Set([">", "<", "!", "+", "-", "*", "/"]);

function isDigit(char: string): boolean {
  return char >= "0" && char <= "9";
}

function isIdentifierStart(char: string): boolean {
  return (char >= "a" && char <= "z") || (char >= "A" && char <= "Z") || char === "_";
}

function isIdentifierPart(char: string): boolean {
  return isIdentifierStart(char) || isDigit(char);
}

function isWhitespace(char: string): boolean {
  return char === " " || char === "\t" || char === "\n" || char === "\r" || char === " " || char === "　";
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (isWhitespace(char)) {
      index += 1;
      continue;
    }
    const start = index;
    if (char === "$") {
      if (source[index + 1] !== "{") throw new SyntaxProblem("字段引用格式为 ${对象.字段}，「$」后面缺少「{」", start, start + 1);
      const close = source.indexOf("}", index + 2);
      if (close < 0) throw new SyntaxProblem("字段引用缺少结尾的「}」", start, source.length);
      const inner = source.slice(index + 2, close);
      if (inner.includes("${")) throw new SyntaxProblem("字段引用缺少结尾的「}」", start, close + 1);
      tokens.push({ type: "variable", value: inner, start, end: close + 1 });
      index = close + 1;
      continue;
    }
    if (char === "\"" || char === "'") {
      let cursor = index + 1;
      let text = "";
      let closed = false;
      while (cursor < source.length) {
        const current = source[cursor];
        if (current === "\\" && cursor + 1 < source.length) {
          const next = source[cursor + 1];
          text += next === "n" ? "\n" : next === "t" ? "\t" : next;
          cursor += 2;
          continue;
        }
        if (current === char) {
          closed = true;
          break;
        }
        text += current;
        cursor += 1;
      }
      if (!closed) throw new SyntaxProblem("文本缺少结束引号", start, source.length);
      tokens.push({ type: "string", value: text, start, end: cursor + 1 });
      index = cursor + 1;
      continue;
    }
    if (isDigit(char) || (char === "." && isDigit(source[index + 1] ?? ""))) {
      let cursor = index;
      while (cursor < source.length && isDigit(source[cursor])) cursor += 1;
      if (source[cursor] === "." && isDigit(source[cursor + 1] ?? "")) {
        cursor += 1;
        while (cursor < source.length && isDigit(source[cursor])) cursor += 1;
      }
      if (cursor < source.length && isIdentifierStart(source[cursor])) {
        let end = cursor;
        while (end < source.length && isIdentifierPart(source[end])) end += 1;
        throw new SyntaxProblem(`无法识别「${source.slice(start, end)}」：文本请加引号`, start, end);
      }
      tokens.push({ type: "number", value: source.slice(index, cursor), start, end: cursor });
      index = cursor;
      continue;
    }
    if (isIdentifierStart(char)) {
      let cursor = index;
      while (cursor < source.length && isIdentifierPart(source[cursor])) cursor += 1;
      tokens.push({ type: "identifier", value: source.slice(index, cursor), start, end: cursor });
      index = cursor;
      continue;
    }
    const pair = source.slice(index, index + 2);
    if (TWO_CHAR_OPERATORS.has(pair)) {
      tokens.push({ type: "operator", value: pair, start, end: index + 2 });
      index += 2;
      continue;
    }
    if (ONE_CHAR_OPERATORS.has(char)) {
      tokens.push({ type: "operator", value: char, start, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")" || char === "," || char === ";") {
      const type: TokenType = char === "(" ? "lparen" : char === ")" ? "rparen" : char === "," ? "comma" : "semicolon";
      tokens.push({ type, value: char, start, end: index + 1 });
      index += 1;
      continue;
    }
    if (char === "=") throw new SyntaxProblem("判断相等请使用「==」", start, start + 1);
    if (char === "&") throw new SyntaxProblem("表示“且”请使用「&&」", start, start + 1);
    if (char === "|") throw new SyntaxProblem("表示“或”请使用「||」", start, start + 1);
    if (char === "{" || char === "}") throw new SyntaxProblem("花括号只能用在字段引用 ${对象.字段} 中", start, start + 1);
    const hint = FULL_WIDTH_HINTS[char];
    if (hint) throw new SyntaxProblem(`请使用英文符号「${hint}」代替「${char}」`, start, start + 1);
    if (/[一-龥]/.test(char)) {
      let cursor = index;
      while (cursor < source.length && /[一-龥A-Za-z0-9_]/.test(source[cursor])) cursor += 1;
      throw new SyntaxProblem(`无法识别「${source.slice(start, cursor)}」：文本请加引号，字段请使用 \${对象.字段} 引用`, start, cursor);
    }
    throw new SyntaxProblem(`无法识别的符号「${char}」`, start, start + 1);
  }
  return tokens;
}

/* ─── Parser ──────────────────────────────────────────────────────────── */

function describeToken(token: Token): string {
  switch (token.type) {
    case "variable":
      return `\${${token.value}}`;
    case "string":
      return `"${token.value}"`;
    default:
      return token.value;
  }
}

class Parser {
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly tokens: Token[],
  ) {}

  parse(): ExpressionNode | null {
    if (this.tokens.every((token) => token.type === "semicolon")) return null;
    const node = this.parseOr();
    while (this.peek()?.type === "semicolon") this.index += 1;
    const rest = this.peek();
    if (rest) {
      if (rest.type === "rparen") throw new SyntaxProblem("多余的右括号「)」", rest.start, rest.end);
      if (rest.type === "comma") throw new SyntaxProblem("逗号「,」只能用在函数参数之间", rest.start, rest.end);
      const previous = this.tokens[this.index - 1];
      if (previous?.type === "semicolon") throw new SyntaxProblem("分号「;」只能用在表达式末尾", previous.start, previous.end);
      throw new SyntaxProblem(`「${describeToken(this.tokens[this.index - 1] ?? rest)}」和「${describeToken(rest)}」之间缺少运算符`, rest.start, rest.end);
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private isOperator(...values: string[]): boolean {
    const token = this.peek();
    return token?.type === "operator" && values.includes(token.value);
  }

  private expectOperand(after: Token): void {
    const token = this.peek();
    if (!token || token.type === "semicolon") {
      throw new SyntaxProblem(`表达式不完整：「${describeToken(after)}」后面缺少内容`, after.start, after.end);
    }
  }

  private binary(left: ExpressionNode, operatorToken: Token, right: ExpressionNode): ExpressionNode {
    return { kind: "binary", operator: operatorToken.value as BinaryOperator, left, right, start: left.start, end: right.end };
  }

  private parseOr(): ExpressionNode {
    let left = this.parseAnd();
    while (this.isOperator("||")) {
      const operator = this.tokens[this.index++];
      this.expectOperand(operator);
      left = this.binary(left, operator, this.parseAnd());
    }
    return left;
  }

  private parseAnd(): ExpressionNode {
    let left = this.parseEquality();
    while (this.isOperator("&&")) {
      const operator = this.tokens[this.index++];
      this.expectOperand(operator);
      left = this.binary(left, operator, this.parseEquality());
    }
    return left;
  }

  private parseEquality(): ExpressionNode {
    const left = this.parseRelational();
    if (!this.isOperator("==", "!=")) return left;
    const operator = this.tokens[this.index++];
    this.expectOperand(operator);
    const node = this.binary(left, operator, this.parseRelational());
    if (this.isOperator("==", "!=", ">", ">=", "<", "<=")) {
      const next = this.peek()!;
      throw new SyntaxProblem("比较运算不能连续使用，多个条件请用 && 或 || 连接", next.start, next.end);
    }
    return node;
  }

  private parseRelational(): ExpressionNode {
    const left = this.parseAdditive();
    if (!this.isOperator(">", ">=", "<", "<=")) return left;
    const operator = this.tokens[this.index++];
    this.expectOperand(operator);
    const node = this.binary(left, operator, this.parseAdditive());
    if (this.isOperator(">", ">=", "<", "<=")) {
      const next = this.peek()!;
      throw new SyntaxProblem("比较运算不能连续使用，多个条件请用 && 或 || 连接", next.start, next.end);
    }
    return node;
  }

  private parseAdditive(): ExpressionNode {
    let left = this.parseMultiplicative();
    while (this.isOperator("+", "-")) {
      const operator = this.tokens[this.index++];
      this.expectOperand(operator);
      left = this.binary(left, operator, this.parseMultiplicative());
    }
    return left;
  }

  private parseMultiplicative(): ExpressionNode {
    let left = this.parseUnary();
    while (this.isOperator("*", "/")) {
      const operator = this.tokens[this.index++];
      this.expectOperand(operator);
      left = this.binary(left, operator, this.parseUnary());
    }
    return left;
  }

  private parseUnary(): ExpressionNode {
    if (this.isOperator("!", "-")) {
      const operator = this.tokens[this.index++];
      this.expectOperand(operator);
      const operand = this.parseUnary();
      return { kind: "unary", operator: operator.value as "!" | "-", operand, start: operator.start, end: operand.end };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ExpressionNode {
    const token = this.peek();
    if (!token) {
      const last = this.tokens[this.tokens.length - 1];
      throw new SyntaxProblem("表达式不完整", last?.start ?? 0, last?.end ?? this.source.length);
    }
    switch (token.type) {
      case "number": {
        this.index += 1;
        return { kind: "literal", value: Number(token.value), start: token.start, end: token.end };
      }
      case "string": {
        this.index += 1;
        return { kind: "literal", value: token.value, start: token.start, end: token.end };
      }
      case "variable": {
        this.index += 1;
        const parts = token.value.split(".").map((part) => part.trim());
        if (parts.length === 1 && parts[0] === "") throw new SyntaxProblem("字段引用不能为空", token.start, token.end);
        if (parts.some((part) => part === "")) throw new SyntaxProblem(`字段引用「\${${token.value}}」格式不正确`, token.start, token.end);
        return { kind: "variable", path: parts, raw: this.source.slice(token.start, token.end), start: token.start, end: token.end };
      }
      case "lparen": {
        this.index += 1;
        const next = this.peek();
        if (!next || next.type === "rparen") throw new SyntaxProblem("括号内缺少内容", token.start, next?.end ?? token.end);
        const inner = this.parseOr();
        const close = this.peek();
        if (close?.type !== "rparen") throw new SyntaxProblem("缺少右括号「)」", token.start, token.end);
        this.index += 1;
        return inner;
      }
      case "identifier":
        return this.parseIdentifier(token);
      case "rparen":
        throw new SyntaxProblem("多余的右括号「)」", token.start, token.end);
      case "comma":
        throw new SyntaxProblem("逗号「,」只能用在函数参数之间", token.start, token.end);
      case "semicolon":
        throw new SyntaxProblem("分号「;」只能用在表达式末尾", token.start, token.end);
      default:
        throw new SyntaxProblem(`表达式不完整：「${describeToken(token)}」前面缺少内容`, token.start, token.end);
    }
  }

  private parseIdentifier(token: Token): ExpressionNode {
    const upper = token.value.toUpperCase();
    this.index += 1;
    if (upper === "TRUE" || upper === "FALSE") return { kind: "literal", value: upper === "TRUE", start: token.start, end: token.end };
    if (upper === "NULL") return { kind: "literal", value: null, start: token.start, end: token.end };
    const name = EXPRESSION_FUNCTION_NAMES.find((item) => item === upper);
    if (!name) {
      if (this.peek()?.type === "lparen") {
        throw new SyntaxProblem(`未知函数「${token.value}」，可用函数：${EXPRESSION_FUNCTION_NAMES.join("、")}`, token.start, token.end);
      }
      throw new SyntaxProblem(`无法识别「${token.value}」：文本请加引号，字段请使用 \${对象.字段} 引用`, token.start, token.end);
    }
    const open = this.peek();
    if (open?.type !== "lparen") {
      throw new SyntaxProblem(`函数「${name}」后面需要括号，如 ${EXPRESSION_FUNCTIONS.find((item) => item.name === name)?.example ?? `${name}()`}`, token.start, token.end);
    }
    this.index += 1;
    const args: ExpressionNode[] = [];
    if (this.peek()?.type !== "rparen") {
      for (;;) {
        const next = this.peek();
        if (!next) throw new SyntaxProblem(`函数「${name}」缺少右括号「)」`, token.start, open.end);
        if (next.type === "comma" || next.type === "rparen") throw new SyntaxProblem(`函数「${name}」的参数不能为空`, next.start, next.end);
        args.push(this.parseOr());
        const separator = this.peek();
        if (separator?.type === "comma") {
          this.index += 1;
          continue;
        }
        if (separator?.type === "rparen") break;
        if (!separator) throw new SyntaxProblem(`函数「${name}」缺少右括号「)」`, token.start, open.end);
        throw new SyntaxProblem(`函数「${name}」的参数之间请用逗号「,」分隔`, separator.start, separator.end);
      }
    }
    const close = this.tokens[this.index++];
    if (name === "IN" || name === "NOT_IN") {
      if (args.length < 2) throw new SyntaxProblem(`${name} 至少需要 2 个参数：${name}(字段, 值1, 值2…)`, token.start, close.end);
    } else if (args.length !== 2) {
      throw new SyntaxProblem(`${name} 需要 2 个参数：${name}(字段, "关键字")`, token.start, close.end);
    }
    return { kind: "call", name, args, start: token.start, end: close.end };
  }
}

/** Line / column (1-based) of a character offset. */
export function positionOf(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, Math.max(0, Math.min(offset, source.length)));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function located(source: string, problem: SyntaxProblem): ExpressionError {
  const { line, column } = positionOf(source, problem.start);
  const where = source.includes("\n") ? `第 ${line} 行第 ${column} 个字符` : `第 ${column} 个字符`;
  return { message: `${where}：${problem.message}`, start: problem.start, end: problem.end };
}

export function parseExpression(source: string | null | undefined): ParseResult {
  const text = source ?? "";
  if (text.length > EXPRESSION_MAX_LENGTH) {
    return { ok: false, error: { message: `条件表达式最多 ${EXPRESSION_MAX_LENGTH} 个字符`, start: EXPRESSION_MAX_LENGTH, end: text.length } };
  }
  try {
    const tokens = tokenize(text);
    if (tokens.length === 0) return { ok: true, ast: null };
    return { ok: true, ast: new Parser(text, tokens).parse() };
  } catch (error) {
    if (error instanceof SyntaxProblem) return { ok: false, error: located(text, error) };
    throw error;
  }
}

export function collectVariables(ast: ExpressionNode | null): VariableRef[] {
  const result: VariableRef[] = [];
  const visit = (node: ExpressionNode) => {
    switch (node.kind) {
      case "variable":
        result.push({ path: node.path, raw: node.raw, start: node.start, end: node.end });
        break;
      case "unary":
        visit(node.operand);
        break;
      case "binary":
        visit(node.left);
        visit(node.right);
        break;
      case "call":
        node.args.forEach(visit);
        break;
      default:
        break;
    }
  };
  if (ast) visit(ast);
  return result;
}

export function isSystemTimeVariable(path: readonly string[]): boolean {
  return (path.length === 2 && path[0] === SYSTEM_VARIABLE_OBJECT && path[1] === SYSTEM_TIME_VARIABLE) || (path.length === 1 && path[0] === SYSTEM_TIME_VARIABLE);
}

/** `${统计数据1}` / `${统计数据.统计数据1}` → slot number, or null. */
export function statisticsSlotOf(path: readonly string[]): number | null {
  const name = path.length === 2 && path[0] === STATISTICS_VARIABLE_PREFIX ? path[1] : path.length === 1 ? path[0] : null;
  const match = name ? new RegExp(`^${STATISTICS_VARIABLE_PREFIX}(\\d{1,2})$`).exec(name) : null;
  return match ? Number(match[1]) : null;
}

export function formatVariable(path: readonly string[]): string {
  return `\${${path.join(".")}}`;
}

export interface CheckExpressionOptions {
  /** Returns an error message for an unknown / not allowed variable, or null when it is fine. */
  checkVariable?: (ref: VariableRef) => string | null;
}

/** Syntax (+ optional variable) check. Returns null when the expression is valid (empty is valid). */
export function checkExpression(source: string | null | undefined, options: CheckExpressionOptions = {}): ExpressionError | null {
  const parsed = parseExpression(source);
  if (!parsed.ok) return parsed.error;
  if (options.checkVariable) {
    for (const ref of collectVariables(parsed.ast)) {
      const problem = options.checkVariable(ref);
      if (problem) {
        const { line, column } = positionOf(source ?? "", ref.start);
        const where = (source ?? "").includes("\n") ? `第 ${line} 行第 ${column} 个字符` : `第 ${column} 个字符`;
        return { message: `${where}：${problem}`, start: ref.start, end: ref.end };
      }
    }
  }
  return null;
}

/* ─── Values ──────────────────────────────────────────────────────────── */

export type DatePrecision = "day" | "minute" | "second" | "instant";

export type ExpressionScalar =
  | { t: "null" }
  | { t: "bool"; v: boolean }
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "date"; ms: number; precision: DatePrecision }
  | { t: "option"; value: string | number; label: string }
  | { t: "ref"; id: string; name: string; code: string | null };

export type ExpressionValue = ExpressionScalar | { t: "list"; items: ExpressionScalar[] };

export const EXPR_NULL: ExpressionScalar = { t: "null" };

export const exprValue = {
  null: (): ExpressionScalar => EXPR_NULL,
  bool: (v: boolean): ExpressionScalar => ({ t: "bool", v }),
  num: (v: number): ExpressionScalar => (Number.isFinite(v) ? { t: "num", v } : EXPR_NULL),
  str: (v: string): ExpressionScalar => ({ t: "str", v }),
  date: (ms: number, precision: DatePrecision): ExpressionScalar => (Number.isFinite(ms) ? { t: "date", ms, precision } : EXPR_NULL),
  option: (value: string | number, label: string): ExpressionScalar => ({ t: "option", value, label }),
  ref: (id: string, name: string, code: string | null = null): ExpressionScalar => ({ t: "ref", id, name, code }),
  list: (items: ExpressionScalar[]): ExpressionValue => ({ t: "list", items }),
};

/** Runtime problem while evaluating (type mismatch, unknown field…). */
export class ExpressionEvalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionEvalError";
  }
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PRECISION_RANK: Record<DatePrecision, number> = { day: 3, minute: 2, second: 1, instant: 0 };

function truncate(ms: number, precision: DatePrecision): number {
  switch (precision) {
    case "day":
      return Math.floor((ms + SHANGHAI_OFFSET_MS) / DAY_MS) * DAY_MS - SHANGHAI_OFFSET_MS;
    case "minute":
      return Math.floor(ms / 60_000) * 60_000;
    case "second":
      return Math.floor(ms / 1000) * 1000;
    default:
      return ms;
  }
}

function coarser(a: DatePrecision, b: DatePrecision): DatePrecision {
  return PRECISION_RANK[a] >= PRECISION_RANK[b] ? a : b;
}

const DATE_LITERAL = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?$/;

/** "2026-09-17" / "2026-09-17 08:30[:00]" (Asia/Shanghai) or an ISO instant with Z / offset. */
export function parseDateLiteral(text: string): { ms: number; precision: DatePrecision } | null {
  const value = text.trim();
  const match = DATE_LITERAL.exec(value);
  if (match) {
    const [, y, mo, d, h, mi, s] = match;
    const month = Number(mo);
    const day = Number(d);
    const hour = h === undefined ? 0 : Number(h);
    const minute = mi === undefined ? 0 : Number(mi);
    const second = s === undefined ? 0 : Number(s);
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
    const ms = Date.UTC(Number(y), month - 1, day, hour, minute, second) - SHANGHAI_OFFSET_MS;
    const check = new Date(ms + SHANGHAI_OFFSET_MS);
    if (check.getUTCDate() !== day || check.getUTCMonth() !== month - 1) return null;
    return { ms, precision: h === undefined ? "day" : s === undefined ? "minute" : "second" };
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? { ms, precision: "second" } : null;
  }
  return null;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function formatExpressionDate(ms: number, precision: DatePrecision): string {
  const wall = new Date(ms + SHANGHAI_OFFSET_MS);
  const day = `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}`;
  if (precision === "day") return day;
  const minute = `${day} ${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
  return precision === "minute" ? minute : `${minute}:${pad(wall.getUTCSeconds())}`;
}

function numericText(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function scalarText(value: ExpressionScalar): string {
  switch (value.t) {
    case "null":
      return "";
    case "bool":
      return value.v ? "是" : "否";
    case "num":
      return String(Math.round(value.v * 1e6) / 1e6);
    case "str":
      return value.v;
    case "date":
      return formatExpressionDate(value.ms, value.precision === "instant" ? "second" : value.precision);
    case "option":
      return value.label;
    case "ref":
      return value.name;
    default:
      return "";
  }
}

/** Display text of a value (labels, names, formatted dates). */
export function expressionValueText(value: ExpressionValue): string {
  return value.t === "list" ? value.items.map(scalarText).filter(Boolean).join("、") : scalarText(value);
}

function isEmptyValue(value: ExpressionValue): boolean {
  if (value.t === "null") return true;
  if (value.t === "str") return value.v === "";
  if (value.t === "list") return value.items.length === 0;
  return false;
}

export function isTruthy(value: ExpressionValue): boolean {
  switch (value.t) {
    case "null":
      return false;
    case "bool":
      return value.v;
    case "num":
      return value.v !== 0;
    case "str":
      return value.v !== "";
    case "list":
      return value.items.length > 0;
    default:
      return true;
  }
}

function booleanText(text: string): boolean | null {
  const value = text.trim().toLowerCase();
  if (["是", "true", "1", "yes", "启用"].includes(value)) return true;
  if (["否", "false", "0", "no", "停用"].includes(value)) return false;
  return null;
}

const EPSILON = 1e-9;

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
}

/** Scalar equality (both non-null). */
function scalarEquals(a: ExpressionScalar, b: ExpressionScalar): boolean {
  if (a.t === "null" || b.t === "null") return a.t === b.t;
  if (b.t === "str" && a.t !== "str") return scalarEquals(b, a);
  if (b.t === "num" && a.t !== "num" && a.t !== "str") return scalarEquals(b, a);
  switch (a.t) {
    case "str": {
      switch (b.t) {
        case "str": {
          if (a.v === b.v) return true;
          const left = numericText(a.v);
          const right = numericText(b.v);
          return left !== null && right !== null && sameNumber(left, right);
        }
        case "num": {
          const number = numericText(a.v);
          return number !== null ? sameNumber(number, b.v) : false;
        }
        case "bool": {
          const flag = booleanText(a.v);
          return flag !== null && flag === b.v;
        }
        case "date": {
          const literal = parseDateLiteral(a.v);
          if (!literal) return a.v === scalarText(b);
          return truncate(b.ms, literal.precision) === truncate(literal.ms, literal.precision);
        }
        case "option":
          return a.v === b.label || a.v === String(b.value);
        case "ref":
          return a.v === b.name || a.v === b.id || (b.code !== null && a.v === b.code);
        default:
          return false;
      }
    }
    case "num": {
      switch (b.t) {
        case "num":
          return sameNumber(a.v, b.v);
        case "bool":
          return (a.v === 1 && b.v) || (a.v === 0 && !b.v);
        case "option": {
          const number = typeof b.value === "number" ? b.value : numericText(String(b.value));
          return (number !== null && sameNumber(number, a.v)) || b.label === String(a.v);
        }
        case "ref":
          return b.id === String(a.v) || b.code === String(a.v);
        default:
          return false;
      }
    }
    case "bool":
      return b.t === "bool" && a.v === b.v;
    case "date":
      if (b.t !== "date") return false;
      {
        const precision = coarser(a.precision, b.precision);
        return truncate(a.ms, precision) === truncate(b.ms, precision);
      }
    case "option":
      if (b.t === "option") return String(a.value) === String(b.value);
      return false;
    case "ref":
      if (b.t === "ref") return a.id === b.id;
      return false;
    default:
      return false;
  }
}

function listItems(value: ExpressionValue): ExpressionScalar[] {
  return value.t === "list" ? value.items : [value];
}

export function valuesEqual(a: ExpressionValue, b: ExpressionValue): boolean {
  if (isEmptyValue(a) || isEmptyValue(b)) return isEmptyValue(a) && isEmptyValue(b);
  if (a.t === "list" && b.t === "list") {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((item) => b.items.some((other) => scalarEquals(item, other))) && b.items.every((item) => a.items.some((other) => scalarEquals(item, other)));
  }
  return listItems(a).some((left) => listItems(b).some((right) => scalarEquals(left, right)));
}

function numberOf(value: ExpressionScalar): number | null {
  switch (value.t) {
    case "num":
      return value.v;
    case "str":
      return numericText(value.v);
    case "option":
      return typeof value.value === "number" ? value.value : numericText(String(value.value));
    case "bool":
      return value.v ? 1 : 0;
    default:
      return null;
  }
}

/** -1 / 0 / 1, or null when the two values cannot be ordered. */
function compareScalars(a: ExpressionScalar, b: ExpressionScalar): number | null {
  if (a.t === "null" || b.t === "null") return null;
  const sign = (difference: number) => (Math.abs(difference) <= EPSILON ? 0 : difference < 0 ? -1 : 1);
  if (a.t === "date" || b.t === "date") {
    if (a.t === "date" && b.t === "date") {
      const precision = coarser(a.precision, b.precision);
      return sign(truncate(a.ms, precision) - truncate(b.ms, precision));
    }
    const date = (a.t === "date" ? a : b) as Extract<ExpressionScalar, { t: "date" }>;
    const other = a.t === "date" ? b : a;
    if (other.t !== "str") return null;
    const literal = parseDateLiteral(other.v);
    if (!literal) return null;
    const result = sign(truncate(date.ms, literal.precision) - truncate(literal.ms, literal.precision));
    return a.t === "date" ? result : -result;
  }
  if (a.t === "str" && b.t === "str") {
    const left = numericText(a.v);
    const right = numericText(b.v);
    if (left !== null && right !== null) return sign(left - right);
    const leftDate = parseDateLiteral(a.v);
    const rightDate = parseDateLiteral(b.v);
    if (leftDate && rightDate) {
      const precision = coarser(leftDate.precision, rightDate.precision);
      return sign(truncate(leftDate.ms, precision) - truncate(rightDate.ms, precision));
    }
    return a.v === b.v ? 0 : a.v < b.v ? -1 : 1;
  }
  const left = numberOf(a);
  const right = numberOf(b);
  if (left !== null && right !== null) return sign(left - right);
  return null;
}

function compareValues(operator: ">" | ">=" | "<" | "<=", a: ExpressionValue, b: ExpressionValue): boolean {
  return listItems(a).some((left) =>
    listItems(b).some((right) => {
      const result = compareScalars(left, right);
      if (result === null) return false;
      switch (operator) {
        case ">":
          return result > 0;
        case ">=":
          return result >= 0;
        case "<":
          return result < 0;
        default:
          return result <= 0;
      }
    }),
  );
}

function likeMatches(value: ExpressionValue, pattern: ExpressionValue): boolean {
  if (isEmptyValue(pattern)) return true;
  const needle = expressionValueText(pattern).toLowerCase();
  const matcher = /[%_]/.test(needle)
    ? new RegExp(
        `^${needle
          .split("")
          .map((char) => (char === "%" ? "[\\s\\S]*" : char === "_" ? "[\\s\\S]" : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
          .join("")}$`,
      )
    : null;
  return listItems(value).some((item) => {
    if (item.t === "null") return false;
    const text = scalarText(item).toLowerCase();
    return matcher ? matcher.test(text) : text.includes(needle);
  });
}

export type VariableResolver = (ref: VariableRef) => ExpressionValue;

function snippet(source: string, node: ExpressionNode): string {
  const text = source.slice(node.start, node.end).replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/** Evaluate to a value. Throws ExpressionEvalError on type problems or unknown variables. */
export function evaluateNode(source: string, node: ExpressionNode, resolve: VariableResolver): ExpressionValue {
  switch (node.kind) {
    case "literal":
      if (node.value === null) return EXPR_NULL;
      if (typeof node.value === "boolean") return exprValue.bool(node.value);
      if (typeof node.value === "number") return exprValue.num(node.value);
      return exprValue.str(node.value);
    case "variable":
      return resolve({ path: node.path, raw: node.raw, start: node.start, end: node.end });
    case "unary": {
      const operand = evaluateNode(source, node.operand, resolve);
      if (node.operator === "!") return exprValue.bool(!isTruthy(operand));
      if (isEmptyValue(operand)) return EXPR_NULL;
      const number = operand.t === "list" ? null : numberOf(operand);
      if (number === null || operand.t === "bool") throw new ExpressionEvalError(`「${snippet(source, node.operand)}」不是数字，不能取负`);
      return exprValue.num(-number);
    }
    case "binary":
      return evaluateBinary(source, node, resolve);
    case "call": {
      const [first, ...rest] = node.args.map((arg) => evaluateNode(source, arg, resolve));
      switch (node.name) {
        case "IN":
        case "NOT_IN": {
          const found = rest.some((candidate) => listItems(candidate).some((item) => valuesEqual(first, item)));
          return exprValue.bool(node.name === "IN" ? found : !found);
        }
        default: {
          const matched = likeMatches(first, rest[0]);
          return exprValue.bool(node.name === "LIKE" ? matched : !matched);
        }
      }
    }
    default:
      return EXPR_NULL;
  }
}

function evaluateBinary(source: string, node: Extract<ExpressionNode, { kind: "binary" }>, resolve: VariableResolver): ExpressionValue {
  const { operator } = node;
  if (operator === "&&") {
    const left = evaluateNode(source, node.left, resolve);
    if (!isTruthy(left)) return exprValue.bool(false);
    return exprValue.bool(isTruthy(evaluateNode(source, node.right, resolve)));
  }
  if (operator === "||") {
    const left = evaluateNode(source, node.left, resolve);
    if (isTruthy(left)) return exprValue.bool(true);
    return exprValue.bool(isTruthy(evaluateNode(source, node.right, resolve)));
  }
  const left = evaluateNode(source, node.left, resolve);
  const right = evaluateNode(source, node.right, resolve);
  switch (operator) {
    case "==":
      return exprValue.bool(valuesEqual(left, right));
    case "!=":
      return exprValue.bool(!valuesEqual(left, right));
    case ">":
    case ">=":
    case "<":
    case "<=":
      return exprValue.bool(compareValues(operator, left, right));
    default:
      return arithmetic(source, node, left, right);
  }
}

function arithmetic(
  source: string,
  node: Extract<ExpressionNode, { kind: "binary" }>,
  left: ExpressionValue,
  right: ExpressionValue,
): ExpressionValue {
  const { operator } = node;
  if (left.t === "list" || right.t === "list") {
    throw new ExpressionEvalError(`多值字段不能参与运算「${operator}」：${snippet(source, left.t === "list" ? node.left : node.right)}`);
  }
  if (operator === "+" && (left.t === "str" || right.t === "str") && (numberOf(left) === null || numberOf(right) === null)) {
    return exprValue.str(`${scalarText(left)}${scalarText(right)}`);
  }
  if (left.t === "null" || right.t === "null") return EXPR_NULL;
  if (left.t === "date" || right.t === "date") {
    if (left.t === "date" && right.t === "date" && operator === "-") return exprValue.num((left.ms - right.ms) / DAY_MS);
    const date = left.t === "date" ? left : right.t === "date" ? right : null;
    const other = left.t === "date" ? right : left;
    const days = numberOf(other);
    if (date && date.t === "date" && days !== null && (operator === "+" || (operator === "-" && left.t === "date"))) {
      return exprValue.date(date.ms + (operator === "+" ? days : -days) * DAY_MS, date.precision);
    }
    throw new ExpressionEvalError(`日期不能进行运算「${operator}」：${snippet(source, node)}`);
  }
  const a = left.t === "bool" ? null : numberOf(left);
  const b = right.t === "bool" ? null : numberOf(right);
  if (a === null) throw new ExpressionEvalError(`运算「${operator}」只能用于数字，「${snippet(source, node.left)}」不是数字`);
  if (b === null) throw new ExpressionEvalError(`运算「${operator}」只能用于数字，「${snippet(source, node.right)}」不是数字`);
  switch (operator) {
    case "+":
      return exprValue.num(a + b);
    case "-":
      return exprValue.num(a - b);
    case "*":
      return exprValue.num(a * b);
    default:
      return b === 0 ? EXPR_NULL : exprValue.num(a / b);
  }
}

/**
 * Evaluate a parsed condition. An empty expression (null AST) is true.
 * Throws ExpressionEvalError on runtime problems.
 */
export function evaluateExpression(source: string, ast: ExpressionNode | null, resolve: VariableResolver): boolean {
  if (!ast) return true;
  return isTruthy(evaluateNode(source, ast, resolve));
}
