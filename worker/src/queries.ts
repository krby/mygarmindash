import type { Client, InValue } from "@libsql/client/web";

/**
 * One query function per API endpoint.
 *
 * Worker is a thin SQL layer: queries return DB-native row shapes from the
 * `garmin-givemydata` schema. Column renames and derived values (pace,
 * hr_zones reshape, exercise grouping/records) live in the PWA — see
 * pwa/src/lib/garmin.ts.
 *
 * The one deliberate non-1:1 shape is `/api/exercise-sets`, which joins each
 * set to its activity's date/name so the Exercises page can aggregate
 * client-side (exercise category still lives in raw_json).
 *
 * SQL is hardcoded; nothing is user-supplied.
 */

const clampDays = (raw: string | null, fallback = 30, max = 365): number => {
  const n = raw ? parseInt(raw, 10) : fallback;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
};

const rowsToObjects = (rs: { columns: string[]; rows: any[] }): Record<string, unknown>[] =>
  rs.rows.map((r) => {
    const o: Record<string, unknown> = {};
    rs.columns.forEach((c, i) => (o[c] = r[i]));
    return o;
  });

export async function activities(client: Client, days: number, type: string | null) {
  // Filter on start_time_gmt (semantically UTC) so it aligns with datetime('now')
  // — start_time_local is naive Garmin-device wall time and would skew the
  // boundary day for users whose tz differs from UTC. Display still uses
  // start_time_local. See README "Follow-ups" for the upstream tz-aware column.
  const args: InValue[] = [`-${days} days` as InValue];
  let sql =
    "SELECT * FROM activity " +
    "WHERE start_time_gmt >= datetime('now', ?) ";
  if (type) {
    sql += "AND activity_type = ? ";
    args.push(type as InValue);
  }
  sql += "ORDER BY start_time_local DESC LIMIT 500";
  const rs = await client.execute({ sql, args });
  return rowsToObjects(rs);
}

export async function activityDetail(client: Client, id: string) {
  // No `activity_laps` table exists in garmin-givemydata's schema.
  const [activityRs, splitsRs, hrRs, weatherRs, setsRs] = await client.batch(
    [
      { sql: "SELECT * FROM activity WHERE activity_id = ?", args: [id] },
      {
        sql:
          "SELECT * FROM activity_splits WHERE activity_id = ? " +
          "ORDER BY split_number ASC",
        args: [id],
      },
      { sql: "SELECT * FROM activity_hr_zones WHERE activity_id = ?", args: [id] },
      { sql: "SELECT * FROM activity_weather WHERE activity_id = ?", args: [id] },
      {
        sql:
          "SELECT * FROM activity_exercise_sets WHERE activity_id = ? " +
          "ORDER BY set_number ASC",
        args: [id],
      },
    ],
    "read",
  );
  const a = rowsToObjects(activityRs)[0];
  if (!a) return null;
  return {
    activity: a,
    splits: rowsToObjects(splitsRs),
    hr_zones: rowsToObjects(hrRs)[0] ?? null,
    weather: rowsToObjects(weatherRs)[0] ?? null,
    exercise_sets: rowsToObjects(setsRs),
  };
}

/**
 * The most recent strength workout = latest activity that logged exercise sets.
 * Identifying it by the presence of sets (rather than guessing the
 * `activity_type` string) is robust across Garmin's type naming. Returns the
 * same shape as `activityDetail`.
 */
export async function lastStrength(client: Client) {
  const idRs = await client.execute(
    "SELECT a.activity_id FROM activity a " +
      "WHERE a.activity_id IN (SELECT DISTINCT activity_id FROM activity_exercise_sets) " +
      "ORDER BY a.start_time_local DESC LIMIT 1",
  );
  const id = rowsToObjects(idRs)[0]?.activity_id;
  if (id == null) return null;
  return activityDetail(client, String(id));
}

/**
 * Compact ACTIVE exercise sets for the all-history Exercises aggregation.
 *
 * Shipping the full `raw_json` blob for every set in history blows past Turso's
 * response-size limit, so this is the one place we read raw_json server-side:
 * pull only the fields the PWA aggregates (exercise name, reps, weight) via
 * `json_extract`. We prefer the specific exercise `name` (e.g.
 * BARBELL_BENCH_PRESS) but fall back to the coarser `category` — Garmin leaves
 * `name` null on many sets, so requiring it would drop those exercises. The
 * ACTIVE-only filter drops rest rows. Per-workout detail still ships raw rows
 * (one activity is small). Ordered newest-first.
 */
const EXERCISE_LABEL =
  "COALESCE(s.exercise_name, json_extract(s.raw_json, '$.exercises[0].name'), " +
  "s.exercise_category, json_extract(s.raw_json, '$.exercises[0].category'))";

export async function exerciseSets(client: Client) {
  const rs = await client.execute(
    "SELECT s.activity_id, s.set_number, a.start_time_local, " +
      `${EXERCISE_LABEL} AS name, ` +
      "COALESCE(s.reps, json_extract(s.raw_json, '$.repetitionCount')) AS reps, " +
      "COALESCE(s.weight, json_extract(s.raw_json, '$.weight')) AS weight " +
      "FROM activity_exercise_sets s " +
      "JOIN activity a ON a.activity_id = s.activity_id " +
      "WHERE json_extract(s.raw_json, '$.setType') = 'ACTIVE' " +
      `AND ${EXERCISE_LABEL} IS NOT NULL ` +
      "ORDER BY a.start_time_local DESC, s.set_number ASC",
  );
  return rowsToObjects(rs);
}

export async function stats(client: Client) {
  const tablesRs = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  );
  const tables = tablesRs.rows.map((r) => String(r[0]));
  const counts = await client.batch(
    tables.map((t) => `SELECT '${t}' AS table_name, COUNT(*) AS rows FROM "${t}"`),
    "read",
  );
  const tableCounts = counts.flatMap((c) => rowsToObjects(c));
  let lastActivity: string | null = null;
  try {
    const r = await client.execute(
      "SELECT MAX(start_time_local) AS t FROM activity",
    );
    lastActivity = (rowsToObjects(r)[0]?.t as string) ?? null;
  } catch {
    // ignore — `activity` may not be present in an empty schema.
  }
  return { tables: tableCounts, last_activity_at: lastActivity };
}

export { clampDays };
