import { useEffect, useMemo, useState } from "react";
import ChaosPanel from "./ChaosPanel";
import EventStream from "./EventStream";
import MetricsChart from "./MetricsChart";
import {
  createInitialSimulationState,
  runSimulationAction,
  scheduleBackgroundLogs,
} from "./chaosSimulator";
import React from "react";

function StatCard({ label, value, tone = "default" }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function mapHealthTone(health) {
  if (health === "Failed") return "danger";
  if (health === "Recovering") return "info";
  if (health === "Running") return "healthy";
  return "default";
}

export default function DemoDashboard() {
  const [simulation, setSimulation] = useState(createInitialSimulationState);
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    const stopBackgroundLogs = scheduleBackgroundLogs(setSimulation);
    return () => stopBackgroundLogs();
  }, []);

  const chartSeries = useMemo(
    () => ({
      labels: simulation.metricHistory.map((entry) => entry.label),
      cpu: simulation.metricHistory.map((entry) => entry.cpu),
      pods: simulation.metricHistory.map((entry) => entry.pods),
    }),
    [simulation.metricHistory]
  );

  const handleAction = (type) => {
    setBusyAction(type);
    const releaseBusy = runSimulationAction(type, setSimulation);
    window.setTimeout(() => {
      releaseBusy();
      setBusyAction("");
    }, 5200);
  };

  return (
    <section className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Simulation Mode</span>
          <h1>Self Healing Cloud Demo</h1>
          <p>Experience autonomous remediation logic in a fully local simulation with no backend or Kubernetes calls.</p>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="System Health" value={simulation.health} tone={mapHealthTone(simulation.health)} />
        <StatCard label="CPU Load (%)" value={`${simulation.cpu}%`} tone="info" />
        <StatCard label="Active Pods" value={simulation.pods} />
        <StatCard label="Smart Fixes" value={simulation.smartFixes} tone="healthy" />
      </div>

      <div className="dashboard-grid">
        <MetricsChart
          title="Performance Chart"
          description="Simulated CPU pressure and pod count over time."
          labels={chartSeries.labels}
          cpuSeries={chartSeries.cpu}
          podSeries={chartSeries.pods}
        />
        <ChaosPanel
          title="Chaos Control Panel"
          description="Trigger simulated failures and watch Self Healing Cloud recover."
          mode="demo"
          busyAction={busyAction}
          onAction={handleAction}
        />
      </div>

      <EventStream
        title="Event Stream"
        description="Synthetic cluster, platform, and AI remediation logs."
        logs={simulation.logs}
      />
    </section>
  );
}
