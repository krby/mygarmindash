import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Nav } from "./components/nav";
import { Loading } from "./components/state";

const Home = lazy(() => import("./routes/home"));
const Activities = lazy(() => import("./routes/activities"));
const ActivityDetail = lazy(() => import("./routes/activity-detail"));
const Exercises = lazy(() => import("./routes/exercises"));
const Settings = lazy(() => import("./routes/settings"));

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-4 pb-[calc(88px+env(safe-area-inset-bottom))]">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/activities/:id" element={<ActivityDetail />} />
            <Route path="/exercises" element={<Exercises />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Nav />
    </div>
  );
}
