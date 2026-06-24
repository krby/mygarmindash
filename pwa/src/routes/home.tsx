import { useLastStrength } from "../api/hooks";
import { WorkoutCard } from "../components/workout-card";
import { Empty, ErrorState, Loading } from "../components/state";

export default function Home() {
  const q = useLastStrength();

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Latest workout</h1>
        <p className="text-sm text-muted">Your most recent strength session</p>
      </header>

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Empty>No strength workouts found yet.</Empty>
      ) : (
        <WorkoutCard data={q.data} />
      )}
    </div>
  );
}
