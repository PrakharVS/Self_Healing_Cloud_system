const express = require("express");
const cors = require("cors");
const k8s = require("@kubernetes/client-node");
const { PassThrough } = require("stream");

const app = express();
const port = process.env.PORT || 4000;
const namespace = process.env.K8S_NAMESPACE || "default";

app.use(cors());
app.use(express.json());

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const coreApi = kc.makeApiClient(k8s.CoreV1Api);
const autoscalingApi = kc.makeApiClient(k8s.AutoscalingV2Api);
const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);
const execClient = new k8s.Exec(kc);
const appState = new Map();
function sanitizeAppName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function labelsFor(appName) {
  return {
    "app.kubernetes.io/name": appName,
    "app.kubernetes.io/managed-by": "self-healing-cloud",
  };
}

function getTrackedAppState(appName) {
  if (!appState.has(appName)) {
    appState.set(appName, { smartFixes: 0 });
  }

  return appState.get(appName);
}

function getErrorDetails(error) {
  return (
    error?.body?.message ||
    error?.response?.body?.message ||
    error?.response?.body ||
    error?.message ||
    "Unknown Kubernetes error."
  );
}

function deploymentManifest(appName, image) {
  const labels = labelsFor(appName);

  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name: appName, namespace, labels },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels },
      template: {
        metadata: { labels },
        spec: {
          containers: [
            {
              name: appName,
              image,
              ports: [{ containerPort: 80 }],
              readinessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 5,
                periodSeconds: 10,
              },
              livenessProbe: {
                httpGet: { path: "/", port: 80 },
                initialDelaySeconds: 15,
                periodSeconds: 20,
              },
              resources: {
                requests: { cpu: "100m", memory: "128Mi" },
                limits: { cpu: "500m", memory: "512Mi" },
              },
            },
          ],
        },
      },
    },
  };
}

function serviceManifest(appName) {
  const labels = labelsFor(appName);

  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: `${appName}-svc`,
      namespace,
      labels,
    },
    spec: {
      type: "ClusterIP",
      selector: labels,
      ports: [{ name: "http", port: 80, targetPort: 80 }],
    },
  };
}

function hpaManifest(appName) {
  return {
    apiVersion: "autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    metadata: {
      name: `${appName}-hpa`,
      namespace,
      labels: labelsFor(appName),
    },
    spec: {
      scaleTargetRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: appName,
      },
      minReplicas: 1,
      maxReplicas: 5,
      metrics: [
        {
          type: "Resource",
          resource: {
            name: "cpu",
            target: { type: "Utilization", averageUtilization: 60 },
          },
        },
      ],
    },
  };
}

async function upsertResource(createFn, updateFn) {
  try {
    return await createFn();
  } catch (error) {
    if (error?.response?.statusCode === 409 || error?.statusCode === 409) {
      return updateFn();
    }
    throw error;
  }
}

async function updateDeployment(manifest) {
  const existing = await appsApi.readNamespacedDeployment({
    name: manifest.metadata.name,
    namespace,
  });
  manifest.metadata.resourceVersion = existing.metadata?.resourceVersion;
  return appsApi.replaceNamespacedDeployment({
    name: manifest.metadata.name,
    namespace,
    body: manifest,
  });
}

async function updateService(manifest) {
  const existing = await coreApi.readNamespacedService({
    name: manifest.metadata.name,
    namespace,
  });
  manifest.metadata.resourceVersion = existing.metadata?.resourceVersion;
  manifest.spec.clusterIP = existing.spec?.clusterIP;
  if (existing.spec?.clusterIPs) {
    manifest.spec.clusterIPs = existing.spec.clusterIPs;
  }
  if (existing.spec?.ipFamilies) {
    manifest.spec.ipFamilies = existing.spec.ipFamilies;
  }
  if (existing.spec?.ipFamilyPolicy) {
    manifest.spec.ipFamilyPolicy = existing.spec.ipFamilyPolicy;
  }
  return coreApi.replaceNamespacedService({
    name: manifest.metadata.name,
    namespace,
    body: manifest,
  });
}

async function updateHpa(manifest) {
  const existing = await autoscalingApi.readNamespacedHorizontalPodAutoscaler({
    name: manifest.metadata.name,
    namespace,
  });
  manifest.metadata.resourceVersion = existing.metadata?.resourceVersion;
  return autoscalingApi.replaceNamespacedHorizontalPodAutoscaler({
    name: manifest.metadata.name,
    namespace,
    body: manifest,
  });
}

function parseCpuToMillicores(quantity) {
  if (!quantity) return 0;
  if (quantity.endsWith("n")) return Number(quantity.slice(0, -1)) / 1_000_000;
  if (quantity.endsWith("u")) return Number(quantity.slice(0, -1)) / 1_000;
  if (quantity.endsWith("m")) return Number(quantity.slice(0, -1));
  return Number(quantity) * 1000;
}

function parseMemoryToMi(quantity) {
  if (!quantity) return 0;

  const suffixes = {
    Ki: 1 / 1024,
    Mi: 1,
    Gi: 1024,
    Ti: 1024 * 1024,
    K: 1 / 1000,
    M: 1 / 1.048576,
    G: 953.674,
  };

  const suffix = Object.keys(suffixes).find((item) => quantity.endsWith(item));
  if (!suffix) return Number(quantity) / (1024 * 1024);
  return Number(quantity.slice(0, -suffix.length)) * suffixes[suffix];
}

function getPodState(pod) {
  const waitingReason =
    pod.status?.containerStatuses?.find((status) => status.state?.waiting)?.state?.waiting?.reason;

  return waitingReason || pod.status?.phase || "Unknown";
}

function getRequestedCpuMillicores(pod) {
  return (pod.spec?.containers || []).reduce((sum, container) => {
    return sum + parseCpuToMillicores(container.resources?.requests?.cpu);
  }, 0);
}

async function getPodMetricsMap() {
  try {
    const response = await customObjectsApi.listNamespacedCustomObject(
      {
        group: "metrics.k8s.io",
        version: "v1beta1",
        namespace,
        plural: "pods",
      }
    );

    const items = response.items || [];
    return new Map(
      items.map((item) => {
        const usage = (item.containers || []).reduce(
          (acc, container) => {
            acc.cpu += parseCpuToMillicores(container.usage?.cpu);
            acc.memory += parseMemoryToMi(container.usage?.memory);
            return acc;
          },
          { cpu: 0, memory: 0 }
        );

        return [item.metadata?.name, usage];
      })
    );
  } catch (_error) {
    return new Map();
  }
}

async function listPods(appName) {
  const selector = appName
    ? Object.entries(labelsFor(appName))
        .map(([key, value]) => `${key}=${value}`)
        .join(",")
    : undefined;

  const response = await coreApi.listNamespacedPod({
    namespace,
    labelSelector: selector,
  });
  return response.items || [];
}

app.post("/api/deploy", async (req, res) => {
  const appName = sanitizeAppName(req.body?.appName);
  const image = String(req.body?.image || "").trim();

  if (!appName || !image) {
    return res.status(400).json({ error: "appName and image are required." });
  }

  try {
    appState.set(appName, { smartFixes: 0 });
    const deployment = deploymentManifest(appName, image);
    const service = serviceManifest(appName);
    const hpa = hpaManifest(appName);

    // Apply the workload objects so repeat deploys update the same application cleanly.
    await upsertResource(
      () =>
        appsApi.createNamespacedDeployment({
          namespace,
          body: deployment,
        }),
      () => updateDeployment(deployment)
    );

    await upsertResource(
      () =>
        coreApi.createNamespacedService({
          namespace,
          body: service,
        }),
      () => updateService(service)
    );

    await upsertResource(
      () =>
        autoscalingApi.createNamespacedHorizontalPodAutoscaler({
          namespace,
          body: hpa,
        }),
      () => updateHpa(hpa)
    );

    return res.json({
      message: "Deployment, service, and HPA applied successfully.",
      appName,
      namespace,
      serviceName: service.metadata.name,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to deploy workload.",
      details: getErrorDetails(error),
    });
  }
});

app.get("/api/status", async (req, res) => {
  const appName = sanitizeAppName(req.query.appName);

  try {
    const [pods, metricsMap] = await Promise.all([listPods(appName), getPodMetricsMap()]);
    const podData = pods.map((pod) => {
      const metrics = metricsMap.get(pod.metadata?.name) || { cpu: 0, memory: 0 };
      const requestedCpuMillicores = getRequestedCpuMillicores(pod);
      const cpuPercent = requestedCpuMillicores
        ? Number(((metrics.cpu / requestedCpuMillicores) * 100).toFixed(1))
        : Number((metrics.cpu / 10).toFixed(1));

      return {
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        appName: pod.metadata?.labels?.["app.kubernetes.io/name"] || "unknown",
        status: getPodState(pod),
        ready: pod.status?.containerStatuses?.every((status) => status.ready) || false,
        restarts: (pod.status?.containerStatuses || []).reduce((sum, status) => sum + (status.restartCount || 0), 0),
        nodeName: pod.spec?.nodeName || "pending",
        startedAt: pod.status?.startTime || null,
        cpuMillicores: Number(metrics.cpu.toFixed(2)),
        cpuPercent,
        requestedCpuMillicores,
        memoryMi: Number(metrics.memory.toFixed(2)),
      };
    });

    const summary = podData.reduce(
      (acc, pod) => {
        acc.total += 1;
        if (pod.status === "Running" && pod.ready) acc.running += 1;
        else if (pod.status === "Pending") acc.pending += 1;
        else acc.unhealthy += 1;
        return acc;
      },
      { total: 0, running: 0, pending: 0, unhealthy: 0 }
    );

    const cpuAverage = podData.length
      ? Number(
          (
            podData.reduce((sum, pod) => sum + pod.cpuPercent, 0) /
            podData.length
          ).toFixed(1)
        )
      : 0;
    const trackedState = appName ? getTrackedAppState(appName) : { smartFixes: 0 };
    const health =
      summary.unhealthy > 0 ? "Failed" : summary.pending > 0 ? "Recovering" : summary.running > 0 ? "Running" : "No Pods";

    return res.json({
      namespace,
      summary,
      pods: podData,
      cpuAverage,
      health,
      smartFixes: trackedState.smartFixes,
      metricsAvailable: metricsMap.size > 0,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch pod status.",
      details: getErrorDetails(error),
    });
  }
});

app.get("/api/logs", async (req, res) => {
  const appName = sanitizeAppName(req.query.appName);
  if (!appName) {
    return res.status(400).json({ error: "appName query parameter is required." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let closed = false;
  let lastLineCount = 0;
  let currentPodName = "";
  let pollHandle;

  const sendEvent = (payload) => {
    if (!closed) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const cleanup = () => {
    closed = true;
    if (pollHandle) clearInterval(pollHandle);
  };

  req.on("close", cleanup);

  try {
    const pods = await listPods(appName);
    const pod = pods.find((item) => item.status?.phase === "Running") || pods[0];

    if (!pod) {
      sendEvent({ type: "info", line: "No pods found for this app yet." });
      return res.end();
    }

    const emitNewLogs = async () => {
      let activePod;
      try {
        const currentPods = await listPods(appName);
        activePod = currentPods.find((item) => item.status?.phase === "Running") || currentPods[0];

        if (!activePod) {
          sendEvent({ type: "info", line: "Waiting for pod recreation..." });
          lastLineCount = 0;
          currentPodName = "";
          return;
        }

        const containerName = activePod.spec?.containers?.[0]?.name;
        if (activePod.metadata?.name !== currentPodName) {
          currentPodName = activePod.metadata?.name || "";
          lastLineCount = 0;
          sendEvent({ type: "info", pod: "Self Healing Cloud", line: `Attached to pod ${currentPodName}` });
        }

        const response = await coreApi.readNamespacedPodLog(
          {
            name: activePod.metadata.name,
            namespace,
            container: containerName,
            follow: false,
            tailLines: 200,
            timestamps: true,
          }
        );

        const body = typeof response === "string" ? response : "";
        const lines = body.split(/\r?\n/).filter(Boolean);

        if (lines.length < lastLineCount) {
          lastLineCount = 0;
        }

        lines.slice(lastLineCount).forEach((line) => {
          sendEvent({ type: "log", pod: activePod.metadata?.name, line });
        });

        lastLineCount = lines.length;
      } catch (error) {
        const details = getErrorDetails(error);
        if (details.includes("ContainerCreating")) {
          sendEvent({
            type: "info",
            pod: activePod?.metadata?.name || "Self Healing Cloud",
            line: "Container is still starting. Waiting for logs...",
          });
          return;
        }
        sendEvent({ type: "error", line: details });
      }
    };

    // Emit recent logs immediately, then keep polling Kubernetes and push deltas over SSE.
    await emitNewLogs();
    pollHandle = setInterval(emitNewLogs, 3000);
  } catch (error) {
    sendEvent({ type: "error", line: getErrorDetails(error) });
    cleanup();
    res.end();
  }
});

app.post("/api/chaos/crash", async (req, res) => {
  const appName = sanitizeAppName(req.body?.appName);
  if (!appName) {
    return res.status(400).json({ error: "appName is required." });
  }

  try {
    const pods = await listPods(appName);
    const targetPod = pods.find((pod) => pod.status?.phase === "Running") || pods[0];

    if (!targetPod) {
      return res.status(404).json({ error: "No pod found to delete." });
    }

    // Deleting a managed pod exercises Kubernetes self-healing by forcing a replacement pod.
    await coreApi.deleteNamespacedPod({
      name: targetPod.metadata.name,
      namespace,
    });
    getTrackedAppState(appName).smartFixes += 1;

    return res.json({
      message: "Self Healing Cloud deleted the pod successfully.",
      podName: targetPod.metadata.name,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to delete pod.",
      details: getErrorDetails(error),
    });
  }
});

app.post("/api/chaos/load", async (req, res) => {
  const appName = sanitizeAppName(req.body?.appName);
  const durationSeconds = Math.max(5, Number(req.body?.durationSeconds || 20));

  if (!appName) {
    return res.status(400).json({ error: "appName is required." });
  }

  try {
    const pods = await listPods(appName);
    const targetPod = pods.find((pod) => pod.status?.phase === "Running");

    if (!targetPod) {
      return res.status(404).json({ error: "No running pod found for load test." });
    }

    const containerName = targetPod.spec?.containers?.[0]?.name;
    const stdout = new PassThrough();
    const stderr = new PassThrough();
    let output = "";

    stdout.on("data", (chunk) => {
      output += chunk.toString();
    });

    stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    // Run a CPU-heavy shell loop inside the container to let HPA and dashboards react to real pressure.
    await execClient.exec(
      namespace,
      targetPod.metadata.name,
      containerName,
      [
        "sh",
        "-c",
        `end=$((SECONDS+${durationSeconds})); while [ $SECONDS -lt $end ]; do i=0; while [ $i -lt 25000 ]; do i=$((i+1)); done; done; echo "CPU load completed";`,
      ],
      stdout,
      stderr,
      null,
      false
    );

    return res.json({
      message: "CPU load command executed.",
      podName: targetPod.metadata.name,
      durationSeconds,
      output: output.trim(),
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to generate CPU load.",
      details: getErrorDetails(error),
    });
  }
});

app.listen(port, () => {
  console.log(`Self Healing Cloud API listening on port ${port}`);
});
