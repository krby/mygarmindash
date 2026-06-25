/** Imperial units throughout — Garmin stores in SI, we display in US customary. */
export const METERS_PER_MILE = 1609.344;
export const METERS_PER_FOOT = 0.3048;
export const GRAMS_PER_POUND = 453.59237;

const DATE_LONG = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const DATE_LONG_YEAR = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_SHORT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const parse = (v: unknown): Date | null => {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDateLong = (v: unknown): string =>
  parse(v) ? DATE_LONG.format(parse(v)!) : "—";

/**
 * Like {@link formatDateLong}, but appends the year when the date isn't in the
 * current year — so an older "last session" reads "Mon, Jan 5, 2024" instead of
 * an ambiguous "Mon, Jan 5".
 */
export const formatDateLongMaybeYear = (v: unknown): string => {
  const d = parse(v);
  if (!d) return "—";
  return d.getFullYear() === new Date().getFullYear()
    ? DATE_LONG.format(d)
    : DATE_LONG_YEAR.format(d);
};

export const formatDateShort = (v: unknown): string =>
  parse(v) ? DATE_SHORT.format(parse(v)!) : "—";

export const formatTime = (v: unknown): string =>
  parse(v) ? TIME.format(parse(v)!) : "—";

export const formatDuration = (seconds: unknown): string => {
  const s = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
};

/** Format a duration as m:ss (e.g. 90 → "1:30"). For short spans like HR-zone
 * time where the bare second count is hard to parse. */
export const formatMinSec = (seconds: unknown): string => {
  const s = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(s) || s < 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const formatDistance = (meters: unknown): string => {
  const m = typeof meters === "number" ? meters : Number(meters);
  if (!Number.isFinite(m)) return "—";
  return `${(m / METERS_PER_MILE).toFixed(2)} mi`;
};

export const formatElevation = (meters: number | null | undefined): string => {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return `${Math.round(meters / METERS_PER_FOOT).toLocaleString()} ft`;
};

export const formatStrengthWeight = (grams: number | null | undefined): string => {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) return "bodyweight";
  // Snap to the nearest half-pound: clears float noise from the gram→lb
  // conversion (45.1 → 45) while preserving real plate weights (47.5 stays 47.5).
  const lb = Math.round((grams / GRAMS_PER_POUND) * 2) / 2;
  return `${lb} lb`;
};

/** Garmin's body-weight rows store grams. */
export const formatBodyWeight = (grams: number | null | undefined): string => {
  if (grams == null || !Number.isFinite(grams) || grams <= 0) return "—";
  return `${(grams / GRAMS_PER_POUND).toFixed(1)} lb`;
};

export const formatCalories = (kcal: number | null | undefined): string => {
  if (kcal == null || !Number.isFinite(kcal)) return "—";
  return `${Math.round(kcal).toLocaleString()} cal`;
};

/** Heart rate in bpm, rounded. */
export const formatHr = (bpm: number | null | undefined): string => {
  if (bpm == null || !Number.isFinite(bpm)) return "—";
  return `${Math.round(bpm)} bpm`;
};

export const formatTemperature = (celsius: number | null | undefined): string => {
  if (celsius == null || !Number.isFinite(celsius)) return "—";
  return `${Math.round((celsius * 9) / 5 + 32)}°F`;
};

/** Format pace as mm:ss/mi (e.g. 8:30/mi). */
export const formatPace = (secondsPerMile: number | null | undefined): string => {
  const s = Number(secondsPerMile);
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}/mi`;
};

const titleCase = (s: string): string =>
  s
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");

export const formatExerciseName = (name: string | null | undefined): string =>
  name ? titleCase(name) : "Exercise";
