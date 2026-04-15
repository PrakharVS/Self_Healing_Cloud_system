import { useEffect, useRef } from "react";
import React from "react";
export default function EventStream({ title, description, logs }) {
  const logContainerRef = useRef(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      <div className="logs-panel" ref={logContainerRef}>
        {logs.length ? (
          logs.map((entry, index) => (
            <div key={`${entry.pod || "system"}-${index}`} className={`log-line ${entry.type || "log"}`}>
              <span className="log-pod">{entry.pod || "Self Healing Cloud"}</span>
              <span>{entry.line}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">Waiting for events from Self Healing Cloud...</div>
        )}
      </div>
    </article>
  );
}
