/** Format an instant as a calendar date in the shop's IANA timezone. */
export function dateInTimeZone(value: string | number | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(value));
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

/** Missing dates are allowed; provided dates must be real dates no later than shop today. */
export function isValidMediaDate(value: unknown, today: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01" || value > today) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

type DatedMedia = { id: string; media_date?: string | null; sort_order: number; created_at?: string };

export function compareMediaDates(a: DatedMedia, b: DatedMedia): number {
  const aDate = a.media_date || "";
  const bDate = b.media_date || "";
  if (aDate !== bDate) return aDate > bDate ? -1 : 1;
  const order = (a.sort_order || 0) - (b.sort_order || 0);
  if (order) return order;
  const created = (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
  return created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
