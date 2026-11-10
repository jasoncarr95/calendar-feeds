/**
 * Refresh data/wwe/events.json from Wikipedia.
 *
 *   bun run sync                     fetch, merge, write the data file and the checked stamp
 *   bun run sync --dry-run           fetch and print, write nothing
 *   bun run sync --debug             also print every table the parser looked at
 *   bun run sync --html=page.html    parse a saved file instead of fetching
 *
 * FORCE_SYNC_FAILURE=1 (or true) fails at once: the workflow uses it to test the failure email.
 */
import { syncWwe } from "./sync";

const force = process.env.FORCE_SYNC_FAILURE;
if (force === "1" || force === "true") {
  console.error("Forced failure (FORCE_SYNC_FAILURE)");
  process.exit(1);
}

const args = new Map(
  Bun.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"] as const;
  }),
);

const debug = args.has("debug") ? ([] as string[]) : undefined;

try {
  const { events, fromWikipedia, overrides, additions, changed } = await syncWwe({
    dryRun: args.has("dry-run"),
    debug,
    ...(args.has("html") ? { html: await Bun.file(args.get("html")!).text() } : {}),
  });

  if (debug) console.log(debug.join("\n") + "\n");
  console.table(
    events.map(({ date, endDate, name, city, source }) => ({ date, endDate, name, city, source })),
  );
  console.log(
    `${fromWikipedia} from Wikipedia, ${overrides} overrides, ${additions} additions -> ${events.length} events ` +
      `(${changed ? "schedule changed" : "no change"})`,
  );
  if (args.has("dry-run")) console.log("(dry run — nothing written)");
} catch (err) {
  console.error(String(err instanceof Error ? err.message : err));
  if (debug) console.error("\n" + debug.join("\n"));
  process.exit(1);
}
