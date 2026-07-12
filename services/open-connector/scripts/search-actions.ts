import { loadCatalog } from "../src/catalog-store.ts";
import { DEFAULT_ACTION_SEARCH_LIMIT, buildActionSearchIndex, searchActions } from "../src/core/action-search.ts";

const options = parseOptions(process.argv.slice(2));
if (!options.query) {
  printUsageAndExit();
}

const catalog = await loadCatalog();
const index = buildActionSearchIndex(catalog.actions);
const results = searchActions(index, options.query, {
  service: options.service,
  limit: options.limit ?? DEFAULT_ACTION_SEARCH_LIMIT,
});

console.log(JSON.stringify(results, null, 2));

interface SearchActionOptions {
  query?: string;
  service?: string;
  limit?: number;
}

function parseOptions(args: string[]): SearchActionOptions {
  const options: SearchActionOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--query" || arg === "-q") {
      options.query = requireValue(arg, value);
    } else if (arg === "--service") {
      options.service = requireValue(arg, value);
    } else if (arg === "--limit") {
      const limit = Number(requireValue(arg, value));
      if (!Number.isInteger(limit) || limit < 1) {
        throw new Error("--limit must be a positive integer.");
      }
      options.limit = limit;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
    index += 1;
  }
  return options;
}

function requireValue(option: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function printUsageAndExit(): never {
  console.error(`Usage:
  node scripts/search-actions.ts --query "send mail gmail" [--service gmail] [--limit 10]`);
  process.exit(1);
}
