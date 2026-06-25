import { useNavigate, useParams } from "react-router-dom";
import { useActivity } from "../api/hooks";
import { Chart } from "../components/chart";
import { Card } from "../components/ui";
import { WorkoutCard } from "../components/workout-card";
import { ErrorState, Loading } from "../components/state";
import { formatMinSec } from "../lib/format";
import { hrZonesAsArray } from "../lib/garmin";

const ZONE_COLORS = ["#94a3b8", "#60a5fa", "#34d399", "#fbbf24", "#ef4444"];

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const q = useActivity(id);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <p className="py-12 text-center text-muted">Not found.</p>;

  const zones = hrZonesAsArray(q.data.hr_zones);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="self-start text-sm font-medium text-accent"
      >
        ← Back
      </button>

      <WorkoutCard data={q.data} detailed />

      {zones.length > 0 && (
        <Card>
          <h2 className="eyebrow mb-4">HR zones</h2>
          <Chart
            kind="bar"
            data={{
              labels: zones.map((z) => `Z${z.zone}`),
              datasets: [
                {
                  label: "Time",
                  data: zones.map((z) => z.seconds),
                  backgroundColor: zones.map((z) => ZONE_COLORS[z.zone - 1]!),
                },
              ],
            }}
            options={{
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => formatMinSec(ctx.parsed.y),
                  },
                },
              },
              scales: {
                y: {
                  ticks: {
                    callback: (value) => formatMinSec(Number(value)),
                  },
                },
              },
            }}
          />
        </Card>
      )}
    </div>
  );
}
