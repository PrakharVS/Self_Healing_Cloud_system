import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import React from "react";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

export default function MetricsChart({ title, description, labels, cpuSeries, podSeries, showCpu = true }) {
  const data = {
    labels,
    datasets: [
      ...(showCpu
        ? [{
        type: "bar",
        label: "CPU %",
        data: cpuSeries,
        backgroundColor: "#4d8bff",
        borderRadius: 8,
      }]
        : []),
      {
        type: "line",
        label: "Pods",
        data: podSeries,
        borderColor: "#00d4aa",
        backgroundColor: "#00d4aa",
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 4,
        yAxisID: "yPods",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#e8e8f0",
        },
      },
    },
    scales: {
        x: {
          ticks: { color: "#6b6b8a" },
          grid: { color: "#1e1e35" },
        },
        ...(showCpu
          ? {
        y: {
          ticks: { color: "#6b6b8a" },
          grid: { color: "#1e1e35" },
          suggestedMax: 100,
          title: {
            display: true,
            text: "CPU %",
            color: "#6b6b8a",
          },
        },
          }
          : {}),
        yPods: {
          position: "right",
          beginAtZero: true,
          ticks: {
            color: "#6b6b8a",
            precision: 0,
          },
          grid: {
            drawOnChartArea: false,
          },
          title: {
            display: true,
            text: "Pods",
            color: "#6b6b8a",
          },
          suggestedMax: Math.max(3, ...podSeries, 1),
        },
      },
  };

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="chart-shell">
        <Bar data={data} options={options} />
      </div>
    </article>
  );
}
