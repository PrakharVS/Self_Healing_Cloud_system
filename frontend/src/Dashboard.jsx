import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EventStream from "./EventStream";
import MetricsChart from "./MetricsChart";
import { createLogStream, fetchStatus } from "./api";

function summarizeHealth(summary) {
  if (!summary.total) {
    return { label: "No Pods", tone: "default" };
  }

  if (summary.unhealthy > 0) {
    return { label: "Failed", tone: "danger" };
  }

  if (summary.pending > 0) {
    return { label: "Recovering", tone: "info" };
  }

  return { label: "Running", tone: "healthy" };
}

function StatCard({ label, value, tone = "default" }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function formatClockLabel(value) {
  return value.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function normalizeRealEvent(entry) {
  const line = String(entry?.line || "").trim();
  const pod = entry?.pod || "Self Healing Cloud";
  const type = entry?.type || "log";

  if (!line) {
    return null;
  }

  if (line.includes("kube-probe/")) {
    return null;
  }

  if (line.startsWith("Attached to pod")) {
    return { pod: "Self Healing Cloud", line, type: "info" };
  }

  if (line.includes("Container is still starting")) {
    return { pod: "Kubernetes", line: "Container is starting and log streaming will begin shortly.", type: "info" };
  }

  if (line.includes("Configuration complete; ready for start up")) {
    return { pod: "Container", line: "Bootstrap completed and the container is ready to start.", type: "info" };
  }

  if (line.includes("Looking for shell scripts in /docker-entrypoint.d/")) {
    return { pod: "Container", line: "Startup hooks detected and initialization is in progress.", type: "info" };
  }

  if (line.includes("/docker-entrypoint.d/ is not empty")) {
    return { pod: "Container", line: "Container startup sequence began.", type: "info" };
  }

  if (line.includes('using the "epoll" event method')) {
    return { pod: "Nginx", line: "Web server event loop initialized.", type: "info" };
  }

  if (line.includes("nginx/")) {
    return { pod: "Nginx", line: "Nginx runtime started successfully.", type: "info" };
  }

  if (line.includes("start worker processes")) {
    return { pod: "Nginx", line: "Worker processes launched.", type: "info" };
  }

  if (line.includes("start worker process")) {
    return null;
  }

  if (line.includes("worker process") && line.includes("exited with code 0")) {
    return { pod: "Nginx", line: "A worker exited cleanly during handoff.", type: "info" };
  }

  if (type === "error") {
    return { pod: "Self Healing Cloud", line, type };
  }

  // Remove leading RFC3339 timestamps from raw container logs to make events easier to scan.
  const cleanedLine = line.replace(/^\d{4}-\d{2}-\d{2}T\S+\s+/, "");
  return { pod, line: cleanedLine, type };
}

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialAppName = searchParams.get("appName") || "self-healing-demo";
  const [appName, setAppName] = useState(initialAppName);
  const [statusData, setStatusData] = useState({
    summary: { total: 0, running: 0, pending: 0, unhealthy: 0 },
    pods: [],
    health: "No Pods",
    smartFixes: 0,
    cpuAverage: 0,
    metricsAvailable: false,
  });
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSearchParams(appName ? { appName } : {});
  }, [appName, setSearchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const data = await fetchStatus(appName);
        if (!cancelled) {
          setStatusData(data);
          setHistory((current) =>
            [
              ...current,
              {
                label: formatClockLabel(new Date()),
                cpu: data.cpuAverage,
                pods: data.summary.total,
              },
            ].slice(-10)
          );
          setError("");
        }
      } catch (statusError) {
        if (!cancelled) {
          setError(statusError.message);
        }
      }
    };

    loadStatus();
    const intervalId = setInterval(loadStatus, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [appName]);

  useEffect(() => {
    setLogs([]);
    setMessage("");

    if (!appName) {
      return undefined;
    }

    const stream = createLogStream(appName, (entry) => {
      setLogs((current) => {
        const normalized = normalizeRealEvent(entry);
        if (!normalized) {
          return current;
        }

        const previous = current[current.length - 1];
        if (
          previous &&
          previous.pod === normalized.pod &&
          previous.line === normalized.line &&
          previous.type === normalized.type
        ) {
          return current;
        }

        return [...current, normalized].slice(-220);
      });
    });

    stream.addEventListener("error", () => {
      setLogs((current) =>
        [...current, { type: "error", pod: "Self Healing Cloud", line: "Log stream disconnected." }].slice(-220)
      );
    });

    return () => stream.close();
  }, [appName]);

  const chartSeries = useMemo(() => {
    const source = history.length
      ? history
      : [{ label: formatClockLabel(new Date()), cpu: statusData.cpuAverage, pods: statusData.summary.total }];

    return {
      labels: source.map((point) => point.label),
      cpu: source.map((point) => point.cpu),
      pods: source.map((point) => point.pods),
    };
  }, [history, statusData.cpuAverage, statusData.summary.total]);

  const healthCard = summarizeHealth(statusData.summary);

  return (
    <section className="dashboard-shell">
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Real Kubernetes Mode</span>
          <h1>Self Healing Cloud Dashboard</h1>
          <p>Watch a real Kubernetes deployment recover, scale, and emit cluster events in real time.</p>
        </div>

        <div className="dashboard-controls">
          <label>
            <span>App Name</span>
            <input value={appName} onChange={(event) => setAppName(event.target.value)} />
          </label>
        </div>
      </div>

      {message ? <div className="notice success">{message}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <div className="stats-grid">
        <StatCard label="System Health" value={healthCard.label} tone={healthCard.tone} />
        <StatCard
          label="CPU Load (%)"
          value={statusData.metricsAvailable ? `${statusData.cpuAverage}%` : "Metrics API Missing"}
          tone="info"
        />
        <StatCard label="Active Pods" value={statusData.summary.total} />
        <StatCard label="Smart Fixes" value={statusData.smartFixes} tone="healthy" />
      </div>

      <div className="dashboard-grid">
        <MetricsChart
          title="Performance Chart"
          description={
            statusData.metricsAvailable
              ? "Time-based CPU pressure and replica count from the real cluster."
              : "Replica count from the real cluster. CPU data is unavailable because the Kubernetes Metrics API is not installed or reachable."
          }
          labels={chartSeries.labels}
          cpuSeries={chartSeries.cpu}
          podSeries={chartSeries.pods}
          showCpu={statusData.metricsAvailable}
        />
        <article className="panel">
          <div className="panel-header">
            <h2>Workload Overview</h2>
            <p>Current pod state, restart count, and node placement for the active application.</p>
          </div>

          <div className="overview-list">
            {statusData.pods.length ? (
              statusData.pods.map((pod) => (
                <div key={pod.name} className="overview-item">
                  <div>
                    <strong>{pod.name}</strong>
                    <span>{pod.nodeName}</span>
                  </div>
                  <div>
                    <strong>{pod.status}</strong>
                    <span>
                      Restarts: {pod.restarts} | CPU: {pod.cpuPercent}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">No pods found for this application yet.</div>
            )}
          </div>
        </article>
      </div>

      <EventStream
        title="Event Stream"
        description="Live application and control-plane events streamed by Self Healing Cloud."
        logs={logs}
      />
    </section>
  );
}
