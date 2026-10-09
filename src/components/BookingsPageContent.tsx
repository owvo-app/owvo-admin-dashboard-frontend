"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { TrackingMap } from "@/components/tracking/TrackingMap";
import {
  BookingStatsCard,
  ProviderStatusCard,
  RecentActivityCard,
  TopAreasCard,
} from "@/components/tracking/TrackingBottomCards";
import {
  getTrackingLive,
  type ApiTrackingBooking,
} from "@/lib/tracking-api";
import {
  statusMeta,
  type TrackingBooking,
  type TrackingStatus,
} from "@/lib/tracking-mock";

const filters: Array<{ key: TrackingStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "accepted", label: "Accepted" },
  { key: "arrived", label: "Arrived" },
  { key: "in_progress", label: "In progress" },
];

// Backend status → UI status
function mapStatus(s: string): TrackingStatus {
  if (s === "ongoing") return "in_progress";
  if (s === "accepted" || s === "arrived" || s === "in_progress") return s;
  return "accepted";
}

/** Real API booking → UI booking (driveway = washer fixed pin) */
function mapApiBooking(b: ApiTrackingBooking): TrackingBooking {
  return {
    id: b.id,
    status: mapStatus(b.status),
    washerStatus: b.washerStatus,
    travelMode: "customer_to_washer",
    service: b.service,
    price: b.price,
    washerName: b.washerName,
    washerPhone: b.washerPhone,
    customerName: b.customerName,
    address: b.drivewayAddress || b.address,
    eta: b.etaMinutes != null ? `${b.etaMinutes} min` : "—",
    distanceMiles: b.distanceMiles ?? undefined,
    startedAt: b.startedAt ? new Date(b.startedAt).toTimeString().slice(0, 5) : "",
    washerLat: b.drivewayLat ?? 51.5074,
    washerLng: b.drivewayLng ?? -0.1278,
    customerLat: b.customerLat ?? b.drivewayLat ?? 51.5074,
    customerLng: b.customerLng ?? b.drivewayLng ?? -0.1278,
    hasLiveCustomer: b.customerLat != null && b.customerLng != null,
  };
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div>
        <p className="metric-label">{label}</p>
        <p className="metric-value">{value}</p>
        <p className="metric-sub">{sub}</p>
      </div>
      <div className={`metric-icon ${tone}`}>{icon}</div>
    </div>
  );
}

function BookingCard({
  booking,
  active,
  onClick,
}: {
  booking: TrackingBooking;
  active: boolean;
  onClick: () => void;
}) {
  const meta = statusMeta[booking.status];
  return (
    <button
      className={active ? "tracking-card active" : "tracking-card"}
      onClick={onClick}
    >
      <div className="tracking-card-top">
        <span className="tracking-card-id">{booking.id}</span>
        <span
          className="tracking-badge"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      <p className="tracking-card-service">
        {booking.service} · £{booking.price}
      </p>
      <p className="tracking-card-row">
        <UserRoundCheck size={13} /> {booking.washerName}
        <span className="tracking-card-eta">
          ETA {booking.eta}
          {booking.distanceMiles != null && ` · ${booking.distanceMiles} mi`}
        </span>
      </p>
      <p className="tracking-card-row muted">
        <MapPin size={13} /> {booking.address}
      </p>
      <p className="tracking-card-row muted">
        <UsersRound size={13} /> {booking.customerName}
        <a
          className="tracking-card-phone"
          href={`tel:${booking.washerPhone.replace(/\s/g, "")}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone size={13} /> {booking.washerPhone}
        </a>
      </p>
    </button>
  );
}

export function TrackingPageContent() {
  const [filter, setFilter] = useState<TrackingStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tick, setTick] = useState(0);

  // Real API — 20s polling. Koi mock fallback nahi: khali ho to khali dikhao.
  const {
    data: live,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["tracking-live"],
    queryFn: getTrackingLive,
    refetchInterval: autoRefresh ? 20000 : false,
    retry: 1,
    staleTime: 15000,
  });

  const emptyStats = {
    activeBookings: 0,
    washersOnline: 0,
    inProgress: 0,
    completedToday: 0,
    customersTravelling: 0,
  };
  const stats = live?.stats ?? emptyStats;
  const providerStatus = live?.providerStatus;
  const recentActivity = live?.recentActivity ?? [];

  const bookings = useMemo(() => {
    const list: TrackingBooking[] = live
      ? live.bookings.map(mapApiBooking)
      : [];
    void tick; // manual refresh
    return filter === "all" ? list : list.filter((b) => b.status === filter);
  }, [filter, tick, live]);

  return (
    <div className="tracking-page">
      <div className="tracking-header">
        <div>
          <h1 className="tracking-title">Live Tracking</h1>
          <p className="tracking-subtitle">
            Real-time view of active bookings, washers and job locations.
          </p>
        </div>
        <div className="tracking-actions">
          <label className="tracking-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <RefreshCw size={14} />
            Auto-refresh
          </label>
          <button
            className="tracking-refresh-btn"
            onClick={() => {
              setTick((t) => t + 1);
              refetch();
            }}
            title="Refresh now"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {isError && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          ⚠️ Could not load live tracking data. Check your internet connection
          and{" "}
          <button
            onClick={() => refetch()}
            style={{
              textDecoration: "underline",
              fontWeight: 700,
              background: "none",
              border: "none",
              color: "#B91C1C",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            try again
          </button>
          .
        </div>
      )}

      <div className="metric-grid tracking-stats">
        <StatCard
          label="Active Bookings"
          value={stats.activeBookings}
          sub="right now"
          icon={<CalendarCheck size={22} />}
          tone="blue"
        />
        <StatCard
          label="Washers Online"
          value={stats.washersOnline}
          sub="available"
          icon={<UserRoundCheck size={22} />}
          tone="green"
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          sub="being washed"
          icon={<Loader2 size={22} />}
          tone="purple"
        />
        <StatCard
          label="Completed Today"
          value={stats.completedToday}
          sub="all washers"
          icon={<CheckCircle2 size={22} />}
          tone="orange"
        />
        <StatCard
          label="Customers Travelling"
          value={stats.customersTravelling}
          sub="to provider location"
          icon={<Clock size={22} />}
          tone="teal"
        />
      </div>

      <div className="tracking-filters">
        {filters.map((f) => (
          <button
            key={f.key}
            className={filter === f.key ? "chip active" : "chip"}
            onClick={() => {
              setFilter(f.key);
              setSelectedId(null);
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="tracking-body">
        <div className="tracking-map-wrap panel">
          <TrackingMap
            bookings={bookings}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <div className="tracking-legend-overlay">
            <span>
              <i className="pin-legend" style={{ background: "#22a355" }} />
              Provider (Online)
            </span>
            <span>
              <i className="pin-legend" style={{ background: "#9aa0a6" }} />
              Provider (Offline)
            </span>
            <span>
              <i className="pin-legend" style={{ background: "#2369e8" }} />
              Provider (Busy)
            </span>
            <span>
              <i className="pin-legend" style={{ background: "#e5484d" }} />
              Customer
            </span>
            <span>
              <i className="line-legend dotted" />
              Customer Travelling
            </span>
            <span>
              <i className="line-legend solid" />
              Active Booking Route
            </span>
          </div>
        </div>

        <aside className="tracking-list panel">
          <h2 className="tracking-list-title">
            Active bookings ({bookings.length})
          </h2>
          <div className="tracking-list-scroll">
            {isLoading && (
              <p className="tracking-empty">Loading live bookings…</p>
            )}
            {!isLoading &&
              bookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                active={selectedId === b.id}
                onClick={() =>
                  setSelectedId(selectedId === b.id ? null : b.id)
                }
              />
            ))}
            {!isLoading && bookings.length === 0 && !isError && (
              <p className="tracking-empty">
                No active bookings right now.
              </p>
            )}
          </div>
        </aside>
      </div>

      <div className="tracking-bottom-grid">
        <ProviderStatusCard data={providerStatus} />
        <BookingStatsCard />
        <TopAreasCard />
        <RecentActivityCard items={recentActivity} />
      </div>
    </div>
  );
}
