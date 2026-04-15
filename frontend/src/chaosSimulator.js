function logEntry(pod, line, type = "log") {
  return { pod, line, type };
}

function nextHistory(state, cpu, pods) {
  const nextPoint = {
    label: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    cpu,
    pods,
  };

  return [...state.metricHistory, nextPoint].slice(-8);
}

function appendLogs(state, entries) {
  return [...state.logs, ...entries].slice(-180);
}

export function createInitialSimulationState() {
  return {
    podStatus: "Running",
    cpu: 20,
    pods: 1,
    logs: [
      logEntry("Self Healing Cloud", "[System] Demo mode initialized", "info"),
      logEntry("Self Healing Cloud", "[K8s] Deployment healthy with 1 pod"),
      logEntry("Self Healing Cloud", "[AI] Monitoring baseline established", "healing"),
    ],
    health: "Running",
    smartFixes: 0,
    metricHistory: [
      { label: "T-3", cpu: 18, pods: 1 },
      { label: "T-2", cpu: 21, pods: 1 },
      { label: "T-1", cpu: 20, pods: 1 },
    ],
  };
}

export function scheduleBackgroundLogs(setState) {
  const lines = [
    "[K8s] Readiness checks passing",
    "[System] Event stream connected",
    "[AI] Health score remains stable",
    "[HPA] Current replica demand unchanged",
    "[System] Controller loop synced",
  ];

  const intervalId = window.setInterval(() => {
    setState((current) => {
      const cpu = Math.max(12, Math.min(45, current.cpu + (Math.random() > 0.5 ? 3 : -2)));
      const pods = current.pods;
      const randomLine = lines[Math.floor(Math.random() * lines.length)];

      return {
        ...current,
        cpu,
        logs: appendLogs(current, [logEntry("Self Healing Cloud", randomLine, randomLine.includes("[AI]") ? "healing" : "info")]),
        metricHistory: nextHistory(current, cpu, pods),
      };
    });
  }, 1800);

  return () => window.clearInterval(intervalId);
}

export function runSimulationAction(type, setState) {
  if (type === "crash") {
    setState((current) => ({
      ...current,
      podStatus: "Failed",
      health: "Failed",
      cpu: 8,
      logs: appendLogs(current, [logEntry("Self Healing Cloud", "[K8s] Pod crashed", "error")]),
      metricHistory: nextHistory(current, 8, 0),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        podStatus: "Recovering",
        health: "Recovering",
        pods: 1,
        logs: appendLogs(current, [logEntry("Self Healing Cloud", "[System] Restart initiated", "info")]),
        metricHistory: nextHistory(current, 28, 1),
      }));
    }, 2000);

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        podStatus: "Running",
        health: "Running",
        cpu: 24,
        pods: 1,
        smartFixes: current.smartFixes + 1,
        logs: appendLogs(current, [logEntry("Self Healing Cloud", "[AI] Issue resolved", "healing")]),
        metricHistory: nextHistory(current, 24, 1),
      }));
    }, 5000);
  }

  if (type === "cpu") {
    setState((current) => ({
      ...current,
      cpu: 90,
      pods: 3,
      health: "Recovering",
      logs: appendLogs(current, [
        logEntry("Self Healing Cloud", "[HPA] Scaling to 3 pods", "info"),
        logEntry("Self Healing Cloud", "[System] CPU saturation detected", "error"),
      ]),
      metricHistory: nextHistory(current, 90, 3),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        cpu: 38,
        pods: 3,
        health: "Running",
        smartFixes: current.smartFixes + 1,
        logs: appendLogs(current, [logEntry("Self Healing Cloud", "[AI] Load redistributed across replicas", "healing")]),
        metricHistory: nextHistory(current, 38, 3),
      }));
    }, 3000);
  }

  if (type === "memory") {
    setState((current) => ({
      ...current,
      health: "Recovering",
      cpu: 62,
      logs: appendLogs(current, [
        logEntry("Self Healing Cloud", "[System] Memory consumption rising", "error"),
        logEntry("Self Healing Cloud", "[K8s] Container nearing OOM threshold"),
      ]),
      metricHistory: nextHistory(current, 62, current.pods),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        podStatus: "Running",
        health: "Running",
        cpu: 26,
        smartFixes: current.smartFixes + 1,
        logs: appendLogs(current, [
          logEntry("Self Healing Cloud", "[K8s] Restart completed"),
          logEntry("Self Healing Cloud", "[AI] Memory leak isolated and recycled", "healing"),
        ]),
        metricHistory: nextHistory(current, 26, current.pods),
      }));
    }, 4200);
  }

  if (type === "config") {
    setState((current) => ({
      ...current,
      health: "Failed",
      logs: appendLogs(current, [
        logEntry("Self Healing Cloud", "[System] Bad config pushed to cluster", "error"),
        logEntry("Self Healing Cloud", "[AI] Rollback plan selected", "healing"),
      ]),
      metricHistory: nextHistory(current, 44, current.pods),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        health: "Running",
        smartFixes: current.smartFixes + 1,
        logs: appendLogs(current, [
          logEntry("Self Healing Cloud", "[K8s] Previous ReplicaSet restored"),
          logEntry("Self Healing Cloud", "[AI] Configuration rollback complete", "healing"),
        ]),
        metricHistory: nextHistory(current, 24, current.pods),
      }));
    }, 3200);
  }

  if (type === "deadlock") {
    setState((current) => ({
      ...current,
      health: "Recovering",
      logs: appendLogs(current, [
        logEntry("Self Healing Cloud", "[DB] Deadlock detected on primary writer", "error"),
        logEntry("Self Healing Cloud", "[System] Initiating failover to healthy replica", "info"),
      ]),
      metricHistory: nextHistory(current, 58, current.pods),
    }));

    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        health: "Running",
        smartFixes: current.smartFixes + 1,
        logs: appendLogs(current, [
          logEntry("Self Healing Cloud", "[DB] Replica promoted to primary"),
          logEntry("Self Healing Cloud", "[AI] Transaction queue drained successfully", "healing"),
        ]),
        metricHistory: nextHistory(current, 30, current.pods),
      }));
    }, 3600);
  }

  return () => undefined;
}
