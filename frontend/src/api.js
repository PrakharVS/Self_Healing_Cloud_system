const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:4000").replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || "Request failed.");
  }

  return data;
}

export function deployApp(payload) {
  return request("/api/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function fetchStatus(appName) {
  return request(`/api/status?appName=${encodeURIComponent(appName)}`);
}

export function triggerCrash(appName) {
  return request("/api/chaos/crash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName }),
  });
}

export function triggerCpuLoad(appName) {
  return request("/api/chaos/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appName, durationSeconds: 20 }),
  });
}

export function createLogStream(appName, onMessage) {
  const eventSource = new EventSource(`${API_BASE}/api/logs?appName=${encodeURIComponent(appName)}`);
  eventSource.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };
  return eventSource;
}
