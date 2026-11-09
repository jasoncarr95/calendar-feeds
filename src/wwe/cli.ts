/**
 * Refresh data/wwe/events.json from Wikipedia.
 *
 *   bun run sync                     fetch, merge, write the data file
 *   bun run sync --dry-run           fetch and print, write nothing
 *   bun run sync --debug             also print every table the parser looked at
 *   bun run sync --html=page.html    parse a saved file instead of fetching
 */
import { update } from "./sync";

const args = new Map(
  Bun.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);

const debug = args.has("debug") ? ([] as string[]) : undefined;

try {
  const { events, fromWikipedia, fromManual } = await update({
    dryRun: args.has("dry-run"),
    debug,
    ...(args.has("html") ? { html: await Bun.file(args.get("html")!).text() } : {}),
  });

  if (debug) console.log(debug.join("\n") + "\n");
  console.table(
    events.map(({ date, endDate, name, city, source }) => ({ date, endDate, name, city, source })),
  );
  console.log(`${fromWikipedia} from Wikipedia + ${fromManual} manual -> ${events.length} events`);
  if (args.has("dry-run")) console.log("(dry run — nothing written)");
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  if (debug) console.error("\n" + debug.join("\n"));
  process.exit(1);
}
