# calendar-feeds

- The CI-like local check is `bun run check`.
- `notes/` is local-only: never commit it and never link to it from a tracked file.
- `data/wwe/events.json` and `data/wwe/checked.json` are written by the daily workflow, so `git pull` before editing anything under `data/`.
- Published file names (`calendars/wwe-ples.ics`, `calendars/chess-tournaments.ics`) and event ids must never change: subscribers hold them.
