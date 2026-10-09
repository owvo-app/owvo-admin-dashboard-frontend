"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getBookingStats,
  type BookingStatsRange,
} from "@/lib/tracking-api";


// ── 1. Provider Status (donut chart, pure SVG) ──────────────
export function ProviderStatusCard({
  data,
}: {
  data?: { total: number; online: number; busy: number; offline: number };
}) {
  const { total, online, busy, offline } = data ?? {
    total: 0,
    online: 0,
    busy: 0,
    offline: 0,
  };
  const r = 54;
  const c = 2 * Math.PI * r;
  const segs = [
    { value: online, color: "#22a355", label: "Online" },
    { value: busy, color: "#2369e8", label: "Busy" },
    { value: offline, color: "#9aa0a6", label: "Offline" },
  ];
  let acc = 0;
  return (
    <div className="panel tracking-bottom-card">
      <div className="tracking-card-head">
        <h3>Provider Status</h3>
        <Link className="link-btn" href="/washers">View All ›</Link>
      </div>
      <div className="donut-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="#eef1f6" strokeWidth="18" />
          {segs.map((s) => {
            const frac = s.value / total;
            const el = (
              <circle
                key={s.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="18"
                strokeDasharray={`${frac * c} ${c}`}
                strokeDashoffset={-acc * c + c * 0.25}
                transform="rotate(-90 70 70)"
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return el;
          })}
          <text x="70" y="66" textAnchor="middle" fontSize="24" fontWeight="800" fill="#111827">
            {total}
          </text>
          <text x="70" y="84" textAnchor="middle" fontSize="11" fill="#667085">
            Total
          </text>
          <text x="70" y="98" textAnchor="middle" fontSize="11" fill="#667085">
            Providers
          </text>
        </svg>
        <ul className="donut-legend">
          {segs.map((s) => (
            <li key={s.label}>
              <i style={{ background: s.color }} />
              {s.label}
              <strong>
                {s.value} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── 2. Booking Statistics (stacked bar chart, real data) ─────
export function BookingStatsCard() {
  const [range, setRange] = useState<BookingStatsRange>("today");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracking-booking-stats", range],
    queryFn: () => getBookingStats(range),
    retry: 1,
    staleTime: 30000,
  });

  const hourly = data?.buckets ?? [];
  const hasData = hourly.some(
    (h) => h.completed + h.active + h.cancelled > 0
  );

  const max = Math.max(
    ...hourly.map((h) => h.completed + h.active + h.cancelled),
    1
  );
  return (
    <div className="panel tracking-bottom-card">
      <div className="tracking-card-head">
        <h3>Booking Statistics</h3>
        <select
          className="mini-select"
          value={range}
          onChange={(e) => setRange(e.target.value as BookingStatsRange)}
        >
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>
      {isLoading ? (
        <p className="tracking-empty">Loading…</p>
      ) : isError ? (
        <p className="tracking-empty">⚠️ Could not load statistics.</p>
      ) : !hasData ? (
        <p className="tracking-empty">
          No booking data available for this period.
        </p>
      ) : (
      <div className="bars-wrap">
        {hourly.map((h) => {
          return (
            <div className="bar-col" key={h.label}>
              <div className="bar-track">
                <div
                  className="bar-seg cancelled"
                  style={{ height: `${(h.cancelled / max) * 100}%` }}
                />
                <div
                  className="bar-seg active"
                  style={{ height: `${(h.active / max) * 100}%` }}
                />
                <div
                  className="bar-seg completed"
                  style={{ height: `${(h.completed / max) * 100}%` }}
                />
              </div>
              <span className="bar-label">{h.label}</span>
            </div>
          );
        })}
      </div>
      )}
      <div className="bars-legend">
        <span>
          <i style={{ background: "#22a355" }} /> Completed
        </span>
        <span>
          <i style={{ background: "#2369e8" }} /> Active
        </span>
        <span>
          <i style={{ background: "#e5484d" }} /> Cancelled
        </span>
      </div>
    </div>
  );
}

// ── 3. Top Areas ────────────────────────────────────────────
export function TopAreasCard({
  areas,
}: {
  areas?: Array<{ name: string; bookings: number }>;
}) {
  const [range, setRange] = useState<BookingStatsRange>("today");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracking-booking-stats", range],
    queryFn: () => getBookingStats(range),
    retry: 1,
    staleTime: 30000,
  });

  const list = data?.topAreas?.length ? data.topAreas : (areas ?? []);
  const max = Math.max(...list.map((a) => a.bookings), 1);
  return (
    <div className="panel tracking-bottom-card">
      <div className="tracking-card-head">
        <h3>Top Areas (Bookings)</h3>
        <select
          className="mini-select"
          value={range}
          onChange={(e) => setRange(e.target.value as BookingStatsRange)}
        >
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>
      {isLoading ? (
        <p className="tracking-empty">Loading…</p>
      ) : isError ? (
        <p className="tracking-empty">⚠️ Could not load areas.</p>
      ) : list.length === 0 ? (
        <p className="tracking-empty">
          No area data available for this period.
        </p>
      ) : (
      <ol className="areas-list">
        {list.map((a, i) => (
          <li key={a.name}>
            <span className="area-rank">{i + 1}</span>
            <span className="area-name">{a.name}</span>
            <span className="area-bar">
              <i style={{ width: `${(a.bookings / max) * 100}%` }} />
            </span>
            <span className="area-count">{a.bookings}</span>
          </li>
        ))}
      </ol>
      )}
    </div>
  );
}

// ── 4. Recent Activity ──────────────────────────────────────
export function RecentActivityCard({
  items,
}: {
  items?: Array<{ time: string; text: string; color: "red" | "blue" | "green" }>;
}) {
  const colors = { red: "#e5484d", blue: "#2369e8", green: "#22a355" };
  const list = items ?? [];
  return (
    <div className="panel tracking-bottom-card">
      <div className="tracking-card-head">
        <h3>Recent Activity</h3>
        <Link className="link-btn" href="/system-logs">View All ›</Link>
      </div>
      {list.length === 0 ? (
        <p className="tracking-empty">No recent activity.</p>
      ) : (
      <ul className="activity-list">
        {list.map((a, i) => (
          <li key={i}>
            <span className="activity-time">{a.time}</span>
            <i className="dot" style={{ background: colors[a.color] }} />
            <span className="activity-text">{a.text}</span>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
