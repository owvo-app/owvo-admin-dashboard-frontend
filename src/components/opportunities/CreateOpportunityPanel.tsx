"use client";

import {
  createOpportunity,
  getAdminServicesPricing,
  getWashers,
} from "@/lib/admin-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const typeOptions = [
  "daily", "weekly", "custom",
  "location", "service", "milestone", "referral",
];

const typeHints: Record<string, string> = {
  daily: "Resets every day — e.g. complete 5 bookings today",
  weekly: "Runs for a full week — e.g. 20 bookings this week",
  custom: "Your own date range and rules",
  location: "Only counts bookings in a specific area",
  service: "Only counts a specific service",
  milestone: "One-time achievement — e.g. first 10 bookings",
  referral: "Reward for referring new providers",
};

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
  const [hasSpecificTime, setHasSpecificTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState("");
  const [error, setError] = useState("");

  const washersQuery = useQuery({
    queryKey: ["washers-list"],
    queryFn: () => getWashers(),
    enabled: audience === "selected" || type === "location",
  });

  const servicesQuery = useQuery({
    queryKey: ["services-pricing"],
    queryFn: () => getAdminServicesPricing(),
    enabled: type === "service",
  });

  const services = (() => {
    const d: any = servicesQuery.data;
    if (!d) return [];
    if (Array.isArray(d)) return d;
    return d.items || d.services || [];
  })();

  const washers = Array.isArray(washersQuery.data) ? washersQuery.data : [];

  const uniqueAreas = [...new Set(
    washers.map((w: any) => w.serviceArea).filter(Boolean)
  )] as string[];
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

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
        ...(type === "location"
          ? { location: [...selectedAreas, location.trim()].filter(Boolean).join(", ") }
          : {}),
        ...(type === "service" && serviceId ? { service: serviceId } : {}),
        ...(audience === "selected" && selectedProviders.length > 0
          ? { selectedProviders } : {}),
        ...(audience === "areas" && serviceAreas.trim() ? { serviceAreas: serviceAreas.trim() } : {}),
        ...(hasSpecificTime ? { hasSpecificTime: true, startTime, endTime } : {}),
      } as any),
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
    if (type === "location" && selectedAreas.length === 0 && !location.trim())
      return setError("Select or enter at least one area");
    if (type === "service" && !serviceId) return setError("Please select a service");
    if (audience === "selected" && selectedProviders.length === 0) return setError("Select at least one provider");
    if (audience === "areas" && !serviceAreas.trim()) return setError("Enter at least one service area");
    if (!startDate) return setError("Start date is required");
    if (!endDate) return setError("End date is required");
    if (hasSpecificTime && (!startTime || !endTime)) return setError("Start and end time are required");
    createMutation.mutate();
  };

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
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
      <p className="table-sub" style={{ marginTop: 4, marginBottom: 8 }}>
        {typeHints[type]}
      </p>

      {/* Conditional: location - area list + manual entry */}
      {type === "location" && (
        <>
          <label className="modal-label">Target Area(s) *</label>
          {uniqueAreas.length > 0 && (
            <div className="opp-type-pills" style={{ marginBottom: 8 }}>
              {uniqueAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  className={selectedAreas.includes(area) ? "active" : ""}
                  onClick={() => toggleArea(area)}
                >
                  {area}
                </button>
              ))}
            </div>
          )}
          <input
            className="modal-input"
            placeholder="Or type area manually, e.g. Bromley"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <p className="table-sub" style={{ marginTop: 4, marginBottom: 8 }}>
            Select from provider areas above, or type a custom area
          </p>
        </>
      )}

      {/* Conditional: service dropdown */}
      {type === "service" && (
        <>
          <label className="modal-label">Service *</label>
          <select
            className="modal-input"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Select a service...</option>
            {services.map((s: any) => (
              <option key={s._id} value={s._id}>
                {s.title || s.name}
              </option>
            ))}
          </select>
        </>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="modal-label">
            Target * {type === "referral" ? "(referrals)" : "(bookings)"}
          </label>
          <input
            className="modal-input"
            type="number"
            min="1"
            placeholder={type === "referral" ? "Number of referrals" : "Number of bookings"}
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

      {/* Conditional: provider picker */}
      {audience === "selected" && (
        <div className="opp-provider-list">
          {washersQuery.isLoading && <p className="table-sub">Loading providers...</p>}
          {washers.map((w: any) => (
            <label key={w._id} className="opp-radio">
              <input
                type="checkbox"
                checked={selectedProviders.includes(w._id)}
                onChange={() => toggleProvider(w._id)}
              />
              {w.name || w.email}
            </label>
          ))}
          {!washersQuery.isLoading && washers.length === 0 && (
            <p className="table-sub">No providers found.</p>
          )}
        </div>
      )}

      {/* Conditional: service areas input */}
      {audience === "areas" && (
        <>
          <label className="modal-label">Service Areas *</label>
          <input
            className="modal-input"
            placeholder="e.g. Bromley, Croydon, Lewisham"
            value={serviceAreas}
            onChange={(e) => setServiceAreas(e.target.value)}
          />
          <p className="table-sub" style={{ marginTop: 4 }}>Comma-separated area names</p>
        </>
      )}

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

      {/* Time toggle */}
      <label className="opp-radio" style={{ marginTop: 12 }}>
        <input
          type="checkbox"
          checked={hasSpecificTime}
          onChange={(e) => setHasSpecificTime(e.target.checked)}
        />
        Set specific time
      </label>

      {hasSpecificTime && (
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="modal-label">Start Time</label>
            <input
              className="modal-input"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label className="modal-label">End Time</label>
            <input
              className="modal-input"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>
      )}

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
