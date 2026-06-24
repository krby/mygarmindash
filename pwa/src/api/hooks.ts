import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./client";
import type {
  ActivityDetailResponse,
  ActivityRow,
  ExerciseSetAgg,
  StatsResponse,
} from "./types";

const HOUR = 60 * 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

export const useLastStrength = () =>
  useQuery({
    queryKey: ["strength-last"],
    queryFn: () => api<ActivityDetailResponse | null>("/api/strength/last"),
    staleTime: FIVE_MIN,
    gcTime: 24 * HOUR,
  });

export const useActivities = (days = 30, type?: string) =>
  useQuery({
    queryKey: ["activities", days, type ?? null],
    queryFn: () => {
      const u = new URLSearchParams({ days: String(days) });
      if (type) u.set("type", type);
      return api<ActivityRow[]>(`/api/activities?${u.toString()}`);
    },
    staleTime: FIVE_MIN,
    gcTime: 24 * HOUR,
  });

export const useActivity = (id: string | undefined) =>
  useQuery({
    queryKey: ["activity", id],
    queryFn: () => api<ActivityDetailResponse>(`/api/activities/${id}`),
    enabled: !!id,
    staleTime: HOUR,
    gcTime: 24 * HOUR,
  });

export const useExerciseSets = () =>
  useQuery({
    queryKey: ["exercise-sets"],
    queryFn: () => api<ExerciseSetAgg[]>("/api/exercise-sets"),
    staleTime: HOUR,
    gcTime: 24 * HOUR,
  });

export const useStats = () =>
  useQuery({
    queryKey: ["stats"],
    queryFn: () => api<StatsResponse>("/api/stats"),
    staleTime: HOUR,
    gcTime: 24 * HOUR,
  });

/**
 * Prefetch the head of the activity list so expanding a row feels instant.
 * Limited window — we don't refill cache for items the user may never open.
 */
export const usePrefetchActivities = (activities: ActivityRow[] | undefined, count = 5) => {
  const qc = useQueryClient();
  useEffect(() => {
    if (!activities) return;
    for (const a of activities.slice(0, count)) {
      qc.prefetchQuery({
        queryKey: ["activity", String(a.activity_id)],
        queryFn: () => api<ActivityDetailResponse>(`/api/activities/${a.activity_id}`),
        staleTime: HOUR,
      });
    }
  }, [activities, count, qc]);
};
