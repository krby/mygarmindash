/**
 * Row types mirror the `garmin-givemydata` SQLite schema 1:1. The Worker is
 * a thin SQL layer; the PWA reads DB-native column names directly.
 *
 * `raw_json` is included as a string. Helpers in `lib/garmin.ts` parse
 * specific paths out of it where typed columns are missing or NULL. This is
 * a stopgap — see README "Follow-ups" for the plan to promote raw_json
 * fields to typed columns upstream in garmin-givemydata.
 */

export interface ActivityRow {
  activity_id: number;
  activity_name: string | null;
  activity_type: string | null;
  activity_type_id: number | null;
  parent_type_id: number | null;
  start_time_local: string;
  start_time_gmt: string | null;
  duration_seconds: number | null;
  elapsed_duration_seconds: number | null;
  moving_duration_seconds: number | null;
  distance_meters: number | null;
  calories: number | null;
  bmr_calories: number | null;
  average_hr: number | null;
  max_hr: number | null;
  average_speed: number | null;
  max_speed: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  min_elevation: number | null;
  max_elevation: number | null;
  avg_power: number | null;
  max_power: number | null;
  norm_power: number | null;
  training_stress_score: number | null;
  intensity_factor: number | null;
  aerobic_training_effect: number | null;
  anaerobic_training_effect: number | null;
  vo2max_value: number | null;
  avg_cadence: number | null;
  max_cadence: number | null;
  avg_respiration: number | null;
  training_load: number | null;
  moderate_intensity_minutes: number | null;
  vigorous_intensity_minutes: number | null;
  start_latitude: number | null;
  start_longitude: number | null;
  end_latitude: number | null;
  end_longitude: number | null;
  location_name: string | null;
  lap_count: number | null;
  water_estimated: number | null;
  min_temperature: number | null;
  max_temperature: number | null;
  manufacturer: string | null;
  device_id: number | null;
  raw_json: string | null;
}

export interface ActivitySplit {
  activity_id: number;
  split_number: number;
  distance_meters: number | null;
  duration_seconds: number | null;
  average_speed: number | null;
  average_hr: number | null;
  max_hr: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  avg_cadence: number | null;
  raw_json: string | null;
}

export interface ActivityHrZonesRow {
  activity_id: number;
  zone1_seconds: number | null;
  zone2_seconds: number | null;
  zone3_seconds: number | null;
  zone4_seconds: number | null;
  zone5_seconds: number | null;
  raw_json: string | null;
}

export interface ActivityWeather {
  activity_id: number;
  temperature: number | null;
  apparent_temperature: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  weather_type: string | null;
  raw_json: string | null;
}

export interface ActivityExerciseSet {
  activity_id: number;
  set_number: number;
  exercise_name: string | null;
  exercise_category: string | null;
  reps: number | null;
  weight: number | null;
  duration_seconds: number | null;
  raw_json: string | null;
}

/**
 * A compact ACTIVE set for the Exercises aggregation — the `/api/exercise-sets`
 * row. The Worker pre-extracts name/reps/weight from raw_json (the full blob is
 * too large to ship in bulk), so this is already "parsed". `name` is Garmin's
 * specific exercise name (not the coarser category). Weight is in grams. See
 * `aggregateExercises`.
 */
export interface ExerciseSetAgg {
  activity_id: number;
  set_number: number;
  start_time_local: string;
  name: string | null;
  reps: number | null;
  weight: number | null;
}

export interface ActivityDetailResponse {
  activity: ActivityRow;
  splits: ActivitySplit[];
  hr_zones: ActivityHrZonesRow | null;
  weather: ActivityWeather | null;
  exercise_sets: ActivityExerciseSet[];
}

export interface StatsResponse {
  tables: { table_name: string; rows: number }[];
  last_activity_at: string | null;
}
