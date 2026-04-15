import React from "react";
const demoActions = [
  { key: "crash", label: "Crash App", tone: "danger" },
  { key: "cpu", label: "CPU Spike", tone: "primary" },
  { key: "memory", label: "Memory Leak", tone: "secondary" },
  { key: "config", label: "Bad Config", tone: "secondary" },
  { key: "deadlock", label: "DB Deadlock", tone: "secondary" },
];

const realActions = [
  { key: "crash", label: "Crash App", tone: "danger" },
  { key: "cpu", label: "CPU Spike", tone: "primary" },
];

function buttonClass(tone) {
  if (tone === "danger") return "danger-button";
  if (tone === "secondary") return "secondary-button";
  return "primary-button";
}

export default function ChaosPanel({ title, description, mode, busyAction, onAction }) {
  const actions = mode === "demo" ? demoActions : realActions;

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="chaos-actions stacked">
        {actions.map((action) => (
          <button
            key={action.key}
            className={buttonClass(action.tone)}
            type="button"
            disabled={Boolean(busyAction)}
            onClick={() => onAction(action.key)}
          >
            {busyAction === action.key ? `${action.label}...` : action.label}
          </button>
        ))}
      </div>

      <div className="chaos-note">
        {mode === "demo"
          ? "Demo mode mirrors the production dashboard while keeping all behavior local to the browser."
          : "Real mode sends chaos commands to Kubernetes so you can observe actual reconciliation behavior."}
      </div>
    </article>
  );
}
