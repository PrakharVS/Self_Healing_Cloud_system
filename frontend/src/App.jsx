import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";
import DemoDashboard from "./DemoDashboard";
import Landing from "./Landing";
import React from "react";
export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <Link className="brand" to="/">
            Self Healing Cloud
          </Link>
          <p className="brand-subtitle">Autonomous Kubernetes Self-Healing Platform</p>
        </div>

        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/dashboard">Real Mode</Link>
          <Link to="/demo">Demo Mode</Link>
        </nav>
      </header>

      <main className="page-shell">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/demo" element={<DemoDashboard />} />
        </Routes>
      </main>
    </div>
  );
}
