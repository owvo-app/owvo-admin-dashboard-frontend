"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Mail, Star, TrendingUp, Calendar, PoundSterling } from "lucide-react";
import { getWashers } from "@/lib/admin-api";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import WasherLocationMap from "./WasherLocationMap";

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="washer-stat-card">
      <div className="washer-stat-icon">{icon}</div>
      <div>
        <div className="washer-stat-value">{value}</div>
        <div className="washer-stat-label">{label}</div>
        {sub ? <div className="washer-stat-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

export default function WasherDetailContent({ washerId }: { washerId: string }) {
  const router = useRouter();
  const dateRange = useDashboardDateRange();

  const washersQuery = useQuery({
    queryKey: ["washers", dateRange.queryKey],
    queryFn: () => getWashers(dateRange.query),
  });

  const washers = washersQuery.data || [];
  const washer: any = washers.find((w: any) => w._id === washerId);

  if (washersQuery.isLoading) {
    return (
      <section className="data-page">
        <p>Loading washer details...</p>
      </section>
    );
  }

  if (!washer) {
    return (
      <section className="data-page">
        <button className="mini-text-button" onClick={() => router.back()} type="button">
          <ArrowLeft size={14} /> Back
        </button>
        <p>Washer not found.</p>
      </section>
    );
  }

  const completed = washer.completedJobs || {};
  const totalJobs = (completed.completed || 0) + (completed.cancelled || 0);
  const successRate = totalJobs > 0 ? Math.round(((completed.completed || 0) / totalJobs) * 100) : 0;

  const lat = washer.location?.coordinates?.[1] ?? null;
  const lng = washer.location?.coordinates?.[0] ?? null;

  const rawServices = washer.preferredServices || [];
  // Populated (objects) ya sirf IDs ho sakte hain
  const activeServices = rawServices.filter(
    (s: any) => typeof s === "object" && s.isActive,
  );
  const hasUnpopulatedServices =
    rawServices.length > 0 && activeServices.length === 0 && typeof rawServices[0] !== "object";

  return (
    <section className="data-page">
      <button className="mini-text-button" onClick={() => router.back()} type="button">
        <ArrowLeft size={14} /> Back to Washers
      </button>

      {/* Header */}
      <div className="washer-detail-header">
        <div className="washer-detail-avatar">
          {washer.profilePhoto ? (
            <img src={washer.profilePhoto} alt={washer.name} />
          ) : (
            <span>{(washer.name || "W").charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1>{washer.name || "Washer"}</h1>
          <span className={`table-status ${washer.isOnline ? "approved" : "pending"}`}>
            {washer.isOnline ? "online" : "offline"}
            {washer.isBusy ? " · on a job" : ""}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="washer-detail-map">
        <WasherLocationMap lat={lat} lng={lng} name={washer.name || "Washer"} isOnline={!!washer.isOnline} />
      </div>

      {/* Stats */}
      <div className="washer-stats-grid">
        <StatCard
          icon={<Star size={18} />}
          label="Rating"
          value={washer.customerRatingAverage ? `${washer.customerRatingAverage}` : "—"}
          sub={washer.customerRatingCount ? `${washer.customerRatingCount} reviews` : undefined}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Success Rate"
          value={`${successRate}%`}
          sub={`${completed.completed || 0} of ${totalJobs} jobs`}
        />
        <StatCard
          icon={<Calendar size={18} />}
          label="Today's Washes"
          value={`${washer.dailyWashLimit ?? 0}/${washer.dailyWashLimitMax ?? 7}`}
        />
        <StatCard
          icon={<PoundSterling size={18} />}
          label="Wallet Balance"
          value={`£${((washer.wallet?.balance || 0) / 100).toFixed(2)}`}
        />
      </div>

      {/* Details + Services */}
      <div className="washer-detail-grid">
        <div className="washer-detail-card">
          <h3>Contact & Area</h3>
          <div className="washer-detail-row">
            <Phone size={14} /> <span>{washer.phoneNumber || washer.phone || "Not provided"}</span>
          </div>
          <div className="washer-detail-row">
            <Mail size={14} /> <span>{washer.email || "Not provided"}</span>
          </div>
          <div className="washer-detail-row">
            <MapPin size={14} /> <span>{washer.serviceArea || "Not set"}</span>
          </div>
        </div>

        <div className="washer-detail-card">
          <h3>Verification</h3>
          <div className="washer-detail-row">
            <span>Status:</span>
            <span className={`table-status ${washer.adminVerification?.status || "not_submitted"}`}>
              {washer.adminVerification?.status || "not submitted"}
            </span>
          </div>
          <div className="washer-detail-row">
            <span>Working hours:</span>
            <span>
              {washer.availability?.mode === "always"
                ? "24/7"
                : `${washer.availability?.days?.monday?.startTime || "—"} – ${washer.availability?.days?.monday?.endTime || "—"}`}
            </span>
          </div>
        </div>

        <div className="washer-detail-card">
          <h3>Active Services ({activeServices.length})</h3>
          {hasUnpopulatedServices ? (
            <p className="washer-detail-muted">
              {rawServices.length} service{rawServices.length > 1 ? "s" : ""} assigned (details load with backend API).
            </p>
          ) : activeServices.length === 0 ? (
            <p className="washer-detail-muted">No active services.</p>
          ) : (
            <ul className="washer-service-list">
              {activeServices.map((s: any) => (
                <li key={s._id || s.catalogKey}>
                  {s.title} — £{s.price}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Completed jobs note — full history comes with backend endpoint */}
      <div className="washer-detail-card">
        <h3>Completed Jobs</h3>
        <p className="washer-detail-muted">
          {completed.completed || 0} completed · {completed.cancelled || 0} cancelled
        </p>
        <p className="washer-detail-muted" style={{ marginTop: 8 }}>
          Full job history will appear here once the detail API is ready.
        </p>
      </div>
    </section>
  );
}
