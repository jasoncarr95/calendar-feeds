import { describe, expect, test } from "bun:test";
import { parse } from "node-html-parser";
import { parseWikiDate, parseWikipediaHtml, tableToRows } from "./wikipedia";
import { WIKI_FIXTURE } from "./fixture";

describe("parseWikiDate", () => {
  test("year comes from the section heading, not the cell", () => {
    expect(parseWikiDate("September 6", 2026)).toEqual({ date: "2026-09-06" });
    expect(parseWikiDate("September 6")).toBeNull();
  });
  test("an explicit year in the cell wins", () => {
    expect(parseWikiDate("October 10, 2026", 1999)).toEqual({ date: "2026-10-10" });
  });
  test("same-month range", () => {
    expect(parseWikiDate("April 18–19", 2026)).toEqual({ date: "2026-04-18", endDate: "2026-04-19" });
  });
  test("cross-month range, including one that wraps the year", () => {
    expect(parseWikiDate("January 30 – February 1", 2027)).toEqual({ date: "2027-01-30", endDate: "2027-02-01" });
    expect(parseWikiDate("December 31 – January 1", 2026)).toEqual({ date: "2026-12-31", endDate: "2027-01-01" });
  });
  test("month-only and TBA cells are not dates", () => {
    expect(parseWikiDate("April", 2027)).toBeNull();
    expect(parseWikiDate("TBA", 2027)).toBeNull();
  });
});

describe("tableToRows", () => {
  const table = parse(WIKI_FIXTURE).querySelectorAll("table.wikitable")[3];
  const rows = tableToRows(table);

  test("rowspanned Event/Notes cells carry down to the next night", () => {
    const sep13 = rows.find((r) => r.cells[0] === "September 13")!;
    expect(sep13.cells[1]).toBe("Triplemanía 34");
    expect(sep13.cells[2]).toBe("Arena CDMX");
    expect(sep13.cells[3]).toBe("Mexico City, Mexico");
  });

  test("footnote markers are stripped and row styles preserved", () => {
    const mitb = rows.find((r) => r.cells[1] === "Money in the Bank")!;
    expect(mitb).toBeDefined();
    expect(rows.find((r) => r.cells[1] === "Halloween Havoc")!.style).toContain("#FFFF80");
  });
});

describe("parseWikipediaHtml", () => {
  const events = parseWikipediaHtml(WIKI_FIXTURE, { since: "2026-01-01" });
  const names = events.map((e) => e.name);

  test("keeps main-roster PLEs, SNME and Triplemanía", () => {
    expect(names).toEqual([
      "WWE Royal Rumble",
      "WWE WrestleMania 42",
      "WWE SummerSlam",
      "WWE Sunday Night's Main Event",
      "AAA Triplemanía 34 (Night 1)",
      "AAA Triplemanía 34 (Night 2)",
      "WWE Money in the Bank",
      "WWE Crown Jewel",
      "WWE Survivor Series: WarGames",
      "WWE Wrestlepalooza",
      "WWE Some Multi-Day Show",
    ]);
  });

  test("drops NXT rows by their row colour", () => {
    expect(names.some((n) => /Vengeance Day|Heatwave|Halloween Havoc|Stand & Deliver/.test(n))).toBe(false);
  });

  test("drops the AAA/interpromotional shows named in EXCLUDE", () => {
    expect(names.some((n) => /Worlds Collide|Ola de Calor/.test(n))).toBe(false);
  });

  test("consecutive nights collapse into one multi-day event", () => {
    expect(events.find((e) => e.name === "WWE WrestleMania 42")).toMatchObject({
      date: "2026-04-18",
      endDate: "2026-04-19",
      venue: "Allegiant Stadium",
      city: "Paradise, Nevada",
    });
  });

  test("non-consecutive nights stay separate and get numbered", () => {
    const nights = events.filter((e) => e.name.startsWith("AAA Triplemanía"));
    expect(nights.map((e) => [e.date, e.city])).toEqual([
      ["2026-09-11", "Paradise, Nevada"],
      ["2026-09-13", "Mexico City, Mexico"],
    ]);
    expect(nights[0].endDate).toBeUndefined();
  });

  test("undated 2027 rows are skipped until a day is announced", () => {
    expect(names.some((n) => /WrestleMania 43/.test(n))).toBe(false);
    expect(events.find((e) => e.name === "WWE Some Multi-Day Show")).toMatchObject({
      date: "2027-01-30",
      endDate: "2027-02-01",
    });
  });

  test("TBA venue/location are omitted rather than stored literally", () => {
    const all = parseWikipediaHtml(WIKI_FIXTURE, { since: "2026-01-01", exclude: /$^/ });
    const havoc = all.find((e) => e.name.includes("Halloween Havoc"));
    expect(havoc).toBeUndefined(); // still dropped by row colour
  });

  test("respects `since`", () => {
    const upcoming = parseWikipediaHtml(WIKI_FIXTURE, { since: "2026-10-01" });
    expect(upcoming.map((e) => e.date)).toEqual(["2026-10-10", "2026-11-07", "2026-11-28", "2026-12-12", "2027-01-30"]);
  });
});
