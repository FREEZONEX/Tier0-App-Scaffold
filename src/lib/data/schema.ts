/**
 * Zod 4 → UNS record schema normalizer, plus write-time validation.
 *
 * UNS stores one closed JSON-schema subset per collection: `type`,
 * `properties`, `required`, `additionalProperties: false`, `items`, `enum`,
 * `minimum`, `maximum`, `title`, `description`. `toRecordSchema` converts the
 * `z.toJSONSchema` output into exactly that subset and rejects every other
 * keyword with a concrete replacement, so a declaration that cannot be stored
 * fails `npm run build` (src/lib/data-contracts.test.mjs) instead of the first
 * request.
 */
import { z } from "zod";
import { ALIAS_PATTERN, type CollectionDefinition, type IndexSpec } from "./define";

export type RecordSchemaType = "object" | "array" | "string" | "number" | "integer" | "boolean";
export type EnumValue = string | number | boolean;

export interface RecordSchema {
  type: RecordSchemaType;
  title?: string;
  description?: string;
  properties?: Record<string, RecordSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: RecordSchema;
  enum?: EnumValue[];
  minimum?: number;
  maximum?: number;
}

export interface NormalizedIndex {
  path?: string;
  paths?: string[];
  unique?: true;
  kind?: "gin";
}

/** One ensure item, exactly as it is sent to `/uns/app/collections/ensure`. */
export interface CompiledCollection {
  alias: string;
  recordSchema: RecordSchema;
  indexes: NormalizedIndex[];
  description?: string;
}

export interface SchemaIssue {
  path: string;
  message: string;
}

export class CollectionSchemaError extends Error {
  readonly alias: string;
  readonly issues: SchemaIssue[];

  constructor(alias: string, issues: SchemaIssue[]) {
    super(
      [
        `Collection "${alias}" cannot be stored in UNS:`,
        ...issues.map((issue) => `  - ${issue.path || "(root)"}: ${issue.message}`),
      ].join("\n"),
    );
    this.name = "CollectionSchemaError";
    this.alias = alias;
    this.issues = issues;
  }
}

/** UNS limits (unsmeta Schema.validate and collection indexes); title/description are UTF-8 bytes. */
export const SCHEMA_LIMITS = {
  depth: 8,
  properties: 128,
  enumValues: 100,
  title: 512,
  description: 2048,
  indexes: 16,
  indexPaths: 3,
} as const;

const SAFE_INTEGER_BOUND = Number.MAX_SAFE_INTEGER;
const SCHEMA_TYPES = new Set<string>(["object", "array", "string", "number", "integer", "boolean"]);
const KEPT_KEYWORDS = new Set([
  "type",
  "title",
  "description",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "enum",
  "minimum",
  "maximum",
]);
const RESERVED_FIELDS = new Set(["_id", "_meta"]);

const NULLABLE_HINT =
  "`.nullable()`, `.nullish()` and `z.union()` are not storable. Make the field `.optional()` and leave it out instead of storing null; model alternatives as one type or as separate optional fields.";
const API_INPUT_HINT = "Keep the collection schema plain and enforce this rule in the API input schema (see AGENTS.md → App Data).";
const OPEN_OBJECT_HINT =
  "`z.record()`, `z.looseObject()` and `.catchall()` are not storable: every stored object is closed. Declare fixed properties, or store an array of `{ key, value }` objects.";

const KEYWORD_HINTS: Record<string, string> = {
  anyOf: NULLABLE_HINT,
  oneOf: NULLABLE_HINT,
  allOf: "`z.intersection()` / `.and()` is not storable. Merge the objects with `.extend()`.",
  not: "Negated schemas are not storable.",
  default: "`.default()` / `.prefault()` / `.catch()` is not storable. Apply defaults in the service when building the document.",
  format: `String formats (\`z.email()\`, \`z.uuid()\`, \`z.iso.datetime()\`...) are not storable. Use \`z.string()\`: store instants as ISO-8601 UTC strings from \`toISOString()\` and dates as "YYYY-MM-DD". ${API_INPUT_HINT}`,
  pattern: `\`.regex()\`, \`.startsWith()\` and similar patterns are not storable. Use \`z.string()\`. ${API_INPUT_HINT}`,
  minLength: `String length limits are not storable. Use \`z.string()\`. ${API_INPUT_HINT}`,
  maxLength: `String length limits are not storable. Use \`z.string()\`. ${API_INPUT_HINT}`,
  contentEncoding: "Encoded string content is not storable. Use `z.string()`.",
  const: "`z.literal()` is not storable. Use `z.enum([...])`.",
  exclusiveMinimum: "`.gt()` / `.positive()` (exclusive bounds) are not storable. Use inclusive `.min()` (`.min(1)` for a positive integer).",
  exclusiveMaximum: "`.lt()` / `.negative()` are not storable. Use inclusive `.max()`.",
  multipleOf: `\`.multipleOf()\` / \`.step()\` is not storable. ${API_INPUT_HINT}`,
  minItems: `Array length limits are not storable. ${API_INPUT_HINT}`,
  maxItems: `Array length limits are not storable. ${API_INPUT_HINT}`,
  uniqueItems: `Array uniqueness is not storable. ${API_INPUT_HINT}`,
  prefixItems: "`z.tuple()` is not storable. Use an object with named fields.",
  propertyNames: OPEN_OBJECT_HINT,
  patternProperties: OPEN_OBJECT_HINT,
  minProperties: OPEN_OBJECT_HINT,
  maxProperties: OPEN_OBJECT_HINT,
  $ref: "Recursive or shared `$ref` schemas are not storable. Inline the structure or keep child records in their own collection.",
  $defs: "Recursive or shared `$ref` schemas are not storable. Inline the structure or keep child records in their own collection.",
  readOnly: "`.readonly()` is not storable; remove it from the collection schema.",
};

type JsonNode = Record<string, unknown>;

const encoder = new TextEncoder();

function utf8Bytes(value: string): number {
  return encoder.encode(value).length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinPath(base: string, key: string | number): string {
  if (typeof key === "number") return `${base}[${key}]`;
  return base ? `${base}.${key}` : key;
}

function validFieldName(key: string): string | null {
  if (RESERVED_FIELDS.has(key)) return `"${key}" is a system field and cannot be declared.`;
  if (key.length === 0 || key === "[]") return `Field name "${key}" is reserved.`;
  if (/[.$\\]/.test(key)) return `Field name "${key}" must not contain ".", "$" or "\\".`;
  return null;
}

function inferEnumType(values: unknown[]): RecordSchemaType | null {
  if (values.length === 0) return null;
  if (values.every((value) => typeof value === "string")) return "string";
  if (values.every((value) => typeof value === "boolean")) return "boolean";
  if (values.every((value) => typeof value === "number")) {
    return values.every((value) => Number.isInteger(value)) ? "integer" : "number";
  }
  return null;
}

function normalizeNode(node: unknown, path: string, depth: number, issues: SchemaIssue[]): RecordSchema | null {
  if (!isPlainObject(node)) {
    issues.push({ path, message: "Expected a schema object." });
    return null;
  }
  if (depth > SCHEMA_LIMITS.depth) {
    issues.push({ path, message: `Nesting deeper than ${SCHEMA_LIMITS.depth} levels is not storable. Flatten the structure.` });
    return null;
  }

  let valid = true;
  for (const key of Object.keys(node)) {
    if (KEPT_KEYWORDS.has(key) || (depth === 0 && key === "$schema")) continue;
    valid = false;
    issues.push({
      path,
      message: `\`${key}\` is not supported. ${KEYWORD_HINTS[key] ?? "Only type, properties, items, enum, minimum, maximum, title and description are storable; remove this constraint from the collection schema."}`,
    });
  }

  const rawEnum = Array.isArray(node.enum) ? node.enum : undefined;
  let type = node.type;
  if (type === undefined && rawEnum) type = inferEnumType(rawEnum) ?? undefined;
  if (Array.isArray(type)) {
    issues.push({ path, message: `A field must have one type, got [${type.join(", ")}]. ${NULLABLE_HINT}` });
    return null;
  }
  if (type === "null") {
    issues.push({ path, message: "`z.null()` is not storable. Make the field optional and leave it out." });
    return null;
  }
  if (typeof type !== "string" || !SCHEMA_TYPES.has(type)) {
    if (type === undefined && !("anyOf" in node) && !("oneOf" in node) && !("allOf" in node)) {
      issues.push({
        path,
        message: "Every field needs a concrete type; `z.any()`, `z.unknown()` and `z.json()` are not storable. Declare the actual shape.",
      });
    }
    return null;
  }

  const out: RecordSchema = { type: type as RecordSchemaType };
  for (const key of ["title", "description"] as const) {
    const value = node[key];
    if (value === undefined) continue;
    const limit = key === "title" ? SCHEMA_LIMITS.title : SCHEMA_LIMITS.description;
    // UNS measures these with Go len(): UTF-8 bytes, so CJK text uses 3 per character.
    if (typeof value !== "string" || utf8Bytes(value) > limit) {
      issues.push({ path, message: `\`${key}\` must be a string of at most ${limit} UTF-8 bytes.` });
      valid = false;
    } else if (value) {
      out[key] = value;
    }
  }

  if (type === "object") {
    if (node.additionalProperties !== undefined && node.additionalProperties !== false) {
      issues.push({ path, message: OPEN_OBJECT_HINT });
      valid = false;
    }
    const rawProperties = isPlainObject(node.properties) ? node.properties : {};
    const names = Object.keys(rawProperties);
    if (names.length > SCHEMA_LIMITS.properties) {
      issues.push({ path, message: `More than ${SCHEMA_LIMITS.properties} properties is not storable. Split the object.` });
      valid = false;
    }
    const properties: Record<string, RecordSchema> = {};
    for (const name of names) {
      const fieldPath = joinPath(path, name);
      const nameProblem = validFieldName(name);
      if (nameProblem) {
        issues.push({ path: fieldPath, message: nameProblem });
        valid = false;
        continue;
      }
      const child = normalizeNode(rawProperties[name], fieldPath, depth + 1, issues);
      if (child) properties[name] = child;
      else valid = false;
    }
    out.properties = properties;
    const required = Array.isArray(node.required)
      ? [...new Set(node.required.filter((name): name is string => typeof name === "string" && name in rawProperties))].sort()
      : [];
    if (required.length > 0) out.required = required;
    out.additionalProperties = false;
  } else if (node.properties !== undefined || node.required !== undefined || node.additionalProperties !== undefined) {
    issues.push({ path, message: "Only objects may declare properties." });
    valid = false;
  }

  if (type === "array") {
    const items = node.items;
    if (!isPlainObject(items)) {
      issues.push({ path, message: "Arrays need one item schema (`z.array(item)`)." });
      valid = false;
    } else {
      const child = normalizeNode(items, `${path}[]`, depth + 1, issues);
      if (child) out.items = child;
      else valid = false;
    }
  }

  if (rawEnum) {
    const values: EnumValue[] = [];
    for (const value of rawEnum) {
      const scalar = typeof value === "string" || typeof value === "number" || typeof value === "boolean";
      const fits =
        scalar &&
        (type === "string"
          ? typeof value === "string"
          : type === "boolean"
            ? typeof value === "boolean"
            : type === "integer"
              ? Number.isInteger(value)
              : type === "number"
                ? typeof value === "number"
                : false);
      if (!fits) {
        issues.push({ path, message: `Enum value ${JSON.stringify(value)} does not match type ${type}.` });
        valid = false;
      } else if (!values.some((existing) => existing === value)) {
        values.push(value as EnumValue);
      }
    }
    if (values.length > SCHEMA_LIMITS.enumValues) {
      issues.push({ path, message: `More than ${SCHEMA_LIMITS.enumValues} enum values is not storable. Use a reference collection.` });
      valid = false;
    }
    if (values.length > 0) out.enum = values;
  }

  for (const key of ["minimum", "maximum"] as const) {
    const value = node[key];
    if (value === undefined) continue;
    if (type !== "number" && type !== "integer") {
      issues.push({ path, message: `\`${key}\` is only valid on numbers.` });
      valid = false;
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ path, message: `\`${key}\` must be a finite number.` });
      valid = false;
      continue;
    }
    // z.number().int() always emits the safe-integer range; it is not a business bound.
    if (type === "integer" && Math.abs(value) === SAFE_INTEGER_BOUND) continue;
    out[key] = value;
  }
  if (out.minimum !== undefined && out.maximum !== undefined && out.minimum > out.maximum) {
    issues.push({ path, message: "`minimum` is greater than `maximum`." });
    valid = false;
  }

  return valid ? out : null;
}

/** Raw `z.toJSONSchema` output; exported for the snapshot tests. */
export function zodJsonSchema(schema: z.ZodType): JsonNode {
  return z.toJSONSchema(schema, { io: "output", unrepresentable: "throw", cycles: "throw" }) as JsonNode;
}

/** Converts a Zod object schema to the UNS record-schema subset or throws `CollectionSchemaError`. */
export function toRecordSchema(alias: string, schema: z.ZodType): RecordSchema {
  let raw: JsonNode;
  try {
    raw = zodJsonSchema(schema);
  } catch (error) {
    throw new CollectionSchemaError(alias, [
      {
        path: "",
        message: `${error instanceof Error ? error.message : String(error)}. \`z.date()\`, \`z.bigint()\`, \`.transform()\`, \`z.map()\`, \`z.set()\`, \`z.custom()\` and recursive schemas are not storable; store instants as ISO-8601 UTC strings from \`toISOString()\` and dates as "YYYY-MM-DD" strings, and keep transforms in the API input schema.`,
      },
    ]);
  }
  const issues: SchemaIssue[] = [];
  const normalized = normalizeNode(raw, "", 0, issues);
  if (normalized && normalized.type !== "object") {
    issues.push({ path: "", message: "A collection schema must be `z.object({...})`." });
  }
  if (issues.length > 0 || !normalized) throw new CollectionSchemaError(alias, issues);
  return normalized;
}

/** Resolves a dotted business path in a record schema; array levels accept index segments. */
export function recordSchemaAt(schema: RecordSchema, path: string): RecordSchema | undefined {
  let current: RecordSchema | undefined = schema;
  for (const segment of path.split(".")) {
    if (!current) return undefined;
    if (current.type === "array" && isArraySegment(segment)) {
      current = current.items;
    } else if (current.type === "object") {
      current = current.properties?.[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function isArraySegment(segment: string): boolean {
  return /^(?:\d+|\$|\$\[[A-Za-z0-9_]*\])$/.test(segment);
}

/**
 * Index paths follow object properties only: a path that continues past an
 * array (`items.sku`) would index values inside array items, which UNS
 * expression indexes cannot do.
 */
function indexPathProblem(alias: string, schema: RecordSchema, path: string, kind: "btree" | "gin"): string | null {
  const segments = path.split(".");
  let current: RecordSchema | undefined = schema;
  for (const [position, segment] of segments.entries()) {
    if (current?.type === "array") {
      const arrayPath = segments.slice(0, position).join(".");
      return `"${path}" reaches into the items of array "${arrayPath}"; index the array itself with kind: "gin", or copy the value to a top-level field.`;
    }
    current = current?.type === "object" ? current.properties?.[segment] : undefined;
    if (!current) return `"${path}" is not a declared field of "${alias}".`;
  }
  const target = current as RecordSchema;
  if (kind === "btree" && (target.type === "object" || target.type === "array")) {
    return `"${path}" is an ${target.type}; index a scalar field or use kind: "gin".`;
  }
  if (kind === "gin" && target.type !== "object" && target.type !== "array") {
    return `"${path}" is a ${target.type}; a GIN index covers an object or array field.`;
  }
  return null;
}

function normalizeIndexes(alias: string, indexes: readonly IndexSpec[], schema: RecordSchema, issues: SchemaIssue[]): NormalizedIndex[] {
  const out: NormalizedIndex[] = [];
  const seen = new Set<string>();
  if (indexes.length > SCHEMA_LIMITS.indexes) {
    issues.push({ path: "indexes", message: `At most ${SCHEMA_LIMITS.indexes} indexes per collection.` });
  }
  indexes.forEach((index, position) => {
    const at = `indexes[${position}]`;
    const paths = index.paths ?? (index.path !== undefined ? [index.path] : []);
    if ((index.path !== undefined) === (index.paths !== undefined)) {
      issues.push({ path: at, message: "Set exactly one of `path` or `paths`." });
      return;
    }
    if (paths.length === 0 || paths.length > SCHEMA_LIMITS.indexPaths) {
      issues.push({ path: at, message: `A compound index has 1–${SCHEMA_LIMITS.indexPaths} paths.` });
      return;
    }
    const kind = index.kind ?? "btree";
    if (kind !== "btree" && kind !== "gin") {
      issues.push({ path: at, message: '`kind` is "btree" or "gin".' });
      return;
    }
    if (kind === "gin" && (paths.length !== 1 || index.unique)) {
      issues.push({ path: at, message: "A GIN index covers one object/array path and cannot be unique." });
      return;
    }
    if (new Set(paths).size !== paths.length) {
      issues.push({ path: at, message: "A compound index lists each path once." });
      return;
    }
    for (const fieldPath of paths) {
      const problem = indexPathProblem(alias, schema, fieldPath, kind);
      if (problem) {
        issues.push({ path: at, message: problem });
        return;
      }
    }
    const normalized: NormalizedIndex = index.paths ? { paths: [...paths] } : { path: paths[0] };
    if (index.unique) normalized.unique = true;
    if (kind === "gin") normalized.kind = "gin";
    const key = JSON.stringify(normalized);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(normalized);
    }
  });
  return out;
}

const compiled = new WeakMap<CollectionDefinition, CompiledCollection>();

/** Ensure payload for one declaration; memoized per definition object. */
export function compileCollection(definition: CollectionDefinition): CompiledCollection {
  const cached = compiled.get(definition);
  if (cached) return cached;
  if (!ALIAS_PATTERN.test(definition.alias)) {
    throw new CollectionSchemaError(definition.alias, [{ path: "alias", message: `Alias must match ${ALIAS_PATTERN}.` }]);
  }
  const recordSchema = toRecordSchema(definition.alias, definition.schema);
  const issues: SchemaIssue[] = [];
  const indexes = normalizeIndexes(definition.alias, definition.indexes, recordSchema, issues);
  if (issues.length > 0) throw new CollectionSchemaError(definition.alias, issues);
  const result: CompiledCollection = {
    alias: definition.alias,
    recordSchema,
    indexes,
    ...(definition.description ? { description: definition.description } : {}),
  };
  compiled.set(definition, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* Write validation                                                    */
/* ------------------------------------------------------------------ */

type IssuePath = (string | number)[];

function unknownKeyIssues(schema: RecordSchema | undefined, value: unknown, path: IssuePath, out: z.core.$ZodIssue[]) {
  if (!schema) return;
  if (schema.type === "object" && isPlainObject(value)) {
    const properties = schema.properties ?? {};
    const unknown = Object.keys(value).filter((key) => !(key in properties));
    if (unknown.length > 0) {
      out.push({
        code: "unrecognized_keys",
        keys: unknown,
        path,
        message: `Unknown field${unknown.length > 1 ? "s" : ""} ${unknown.map((key) => `"${key}"`).join(", ")}: declare ${unknown.length > 1 ? "them" : "it"} in src/data/collections.ts first.`,
        input: value,
      } as z.core.$ZodIssue);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key in properties) unknownKeyIssues(properties[key], child, [...path, key], out);
    }
  } else if (schema.type === "array" && Array.isArray(value)) {
    value.forEach((item, index) => unknownKeyIssues(schema.items, item, [...path, index], out));
  }
}

function strictParse<T>(zodSchema: z.ZodType<T>, recordSchema: RecordSchema | undefined, value: unknown, path: IssuePath): T {
  const issues: z.core.$ZodIssue[] = [];
  unknownKeyIssues(recordSchema, value, path, issues);
  const result = zodSchema.safeParse(value);
  if (!result.success) {
    for (const issue of result.error.issues) issues.push({ ...issue, path: [...path, ...issue.path] } as z.core.$ZodIssue);
  }
  if (issues.length > 0) throw new z.ZodError(issues);
  return result.data as T;
}

function zodAt(schema: z.ZodType, path: string): z.ZodType | undefined {
  let current: z.ZodType | undefined = schema;
  for (const segment of path.split(".")) {
    while (current instanceof z.ZodOptional) current = current.unwrap() as z.ZodType;
    if (current instanceof z.ZodObject) {
      current = (current.shape as Record<string, z.ZodType>)[segment];
    } else if (current instanceof z.ZodArray && isArraySegment(segment)) {
      current = current.element as z.ZodType;
    } else {
      return undefined;
    }
    if (!current) return undefined;
  }
  return current;
}

function validationError(path: IssuePath, message: string, input: unknown): z.ZodError {
  return new z.ZodError([{ code: "custom", path, message, input } as z.core.$ZodIssue]);
}

/** Splits `_id` / `_meta` off a document and strictly validates the body. */
export function validateDocument(
  definition: CollectionDefinition,
  document: Record<string, unknown>,
): { id?: string; data: Record<string, unknown> } {
  if (!isPlainObject(document)) throw validationError([], "Expected a document object.", document);
  const { _id, _meta, ...body } = document;
  void _meta;
  if (_id !== undefined && (typeof _id !== "string" || _id.length === 0 || _id.length > 128)) {
    throw validationError(["_id"], "`_id` must be a string of 1–128 characters.", _id);
  }
  const { recordSchema } = compileCollection(definition);
  const data = strictParse(definition.schema, recordSchema, body, []) as Record<string, unknown>;
  return { ...(typeof _id === "string" ? { id: _id } : {}), data };
}

/**
 * Validates `data` of a transaction step. Fields filled by `bindings`
 * (`data.<field>...`) are checked only for being declared; every literal
 * field is strictly validated, and other required fields must be present.
 */
export function validateStepData(
  definition: CollectionDefinition,
  data: Record<string, unknown>,
  boundFields: readonly string[],
): Record<string, unknown> {
  if (!isPlainObject(data)) throw validationError(["data"], "Expected a document object.", data);
  if ("_id" in data || "_meta" in data) {
    throw validationError(["data", "_id" in data ? "_id" : "_meta"], "A transaction step sets the record ID with `id`, not `data._id`; `_meta` is read-only.", data);
  }
  const { recordSchema } = compileCollection(definition);
  const properties = recordSchema.properties ?? {};
  const bound = new Set(boundFields.filter((field) => field in properties));
  const unknownBound = boundFields.filter((field) => !(field in properties));
  if (unknownBound.length > 0) {
    throw validationError(["bindings"], `Bound field${unknownBound.length > 1 ? "s" : ""} ${unknownBound.join(", ")} not declared in "${definition.alias}".`, boundFields);
  }
  if (bound.size === 0) return strictParse(definition.schema, recordSchema, data, ["data"]) as Record<string, unknown>;

  const literal = Object.fromEntries(Object.entries(data).filter(([key]) => !bound.has(key)));
  const omit = Object.fromEntries([...bound].map((field) => [field, true as const]));
  const literalSchema: RecordSchema = {
    ...recordSchema,
    properties: Object.fromEntries(Object.entries(properties).filter(([key]) => !bound.has(key))),
    required: recordSchema.required?.filter((key) => !bound.has(key)),
  };
  const parsed = strictParse(definition.schema.omit(omit as never), literalSchema, literal, ["data"]) as Record<string, unknown>;
  const boundValues = Object.fromEntries(Object.entries(data).filter(([key]) => bound.has(key)));
  return { ...parsed, ...boundValues };
}

const VALUE_OPERATORS = new Set(["$set", "$setOnInsert"]);
const ELEMENT_OPERATORS = new Set(["$push", "$addToSet"]);
const NUMERIC_OPERATORS = new Set(["$inc", "$mul"]);

/** Validates update-operator documents against the declaration (paths and values). */
export function validateUpdate(definition: CollectionDefinition, update: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(update) || Object.keys(update).length === 0) {
    throw validationError([], "An update needs at least one operator such as `$set`.", update);
  }
  const { recordSchema } = compileCollection(definition);
  const out: Record<string, unknown> = {};

  for (const [operator, fields] of Object.entries(update)) {
    if (!operator.startsWith("$")) {
      throw validationError([operator], "Updates use operators (`{ $set: { status: \"DONE\" } }`); use replaceOne() to replace a whole document.", update);
    }
    if (!isPlainObject(fields)) throw validationError([operator], `\`${operator}\` takes an object of field paths.`, fields);
    const next: Record<string, unknown> = {};

    for (const [path, value] of Object.entries(fields)) {
      const issuePath = [operator, path];
      if (path === "_id" || path === "_meta" || path.startsWith("_meta.")) {
        throw validationError(issuePath, "`_id` and `_meta` are read-only.", value);
      }
      const target = recordSchemaAt(recordSchema, path);
      const zodTarget = zodAt(definition.schema, path);
      if (!target || !zodTarget) {
        throw validationError(issuePath, `"${path}" is not a declared field of "${definition.alias}".`, value);
      }

      if (VALUE_OPERATORS.has(operator)) {
        if (value === undefined) continue;
        next[path] = strictParse(zodTarget, target, value, issuePath);
      } else if (ELEMENT_OPERATORS.has(operator)) {
        const element = zodTarget instanceof z.ZodOptional ? zodTarget.unwrap() : zodTarget;
        if (target.type !== "array" || !(element instanceof z.ZodArray)) {
          throw validationError(issuePath, `\`${operator}\` needs an array field; "${path}" is ${target.type}.`, value);
        }
        const each = isPlainObject(value) && Array.isArray(value.$each);
        const items = each ? ((value as { $each: unknown[] }).$each) : [value];
        const parsed = items.map((item, index) =>
          strictParse(element.element as z.ZodType, target.items, item, each ? [...issuePath, "$each", index] : issuePath),
        );
        next[path] = each ? { ...(value as Record<string, unknown>), $each: parsed } : parsed[0];
      } else if (NUMERIC_OPERATORS.has(operator)) {
        if (target.type !== "number" && target.type !== "integer") {
          throw validationError(issuePath, `\`${operator}\` needs a numeric field; "${path}" is ${target.type}.`, value);
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
          throw validationError(issuePath, `\`${operator}\` needs a finite number.`, value);
        }
        next[path] = value;
      } else if (operator === "$rename") {
        if (typeof value !== "string" || !recordSchemaAt(recordSchema, value)) {
          throw validationError(issuePath, `\`$rename\` target "${String(value)}" is not a declared field.`, value);
        }
        next[path] = value;
      } else {
        // $unset, $min, $max, $currentDate, $pop, $pull, $pullAll: the path is
        // declared; UNS validates the resulting document.
        next[path] = value;
      }
    }
    if (Object.keys(next).length > 0) out[operator] = next;
  }
  if (Object.keys(out).length === 0) {
    throw validationError([], "Nothing to update: undefined values are dropped; clear a field with `$unset`.", update);
  }
  return out;
}
