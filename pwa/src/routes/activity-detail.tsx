import { Link, useParams } from "react-router-dom";
import { useActivity } from "../api/hooks";
import { Chart } from "../components/chart";
import { Card } from "../components/ui";
import { WorkoutCard } from "../components/workout-card";
import { ErrorState, Loading } from "../components/state";
import { formatTemperature } from "../lib/format";
import { hrZonesAsArray, paceSecPerMile } from "../lib/garmin";

const ZONE_COLORS = ["#94a3b8", "#60a5fa", "#34d399", "#fbbf24", "#ef4444"];

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useActivity(id);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <p className="py-12 text-center text-muted">Not found.</p>;

  const { splits, hr_zones, weather } = q.data;
  const zones = hrZonesAsArray(hr_zones);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/activities" className="text-sm font-medium text-accent">
        ← Activities
      </Link>

      <WorkoutCard data={q.data} />

      {splits.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-ink">Splits</h2>
          <Chart
            kind="bar"
            data={{
              labels: splits.map((s) => `${s.split_number}`),
              datasets: [
                {
                  label: "Pace (min/mi)",
                  data: splits.map((s) => {
                    const sec = paceSecPerMile(s.average_speed);
                    return sec != null ? sec / 60 : 0;
                  }),
                  backgroundColor: "#5bc0be",
                },
              ],
            }}
          />
        </Card>
      )}

      {zones.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-ink">HR zones</h2>
          <Chart
            kind="bar"
            data={{
              labels: zones.map((z) => `Z${z.zone}`),
              datasets: [
                {
                  label: "Seconds",
                  data: zones.map((z) => z.seconds),
                  backgroundColor: zones.map((z) => ZONE_COLORS[z.zone - 1]!),
                },
              ],
            }}
            options={{ plugins: { legend: { display: false } } }}
          />
        </Card>
      )}

      {weather && (
        <Card className="flex flex-col gap-1">
          <h2 className="mb-1 text-lg font-semibold text-ink">Weather</h2>
          {weather.temperature != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Temp</span>
              <strong>{formatTemperature(weather.temperature)}</strong>
            </div>
          )}
          {weather.weather_type && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Conditions</span>
              <strong>{weather.weather_type}</strong>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
