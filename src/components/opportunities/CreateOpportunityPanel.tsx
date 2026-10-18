"use client";

import { createOpportunity } from "@/lib/admin-api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const typeOptions = [
  "daily", "weekly", "custom",
  "location", "service", "milestone", "referral",
];

export function CreateOpportunityPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("daily");
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      createOpportunity({
        name: name.trim(),
        description: description.trim(),
        type,
        target: Number(target),
        rewardAmount: Number(reward),
        audience,
        startDate,
        endDate,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-opportunities"] });
      onClose();
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message || "Failed to create opportunity");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!name.trim()) return setError("Campaign name is required");
    if (!target || Number(target) < 1) return setError("Target must be at least 1");
    if (!reward || Number(reward) < 0) return setError("Reward amount is required");
    if (!startDate) return setError("Start date is required");
    if (!endDate) return setError("End date is required");
    createMutation.mutate();
  };

  return (
    <div className="opp-create-panel">
      <h3>Create New Opportunity</h3>

      <label className="modal-label">Campaign Name *</label>
      <input
        className="modal-input"
        placeholder="e.g. Complete 5 bookings today"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <label className="modal-label">Campaign Type *</label>
      <div className="opp-type-pills">
        {typeOptions.map((t) => (
          <button
            key={t}
            type="button"
            className={type === t ? "active" : ""}
            onClick={() => setType(t)}
            style={{ textTransform: "capitalize" }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="modal-label">Target *</label>
          <input
            className="modal-input"
            type="number"
            min="1"
            placeholder="Number of bookings"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="modal-label">Reward Amount (£) *</label>
          <input
            className="modal-input"
            type="number"
            min="0"
            placeholder="e.g. 20"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
          />
        </div>
      </div>

      <label className="modal-label">Description</label>
      <textarea
        className="modal-input"
        placeholder="Short description for providers..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <label className="modal-label">Audience *</label>
      <div className="opp-audience">
        {[
          { v: "all", l: "All eligible providers" },
          { v: "selected", l: "Selected providers" },
          { v: "areas", l: "Selected service areas" },
        ].map((a) => (
          <label key={a.v} className="opp-radio">
            <input
              type="radio"
              name="audience"
              checked={audience === a.v}
              onChange={() => setAudience(a.v)}
            />
            {a.l}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="modal-label">Start Date *</label>
          <input
            className="modal-input"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="modal-label">End Date *</label>
          <input
            className="modal-input"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="error-state" style={{ marginTop: 12 }}>{error}</p>}

      <button
        className="booking-create-btn"
        style={{ width: "100%", marginTop: 16, padding: "12px" }}
        onClick={handleSubmit}
        disabled={createMutation.isPending}
        type="button"
      >
        {createMutation.isPending ? "Creating..." : "Create Campaign"}
      </button>

      {/* Live preview */}
      <div className="opp-preview">
        <h4>Preview in Provider App</h4>
        <div className="opp-preview-card">
          <div className="opp-preview-icon">🎁</div>
          <div>
            <strong>{name || "Complete 5 bookings today"}</strong>
            <p>and get £{reward || "20"} extra</p>
            <div className="opp-preview-meta">
              <span className="opp-status opp-status-active">Active</span>
              <span>0/{target || "5"} completed</span>
            </div>
            <div className="opp-preview-bar">
              <div style={{ width: "0%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
