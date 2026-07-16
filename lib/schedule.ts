export type TripType = "work" | "vacation";

export interface Trip {
  start: string; // YYYY-MM-DD, inclusive
  end: string; // YYYY-MM-DD, inclusive
  location: string;
  event?: string;
  type: TripType;
  icon?: string; // optional emoji shown on the marker + report card (e.g. "🌲")
}

export interface HomeBase {
  label: string;
  location: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface Schedule {
  home: HomeBase;
  trips: Trip[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse YYYY-MM-DD at local midnight so date math matches the viewer's wall clock. */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function tripContains(trip: Trip, day: Date): boolean {
  return parseLocalDate(trip.start) <= day && day <= parseLocalDate(trip.end);
}

export function findCurrentTrip(trips: Trip[], day: Date): Trip | null {
  return trips.find((t) => tripContains(t, day)) ?? null;
}

export function upcomingTrips(trips: Trip[], day: Date): Trip[] {
  return trips
    .filter((t) => parseLocalDate(t.start) > day)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function completedTrips(trips: Trip[], day: Date): Trip[] {
  return trips.filter((t) => parseLocalDate(t.end) < day);
}

/** Trip days elapsed so far this calendar year (inclusive of today if mid-trip). */
export function daysAfieldThisYear(trips: Trip[], day: Date): number {
  const yearStart = new Date(day.getFullYear(), 0, 1);
  let days = 0;
  for (const t of trips) {
    const start = parseLocalDate(t.start);
    const end = parseLocalDate(t.end);
    const from = start > yearStart ? start : yearStart;
    const to = end < day ? end : day;
    if (to >= from) {
      days += Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1;
    }
  }
  return days;
}

export function daysUntil(dateStr: string, day: Date): number {
  return Math.round((parseLocalDate(dateStr).getTime() - day.getTime()) / DAY_MS);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDay(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export function formatRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}`;
  }
  return `${formatDay(start)} – ${formatDay(end)}`;
}

export function haversineMiles(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // earth radius, miles
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function formatCoords([lng, lat]: [number, number]): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns} ${Math.abs(lng).toFixed(4)}°${ew}`;
}
