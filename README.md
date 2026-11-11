# calendar-feeds

Two calendar subscription feeds, published on GitHub Pages and kept current by a daily GitHub Actions run:

| Feed | Address |
| --- | --- |
| WWE Premium Live Events (main roster, Saturday/Sunday Night's Main Event, AAA Triplemanía; no NXT) | `https://jasoncarr95.github.io/calendar-feeds/calendars/wwe-ples.ics` |
| Chess Tournaments (the big ones; today the 2026 World Chess Championship) | `https://jasoncarr95.github.io/calendar-feeds/calendars/chess-tournaments.ics` |

Landing page with a Subscribe button per feed: <https://jasoncarr95.github.io/calendar-feeds/>

These addresses never change. Neither do event ids: an event whose date and name are unchanged keeps the same identity on every rebuild, so calendars never show duplicates.

## Subscribe

On a Mac, open the landing page and click **Subscribe** for a feed. In Calendar's dialog:

- **Location: iCloud.** That is what puts the calendar on the iPhone too.
- **Leave "Remove Alerts" unticked** for Chess Tournaments. Each game has an alert 15 minutes before it starts; ticking the box strips them.
- Auto-refresh: every hour or less.

The WWE feed has no alerts.

If an alert shows on the Mac but not on the iPhone, look at the phone before the feed: Settings → Notifications → Calendar needs **Lock Screen**, **Notification Center** and **Banners** ticked. With all three off the phone stays silent even though the event shows its alert. A normal event with an alert, made on the phone, is the quick control test.

## How it works

- `data/wwe/events.json` is written by the daily sync from Wikipedia's list of WWE supercards. It is rewritten only when the schedule changes, so `git log -- data/wwe/events.json` is the history of schedule changes.
- `data/wwe/checked.json` is stamped by every successful sync.
- `data/chess/events.json` is edited by hand.
- `bun run build` turns both into `dist/`: the two `.ics` files, the landing page and `status.json`. `dist/` is never committed; the workflow deploys it to Pages.

The landing page shows two dates per feed. **Events last changed** is when the feed's data last changed. **Last checked** is when the automation last looked; if that date is old, the daily run has stopped. GitHub can start the scheduled run hours after its 09:17 UTC slot (the first one was 8 hours late), so only a date more than a day or two old means trouble.

## Add or edit a chess event

Edit `data/chess/events.json`, run `bun run check`, and push to `main`; the push publishes it (a failing check stops the publish). One entry:

```json
{
  "id": "fide-world-championship-2026-game-01",
  "name": "World Chess Championship — Game 1",
  "date": "2026-11-24",
  "startTime": "15:00",
  "timezone": "Europe/Zurich",
  "durationMinutes": 15,
  "alertMinutesBefore": 15,
  "venue": "Fondation Martin Bodmer, Route Martin-Bodmer 19, 1223 Cologny",
  "city": "Geneva, Switzerland",
  "url": "https://worldchampionship.fide.com/",
  "notes": "Free text shown in the event."
}
```

- `id`, `name` and `date` (`YYYY-MM-DD`) are required. **An id never changes once published**, and no two entries share one.
- A timed entry has `startTime` (`HH:MM`, local to the venue) and `timezone` (IANA name) together. `durationMinutes` defaults to 15. `alertMinutesBefore: 15` gives it the alert.
- An all-day entry leaves out `startTime`, `timezone`, `durationMinutes` and `alertMinutesBefore`; `endDate` (inclusive) makes it span several days.
- `"tentative": true` marks an entry that may not happen.

A mistake the check knows (a start time with no timezone, an alert on an all-day entry, a duplicate id, a date that does not exist) fails the build and names the entry instead of being published.

## Pin a WWE bell time

Wikipedia lists dates, not start times, so WWE events are all-day unless pinned. Add an entry to `overrides` in `data/wwe/manual.json`:

```json
{
  "overrides": [
    { "date": "2026-11-28", "name": "WWE Survivor Series: WarGames", "startTime": "19:00", "timezone": "America/New_York" }
  ],
  "additions": []
}
```

An override is matched to its event by `date` and `name`, and its other fields are laid over the synced event. If Wikipedia later moves or renames the show, the override matches nothing and **the sync fails on purpose**, naming the entry, rather than publishing a stale second event. Fix or remove the override and the next run recovers. Shows drop off the feed 60 days after they end; an override for one of those is ignored and can be deleted whenever.

`additions` is for a whole event Wikipedia does not list: give it its own `id`, `name` and `date`. An addition that duplicates a listed event is refused; use an override for that.

## Local commands

Needs [Bun](https://bun.sh).

```bash
bun install
bun run sync        # fetch Wikipedia, update data/wwe/ (--dry-run prints and writes nothing; --debug shows the tables it read)
bun run build       # write dist/
bun run check       # tests and type check
```

## When a run fails

GitHub emails about a failed run. Either way **the last good calendars stay published**:

- A WWE sync failure (Wikipedia could not be fetched or parsed, fewer than 3 events parsed, an override stopped matching) writes nothing. The run still deploys the last good calendars, and the landing page shows "Last check failed" beside the WWE feed until a run succeeds.
- An invalid data file or a failing test stops the run before it publishes, so the live site stays exactly as it was until the file is fixed.

To test the failure email: Actions → Update calendars → Run workflow, tick "Fail the WWE sync on purpose", run. Then run it once more without the tick to clear the failed state.
