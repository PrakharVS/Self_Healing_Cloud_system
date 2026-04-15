import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deployApp } from "./api";
import React from "react";
const defaultForm = {
  appName: "self-healing-demo",
  image: "nginx",
};

export default function Landing() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("");
    setError("");

    try {
      const data = await deployApp(form);
      setMessage(`Deployment submitted for ${data.appName}. Redirecting to the real dashboard...`);
      navigate(`/dashboard?appName=${encodeURIComponent(data.appName)}`);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="landing-shell">
      <div className="hero-copy center">
        <span className="eyebrow">Autonomous Recovery</span>
        <h1>Self Healing Cloud</h1>
        <p className="landing-subtitle">Autonomous Kubernetes Self-Healing Platform</p>
        <p>
          Launch a real Kubernetes workload, observe live health and performance, or switch to a full simulation that
          demonstrates autonomous remediation flows without touching your cluster.
        </p>

        <div className="landing-actions">
          <button className="primary-button" type="button" onClick={() => setShowForm((current) => !current)}>
            Create App
          </button>
          <button className="demo-button" type="button" onClick={() => navigate("/demo")}>
            Start Demo
          </button>
        </div>
      </div>

      {showForm ? (
        <form className="deploy-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <h2>Deploy a Real Application</h2>
            <p>Provide an application name and a Docker image to create a real Kubernetes deployment.</p>
          </div>

          <label>
            <span>App Name</span>
            <input
              name="appName"
              value={form.appName}
              onChange={handleChange}
              placeholder="self-healing-demo"
              required
            />
          </label>

          <label>
            <span>Docker Image</span>
            <input name="image" value={form.image} onChange={handleChange} placeholder="nginx" required />
          </label>

          {message ? <div className="notice success">{message}</div> : null}
          {error ? <div className="notice error">{error}</div> : null}

          <div className="button-row">
            <button className="primary-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Deploying..." : "Create App"}
            </button>
            <button className="secondary-button" type="button" onClick={() => navigate("/dashboard")}>
              Open Real Dashboard
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
