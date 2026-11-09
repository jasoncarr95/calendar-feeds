# calendar-feeds

- The CI-like local check is `bun run check`.
- `notes/` is local-only: never commit it and never link to it from a tracked file.
- The daily workflow commits `data/wwe/events.json` and `data/wwe/checked.json` to `main`, so `git pull` before committing anything.
- Published file names (`calendars/wwe-ples.ics`, `calendars/chess-tournaments.ics`) and event ids must never change: subscribers hold them.
