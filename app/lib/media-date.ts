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

type DatedMedia = { id: string; media_date?: string | null; manual_order?: number | null; sort_order: number; created_at?: string };

export function compareMediaDates(a: DatedMedia, b: DatedMedia): number {
  const aDate = a.media_date || "";
  const bDate = b.media_date || "";
  if (aDate !== bDate) return aDate > bDate ? -1 : 1;
  const order = (a.sort_order || 0) - (b.sort_order || 0);
  if (order) return order;
  const created = (Date.parse(b.created_at || "") || 0) - (Date.parse(a.created_at || "") || 0);
  return created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Display order: manual drag order wins over dates. Items with a manual_order
 * sort first by manual rank; the rest fall back to newest-date-first.
 * Mirrors the Worker MEDIA_ORDER.
 */
export function compareMediaDisplay(a: DatedMedia, b: DatedMedia): number {
  const aManual = a.manual_order ?? null;
  const bManual = b.manual_order ?? null;
  if (aManual !== null || bManual !== null) {
    if (aManual === null) return 1;
    if (bManual === null) return -1;
    if (aManual !== bManual) return aManual - bManual;
  }
  return compareMediaDates(a, b);
}

/** A scope has a manual override when any of its media carries a manual rank. */
export function hasManualOrder(items: Array<{ manual_order?: number | null }>): boolean {
  return items.some(item => item.manual_order !== null && item.manual_order !== undefined);
}

/** Scope key for media placement: folder wins, then sub-category, then category. */
export function mediaScopeKey(m: { category_id: string; sub_category_id?: string | null; folder_id?: string | null }): string {
  if (m.folder_id) return `folder:${m.folder_id}`;
  if (m.sub_category_id) return `sub:${m.sub_category_id}`;
  return `cat:${m.category_id}`;
}

/**
 * Find where a new dated item belongs in the current display order without
 * disturbing the relative order of existing items: before the first item
 * whose date is older (or missing), otherwise at the end.
 */
export function insertIndexByDate<T extends { media_date?: string | null }>(ordered: T[], mediaDate: string | null | undefined): number {
  const date = mediaDate || "";
  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i].media_date || "";
    if (date === "" ? current === "" : current < date || current === "") return i;
  }
  return ordered.length;
}
