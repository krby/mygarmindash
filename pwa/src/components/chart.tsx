import { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import "chartjs-adapter-date-fns";
import { Chart as ReactChart } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  LineController,
  BarController,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin,
);

export interface ChartProps {
  kind: "line" | "bar";
  data: ChartData<"line" | "bar">;
  options?: ChartOptions<"line" | "bar">;
  /** Called with the data point at the click target, if any. */
  onPointClick?: (datasetIndex: number, index: number) => void;
  height?: number;
}

/**
 * Single chart wrapper for the whole app. Route files import this — never
 * `react-chartjs-2` directly. Tooltips, click navigation, and
 * drag/pinch zoom are wired here.
 */
export function Chart({ kind, data, options, onPointClick, height = 280 }: ChartProps) {
  const ref = useRef<ChartJS<"line" | "bar"> | null>(null);

  const merged = useMemo<ChartOptions<"line" | "bar">>(() => {
    const base: ChartOptions<"line" | "bar"> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false, axis: "x" },
      plugins: {
        legend: { display: true, position: "top" },
        tooltip: { enabled: true },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag: { enabled: true },
            mode: "x",
          },
        },
      },
      onClick: (_evt, elements) => {
        if (!onPointClick || elements.length === 0) return;
        const first = elements[0];
        if (first) onPointClick(first.datasetIndex, first.index);
      },
    };
    if (!options) return base;
    return {
      ...base,
      ...options,
      plugins: { ...base.plugins, ...(options.plugins ?? {}) },
    };
  }, [options, onPointClick]);

  return (
    <div className="chart-wrap" style={{ height }}>
      <ReactChart ref={ref} type={kind} data={data} options={merged} />
    </div>
  );
}
