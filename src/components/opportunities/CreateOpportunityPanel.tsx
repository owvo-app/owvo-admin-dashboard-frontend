"use client";

import {
  createOpportunity,
  getAdminServicesPricing,
  getWashers,
  updateOpportunity,
  type Opportunity,
} from "@/lib/admin-api";
import { getBookingStats } from "@/lib/tracking-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PlaceAutocomplete } from "./PlaceAutocomplete";

const typeOptions = [
  "daily", "weekly", "custom",
  "location", "service", "milestone", "referral",
];

const typeInfo: Record<string, { hint: string; detail: string }> = {
  daily: {
    hint: "Resets every day at midnight",
    detail: "Provider must complete the target within a single day. Progress resets at midnight.",
  },
  weekly: {
    hint: "Runs Monday to Sunday",
    detail: "Provider has the full week to reach the target. Progress resets every Monday.",
  },
  custom: {
    hint: "Your own start and end dates",
    detail: "Set any date range. Useful for weekend pushes, holiday seasons, or special events.",
  },
  location: {
    hint: "Only counts bookings in specific area(s)",
    detail: "Great for launching in a new area. Only bookings from customers in the selected areas count toward the target.",
  },
  service: {
    hint: "Only counts a specific service",
    detail: "Push a premium or new service. Only completed bookings of the selected service count.",
  },
  milestone: {
    hint: "One-time achievement per provider",
    detail: "Each provider can earn this once — e.g. 'Complete your first 10 bookings, get £60'. After claiming, they can't earn it again.",
  },
  referral: {
    hint: "Reward for bringing new providers",
    detail: "Provider earns the reward for each new washer who joins with their referral code and completes onboarding.",
  },
};

export function CreateOpportunityPanel({
  onClose,
  editing,
}: {
  onClose: () => void;
  editing?: Opportunity | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!editing;
  const [name, setName] = useState(editing?.name || "");
  const [type, setType] = useState<string>(editing?.type || "daily");
  const [target, setTarget] = useState(editing?.target ? String(editing.target) : "");
  const [reward, setReward] = useState(editing?.rewardAmount ? String(editing.rewardAmount) : "");
  const [description, setDescription] = useState(editing?.description || "");
  const [audience, setAudience] = useState(editing?.audience || "all");
  const [startDate, setStartDate] = useState(
    editing?.startDate ? new Date(editing.startDate).toISOString().slice(0, 10) : ""
  );
  const [endDate, setEndDate] = useState(
    editing?.endDate ? new Date(editing.endDate).toISOString().slice(0, 10) : ""
  );
  const [hasSpecificTime, setHasSpecificTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [manualArea, setManualArea] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState("");
  const [error, setError] = useState("");

  // Top areas from tracking stats (like Live Tracking page)
  const areasQuery = useQuery({
    queryKey: ["booking-stats-month"],
    queryFn: () => getBookingStats("month"),
    enabled: type === "location",
    staleTime: 60000,
  });
  const topAreas = areasQuery.data?.topAreas ?? [];

  // Washers for provider picker
  const washersQuery = useQuery({
    queryKey: ["washers-list"],
    queryFn: () => getWashers(),
    enabled: audience === "selected",
  });
  const washers = Array.isArray(washersQuery.data) ? washersQuery.data : [];
  const washersDebug = !Array.isArray(washersQuery.data)
    ? `Unexpected shape: ${typeof washersQuery.data}`
    : null;

  // Active catalog services
  const servicesQuery = useQuery({
    queryKey: ["services-pricing"],
    queryFn: () => getAdminServicesPricing(),
    enabled: type === "service",
  });
  const catalogServices = servicesQuery.data?.catalogServices ?? [];
  const activeServices = catalogServices.filter((s: any) => s.isActive !== false);

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const toggleProvider = (id: string) => {
    setSelectedProviders((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) =>
      isEditing && editing
        ? updateOpportunity(editing._id, data)
        : createOpportunity(data),
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
    if (type === "location" && selectedAreas.length === 0 && !manualArea.trim())
      return setError("Select or enter at least one area");
    if (type === "service" && !serviceId) return setError("Please select a service");
    if (audience === "selected" && selectedProviders.length === 0)
      return setError("Select at least one provider");
    if (audience === "areas" && !serviceAreas.trim())
      return setError("Enter at least one service area");
    if (!startDate) return setError("Start date is required");
    if (!endDate) return setError("End date is required");
    if (hasSpecificTime && (!startTime || !endTime))
      return setError("Start and end time are required");

    const payload: any = {
      name: name.trim(),
      description: description.trim(),
      type,
      target: Number(target),
      rewardAmount: Number(reward),
      audience,
      startDate,
      endDate,
      ...(type === "location"
        ? { location: [...selectedAreas, manualArea.trim()].filter(Boolean).join(", ") }
        : {}),
      ...(type === "service" && serviceId ? { service: serviceId } : {}),
      ...(audience === "selected" && selectedProviders.length > 0
        ? { selectedProviders } : {}),
      ...(audience === "areas" && serviceAreas.trim() ? { serviceAreas: serviceAreas.trim() } : {}),
      ...(hasSpecificTime ? { hasSpecificTime: true, startTime, endTime } : {}),
    };

    // When editing an active campaign, lock target/type changes
    if (isEditing && editing?.status === "active") {
      delete payload.target;
      delete payload.type;
    }

    saveMutation.mutate(payload);
  };

  return (
    <div className="opp-create-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>{isEditing ? "Edit Opportunity" : "Create New Opportunity"}</h3>
        <button className="booking-filter-reset" onClick={onClose} type="button" style={{ padding: "4px 10px" }}>
          ✕
        </button>
      </div>

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
            disabled={isEditing && editing?.status === "active"}
            style={{ textTransform: "capitalize", opacity: isEditing && editing?.status === "active" ? 0.5 : 1 }}
          >
            {t}
          </button>
        ))}
      </div>
      {isEditing && editing?.status === "active" && (
        <p className="table-sub" style={{ marginBottom: 8 }}>
          ⚠️ Active campaign: type and target are locked to protect provider progress.
        </p>
      )}
      <div className="opp-type-info">
        <strong>{typeInfo[type].hint}</strong>
        <p>{typeInfo[type].detail}</p>
      </div>

      {/* LOCATION: Top areas like Live Tracking + manual */}
      {type === "location" && (
        <>
          <label className="modal-label">Target Area(s) *</label>
          {areasQuery.isLoading && <p className="table-sub">Loading top areas...</p>}
          {topAreas.length > 0 && (
            <div className="opp-areas-list">
              {topAreas.map((a) => (
                <button
                  key={a.name}
                  type="button"
                  className={selectedAreas.includes(a.name) ? "active" : ""}
                  onClick={() => toggleArea(a.name)}
                >
                  <span>{a.name}</span>
                  <span className="opp-area-count">{a.bookings} bookings</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <PlaceAutocomplete
              value={manualArea}
              onChange={setManualArea}
              placeholder="Type postcode or area, e.g. SE15 or Bromley"
            />
          </div>
          {selectedAreas.length > 0 && (
            <p className="table-sub" style={{ marginTop: 4 }}>
              Selected: {selectedAreas.join(", ")}
            </p>
          )}
        </>
      )}

      {/* SERVICE: Active services dropdown */}
      {type === "service" && (
        <>
          <label className="modal-label">Service *</label>
          {servicesQuery.isLoading && <p className="table-sub">Loading services...</p>}
          {!servicesQuery.isLoading && (
            <select
              className="modal-input"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              <option value="">Select a service...</option>
              {activeServices.map((s: any) => (
                <option key={s._id} value={s._id}>
                  {s.title || s.name} — £{s.price}
                </option>
              ))}
            </select>
          )}
          {!servicesQuery.isLoading && activeServices.length === 0 && (
            <p className="table-sub">No active services. Add services in Services & Pricing first.</p>
          )}
        </>
      )}

      {/* MILESTONE: info box */}
      {type === "milestone" && (
        <div className="opp-info-box">
          <strong>🏆 How milestones work</strong>
          <p>Each provider earns this <strong>once</strong>. Set a target like "10 bookings" — when a provider completes their 10th booking during this campaign, they can claim the £ reward. After claiming, it's done for them.</p>
        </div>
      )}

      {/* REFERRAL: info box */}
      {type === "referral" && (
        <div className="opp-info-box">
          <strong>👥 How referrals work</strong>
          <p>Provider shares their referral code. When a new washer joins with that code and completes onboarding, the referrer earns the reward. Target = number of successful referrals needed.</p>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="modal-label">
            Target * {type === "referral" ? "(referrals)" : "(bookings)"}
          </label>
          <input
            className="modal-input"
            type="number"
            min="1"
            placeholder={type === "referral" ? "e.g. 3 referrals" : "e.g. 5 bookings"}
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
        placeholder="Short description providers will see in the app..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      <label className="modal-label">Audience *</label>
      <div className="opp-audience">
        <label className="opp-radio">
          <input type="radio" name="audience" checked={audience === "all"} onChange={() => setAudience("all")} />
          <span><strong>All eligible providers</strong><br /><span className="table-sub">Every active provider can participate</span></span>
        </label>
        <label className="opp-radio">
          <input type="radio" name="audience" checked={audience === "selected"} onChange={() => setAudience("selected")} />
          <span><strong>Selected providers</strong><br /><span className="table-sub">Only chosen providers see this campaign</span></span>
        </label>
        <label className="opp-radio">
          <input type="radio" name="audience" checked={audience === "areas"} onChange={() => setAudience("areas")} />
          <span><strong>Selected service areas</strong><br /><span className="table-sub">Providers working in these areas</span></span>
        </label>
      </div>

      {audience === "selected" && (
        <div className="opp-provider-list">
          {washersQuery.isLoading && <p className="table-sub">Loading providers...</p>}
          {washersQuery.isError && (
            <p className="error-state" style={{ fontSize: 12 }}>
              Could not load providers: {(washersQuery.error as any)?.response?.data?.message || (washersQuery.error as any)?.message || "unknown error"}
            </p>
          )}
          {washers.map((w: any) => (
            <label key={w._id} className="opp-radio">
              <input
                type="checkbox"
                checked={selectedProviders.includes(w._id)}
                onChange={() => toggleProvider(w._id)}
              />
              <span>{w.name || w.email} {w.serviceArea ? <span className="table-sub">({w.serviceArea})</span> : null}</span>
            </label>
          ))}
          {!washersQuery.isLoading && washers.length === 0 && !washersQuery.isError && (
            <p className="table-sub">
              No providers found.
              {washersDebug && <><br />Debug: {washersDebug}</>}
              {washersQuery.data && !Array.isArray(washersQuery.data) && (
                <><br />Raw: {JSON.stringify(washersQuery.data).slice(0, 200)}</>
              )}
            </p>
          )}
          {selectedProviders.length > 0 && (
            <p className="table-sub">{selectedProviders.length} selected</p>
          )}
        </div>
      )}

      {audience === "areas" && (
        <>
          <label className="modal-label">Service Areas *</label>
          <PlaceAutocomplete
            value={serviceAreas}
            onChange={setServiceAreas}
            placeholder="Type postcode or area, e.g. SE15 or Bromley"
          />
          <p className="table-sub" style={{ marginTop: 4 }}>Type an area — suggestions appear below</p>
        </>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <label className="modal-label">Start Date *</label>
          <input className="modal-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="modal-label">End Date *</label>
          <input className="modal-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <label className="opp-radio" style={{ marginTop: 12 }}>
        <input type="checkbox" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} />
        Set specific time
      </label>

      {hasSpecificTime && (
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label className="modal-label">Start Time</label>
            <input className="modal-input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="modal-label">End Time</label>
            <input className="modal-input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
      )}

      {error && <p className="error-state" style={{ marginTop: 12 }}>{error}</p>}

      <button
        className="booking-create-btn"
        style={{ width: "100%", marginTop: 16, padding: "12px" }}
        onClick={handleSubmit}
        disabled={saveMutation.isPending}
        type="button"
      >
        {saveMutation.isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Campaign")}
      </button>

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
