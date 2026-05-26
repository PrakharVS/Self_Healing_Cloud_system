# Self-Healing Cloud System

An engineering framework designed to transition cloud infrastructure from reactive monitoring to proactive, autonomic resilience. This repository features an intelligent closed-loop remediation layer running natively on top of **Kubernetes**, utilizing a telemetry collection stack paired with a custom **Remediation Controller** to automatically isolate faults and repair distributed system states without human intervention.

---

## 🏛️ Architectural Framework (MAPE-K Loop)

[cite_start]The system architecture transitions infrastructure management from a traditional "Human-in-the-loop" pattern [cite: 151] [cite_start]into a digital reflex loop by fully realizing the **IBM Autonomic Computing paradigm** via a closed **MAPE-K** loop[cite: 378, 442]:

* [cite_start]**Monitor (Ingestion):** Continuously scrapes the "Golden Signals" of microservice health (Latency, Traffic, Errors, and Saturation) utilizing Prometheus metrics collection[cite: 158, 260].
* [cite_start]**Analyse (Diagnosis):** Evaluates trend data over time and executes real-time pattern tracking to effectively distinguish between a transient crash, resource exhaustion, and complex cascading dependencies[cite: 159, 160, 1064].
* [cite_start]**Plan (Decision Engine):** Employs context-aware rule mapping to determine the exact minimum effective recovery strategy required to mitigate systemic risks[cite: 436, 554, 802].
* [cite_start]**Execute (Remediation):** Directly interfaces with the Kubernetes API Server to perform rolling automated infrastructure actions[cite: 939].
* [cite_start]**Knowledge Base:** Logs every fault event, telemetry state, and remediation outcome to adaptively track what actions resolve specific failures[cite: 448].

---

## 🚀 Key Project Capabilities

* [cite_start]**Radical MTTR Reduction:** Replaces human-scale operations with machine-scale automation, successfully compressing Mean Time to Repair (**MTTR**) by **over 85%** during testing[cite: 165, 454].
* [cite_start]**Context-Aware Remediation Engine:** Intelligently maps distinct infrastructure faults to precise target actions[cite: 432]:
    * [cite_start]*Application Crash:* Triggers container recycling and enforces standard K8s restart rules[cite: 741].
    * [cite_start]*Traffic Surges:* Auto-scales active container deployment boundaries via a Horizontal Pod Autoscaler (HPA)[cite: 400, 401, 1089].
    * [cite_start]*Memory Leaks:* Programmatically throttles active workloads to limit memory exhaustion[cite: 978, 979].
    * [cite_start]*Configuration Drift:* Initiates zero-downtime microservice rollbacks[cite: 981].
    * [cite_start]*Database Contention:* Triggers automated cluster failover routes[cite: 982, 983].
* [cite_start]**Chaos Engineering Validation:** Validated under extreme simulated operational degradation to guarantee full cluster availability (targeting 99.9% uptime) during cascading failover stress tests[cite: 163, 164, 166].

---

## 🛠️ System Stack & Technologies

* [cite_start]**Orchestration Engine:** Kubernetes (Native API, Deployments, Pods, Services) [cite: 916, 953, 955]
* [cite_start]**Backend System Core:** Node.js, Express Framework (`server.js`) [cite: 137]
* [cite_start]**Telemetry Stack:** Prometheus, Grafana Telemetry Visualization Dashboards [cite: 156, 340]
* [cite_start]**Testing Infrastructure:** Chaos Engineering Injection Frameworks [cite: 163]

---

## 📂 Project Directory Structure

```text
├── frontend/               # Modular static application asset layer
├── k8s-template.yaml       # Parameterized Kubernetes manifest blueprint with health probes
├── package-lock.json       # Strict application dependency lock tree
├── package.json            # Node.js project metadata and configuration scripts
└── server.js               # Core Express engine & diagnostics endpoint controller
