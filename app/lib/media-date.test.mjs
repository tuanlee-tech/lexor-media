import assert from "node:assert/strict";
import test from "node:test";
import { compareMediaDates, compareMediaDisplay, dateInTimeZone, hasManualOrder, insertIndexByDate, isValidMediaDate } from "./media-date.ts";

test("Shopify instants use the shop calendar date, including DST", () => {
  assert.equal(dateInTimeZone("2026-09-15T01:00:00Z", "America/Los_Angeles"), "2026-09-14");
  assert.equal(dateInTimeZone("2026-09-14T23:00:00Z", "Asia/Ho_Chi_Minh"), "2026-09-15");
  assert.equal(dateInTimeZone("2026-03-08T10:00:00Z", "America/Los_Angeles"), "2026-03-08");
});

test("dates allow clearing, reject future dates and validate the calendar", () => {
  for (const date of [null, undefined, "2024-02-29", "2026-09-15"]) {
    assert.equal(isValidMediaDate(date, "2026-09-15"), true);
  }
  for (const date of ["", "2026-09-16", "2025-02-29", "2026-04-31", "2026-9-1", "0000-01-01", 123]) {
    assert.equal(isValidMediaDate(date, "2026-09-15"), false);
  }
});

test("newest first, undated last, manual order and stable ties", () => {
  const items = [
    { id: "undated", media_date: null, sort_order: -100 },
    { id: "old", media_date: "2026-09-01", sort_order: -100 },
    { id: "b", media_date: "2026-09-15", sort_order: 10, created_at: "2026-09-15T00:00:00Z" },
    { id: "a", media_date: "2026-09-15", sort_order: 10, created_at: "2026-09-15T00:00:00Z" },
    { id: "manual", media_date: "2026-09-15", sort_order: 0 },
    { id: "created", media_date: "2026-09-15", sort_order: 10, created_at: "2026-09-15T01:00:00Z" },
  ];
  assert.deepEqual(items.sort(compareMediaDates).map(item => item.id), ["manual", "created", "a", "b", "old", "undated"]);
});

test("manual drag order wins over dates, reset falls back to dates", () => {
  const auto = [
    { id: "new", media_date: "2026-09-14", manual_order: null, sort_order: 20 },
    { id: "old", media_date: "2026-09-01", manual_order: null, sort_order: 0 },
  ];
  assert.deepEqual([...auto].sort(compareMediaDisplay).map(item => item.id), ["new", "old"]);
  const manual = [
    { id: "new", media_date: "2026-09-14", manual_order: 10, sort_order: 20 },
    { id: "old", media_date: "2026-09-01", manual_order: 0, sort_order: 0 },
  ];
  assert.deepEqual([...manual].sort(compareMediaDisplay).map(item => item.id), ["old", "new"]);
  assert.equal(hasManualOrder(auto), false);
  assert.equal(hasManualOrder(manual), true);
});

test("new files insert by date without disturbing old relative order", () => {
  const ordered = [
    { id: "old-manual", media_date: "2026-09-01" },
    { id: "older-manual", media_date: "2026-08-01" },
  ];
  assert.equal(insertIndexByDate(ordered, "2026-09-14"), 0);
  assert.equal(insertIndexByDate(ordered, "2026-08-15"), 1);
  assert.equal(insertIndexByDate(ordered, "2026-07-01"), 2);
  assert.equal(insertIndexByDate(ordered, "2026-09-01"), 1);
  assert.equal(insertIndexByDate(ordered, null), 2);
});
