export interface FeedStatus {
  slug: string;
  title: string;
  description: string;
  file: string;
  eventCount: number;
  /** ISO time the feed's events last changed */
  changedAt: string;
  /** ISO time the feed's source was last checked */
  checkedAt: string;
  checkFailed: boolean;
  hasAlerts: boolean;
}

/** The public address of the site. Subscribers hold these addresses, so it never changes. */
export const SITE_HOST = "jasoncarr95.github.io/calendar-feeds";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "9 Nov 2026, 00:00 UTC" */
function readableUtc(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

const time = (iso: string) => `<time datetime="${esc(iso)}">${readableUtc(iso)}</time>`;

function renderFeed(f: FeedStatus): string {
  const path = `${SITE_HOST}/calendars/${f.file}`;
  const failed = f.checkFailed ? ` <strong class="failed">Last check failed</strong>` : "";
  const alerts = f.hasAlerts
    ? `
      <p class="note">This calendar alerts you 15 minutes before each game. When you subscribe, choose <b>iCloud</b> as the location so your iPhone gets it too, and leave <b>Remove Alerts</b> unticked.</p>`
    : "";
  return `    <section class="feed" id="${esc(f.slug)}">
      <h2>${esc(f.title)}</h2>
      <p>${esc(f.description)}</p>
      <p class="subtle">${f.eventCount} ${f.eventCount === 1 ? "event" : "events"}</p>
      <div class="actions">
        <a class="button" href="webcal://${path}">Subscribe</a>
        <a class="plain" href="https://${path}">https://${path}</a>
      </div>${alerts}
      <dl>
        <div><dt>Events last changed</dt><dd>${time(f.changedAt)}</dd></div>
        <div><dt>Last checked</dt><dd>${time(f.checkedAt)}${failed}</dd></div>
      </dl>
    </section>`;
}

export function renderIndex(feeds: FeedStatus[], builtAt: Date): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Calendar Feeds</title>
  <style>
    :root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; padding: 2rem 1.25rem; line-height: 1.55; }
    main { max-width: 650px; margin: 3rem auto; }
    h1 { letter-spacing: -.035em; }
    h2 { margin: 0 0 .3rem; }
    .subtle, dt, footer { color: #757575; }
    .feed { border: 1px solid #aaa5; padding: 1.3rem 1.5rem; border-radius: 14px; margin-top: 1.5rem; }
    .feed p { margin: .3rem 0; }
    .actions { display: flex; gap: .7rem 1rem; flex-wrap: wrap; align-items: center; margin: 1.1rem 0; }
    a.button { display: inline-block; background: #4545bc; color: white; text-decoration: none; border-radius: 9px; padding: .7rem 1.1rem; font-weight: 600; }
    a.plain { font-size: .85rem; overflow-wrap: anywhere; }
    .note { font-size: .9rem; }
    dl { margin: 1rem 0 0; font-size: .9rem; }
    dl div { display: flex; flex-wrap: wrap; gap: 0 .6rem; }
    dt { min-width: 10.5em; }
    dd { margin: 0; }
    .failed { color: #c62828; margin-left: .4rem; }
    footer { margin-top: 2rem; font-size: .85rem; }
  </style>
</head>
<body>
  <main>
    <h1>Calendar Feeds</h1>
    <p>Read-only calendar subscriptions for Apple Calendar and other calendar apps. Subscribe once; each calendar keeps itself current.</p>
${feeds.map(renderFeed).join("\n")}
    <footer>
      <p>Built ${time(builtAt.toISOString())}. An old “Last checked” date means the daily update has stopped.</p>
    </footer>
  </main>
</body>
</html>
`;
}
