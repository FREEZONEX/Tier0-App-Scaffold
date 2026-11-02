// Prints the normalized ensure payload for src/data/collections.ts.
//
//   npm run data:schema                 → {"collections":[...]} for appCollectionsEnsure
//   npm run data:schema -- work_orders  → one item ({alias, recordSchema, indexes}),
//                                          the base of an appCollectionsSchemaReplace body
//
// The output is exactly what the App's runtime bootstrap sends, so a worker can
// pass it to the tier0 MCP (`tier0_execute`) with `dryRun: true` before
// changing a declaration. Exits 1 when a declaration cannot be stored.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compileCollection } from "@tier0/sdk-v2/data";
import { assertCollectionDirectory } from "./collection-directory-contract.mjs";

const { collections } = await import(pathToFileURL(join(process.cwd(), "src/data/collections.ts")).href);

const alias = process.argv[2];
try {
  const payload = collections.map((definition) => compileCollection(definition));
  if (alias) {
    const item = payload.find((entry) => entry.alias.toLowerCase() === alias.toLowerCase());
    if (!item) {
      console.error(`[data:schema] no collection "${alias}"; declared: ${payload.map((entry) => entry.alias).join(", ") || "(none)"}`);
      process.exit(1);
    }
    // schema:replace 只更新结构，不接受或更改集合目录。
    const { directoryPath: _directoryPath, name: _name, ...schemaChange } = item;
    console.log(JSON.stringify(schemaChange, null, 2));
  } else {
    collections.forEach((definition, index) => assertCollectionDirectory(definition, payload[index]));
    console.log(JSON.stringify({ collections: payload }, null, 2));
  }
} catch (error) {
  console.error(`[data:schema] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
