"use client";

import type { ReactNode } from "react";

/* ── blob helpers ── */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function openBlobInTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ── formatting ── */
export const repDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export const repDateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const PALETTE = [
  "#0B1F2D",
  "#F7B500",
  "#2E9E5B",
  "#3E7CB1",
  "#9AA5B1",
  "#8E44AD",
  "#E67E22",
  "#C0392B",
];

/* ── comparison chip ── */
export function PctChip({ value }: { value: number | null }) {
  if (value == null)
    return <span className="rep-chip rep-chip-flat">— vs prev</span>;
  const up = value >= 0;
  return (
    <span className={`rep-chip ${up ? "rep-chip-up" : "rep-chip-down"}`}>
      {up ? "▲" : "▼"} {Math.abs(value)}% <em>vs prev period</em>
    </span>
  );
}

/* ── loading / error / empty states ── */
export function StateBlock({
  loading,
  error,
  empty,
  emptyText,
  onRetry,
  children,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading) return <div className="rep-state">Loading…</div>;
  if (error)
    return (
      <div className="rep-state rep-state-error">
        <p>Could not load this data. Check your connection and try again.</p>
        {onRetry ? (
          <button type="button" className="rep-btn rep-btn-dark" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    );
  if (empty)
    return <div className="rep-state">{emptyText || "No data available for this range."}</div>;
  return <>{children}</>;
}

/* ── two-series line chart (haath ka bana SVG — koi library nahi) ── */
export function RepLineChart({
  points,
  aName,
  bName,
  aColor = "#0B1F2D",
  bColor = "#F7B500",
  moneyY = true,
}: {
  points: { label: string; a: number; b: number }[];
  aName: string;
  bName: string;
  aColor?: string;
  bColor?: string;
  moneyY?: boolean;
}) {
  const W = 720;
  const H = 230;
  const PADL = 46;
  const PADB = 22;
  const PADT = 12;
  const plotW = W - PADL - 10;
  const plotH = H - PADB - PADT;
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  const x = (i: number) =>
    PADL + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PADT + plotH - (v / max) * plotH;
  const path = (key: "a" | "b") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`).join(" ");
  const fmtY = (v: number) =>
    moneyY ? `£${v >= 1000 ? `${Math.round(v / 100) / 10}k` : Math.round(v)}` : `${Math.round(v)}`;
  const labelIdx = (i: number) =>
    points.length <= 6 ||
    i === 0 ||
    i === points.length - 1 ||
    i === Math.floor(points.length / 2);
  return (
    <div className="rep-chart">
      <div className="rep-chart-legend">
        <span>
          <i style={{ background: aColor }} /> {aName}
        </span>
        <span>
          <i style={{ background: bColor }} /> {bName}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="rep-chart-svg" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={PADL}
              x2={W - 10}
              y1={PADT + plotH - plotH * f}
              y2={PADT + plotH - plotH * f}
              stroke="#E6EAF0"
              strokeWidth="1"
            />
            <text x={PADL - 6} y={PADT + plotH - plotH * f + 4} textAnchor="end" className="rep-chart-axis">
              {fmtY(max * f)}
            </text>
          </g>
        ))}
        {points.length > 1 ? (
          <>
            <path d={path("a")} fill="none" stroke={aColor} strokeWidth="2.4" />
            <path d={path("b")} fill="none" stroke={bColor} strokeWidth="2.4" />
          </>
        ) : null}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.a)} r="3.2" fill={aColor} />
            <circle cx={x(i)} cy={y(p.b)} r="3.2" fill={bColor} />
            {labelIdx(i) ? (
              <text x={x(i)} y={H - 6} textAnchor="middle" className="rep-chart-axis">
                {p.label.length > 10 ? p.label.slice(5) : p.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── donut chart ── */
export function RepDonut({
  slices,
  centerLabel,
}: {
  slices: { label: string; value: number }[];
  centerLabel: string;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const R = 54;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const segs = slices.map((s, i) => {
    const frac = total ? s.value / total : 0;
    const seg = { ...s, frac, dash: frac * C, offset, color: PALETTE[i % PALETTE.length] };
    offset += frac * C;
    return seg;
  });
  return (
    <div className="rep-donut-wrap">
      <svg viewBox="0 0 140 140" className="rep-donut">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#EDF1F5" strokeWidth="19" />
        {segs.map((s, i) => (
          <circle
            key={i}
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke={s.color}
            strokeWidth="19"
            strokeDasharray={`${Math.max(s.dash - 1.5, 0)} ${C - s.dash + 1.5}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 70 70)"
          />
        ))}
        <text x="70" y="66" textAnchor="middle" className="rep-donut-total">
          {total}
        </text>
        <text x="70" y="84" textAnchor="middle" className="rep-donut-label">
          {centerLabel}
        </text>
      </svg>
      <ul className="rep-donut-legend">
        {segs.map((s, i) => (
          <li key={i}>
            <i style={{ background: s.color }} />
            <span>{s.label}</span>
            <strong>{total ? Math.round(s.frac * 1000) / 10 : 0}%</strong>
            <em>{s.value}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── horizontal bars ── */
export function RepBars({
  items,
}: {
  items: { label: string; value: number; display: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rep-bars">
      {items.map((it, i) => (
        <div className="rep-bar-row" key={i}>
          <span className="rep-bar-label">{it.label}</span>
          <div className="rep-bar-track">
            <div
              className="rep-bar-fill"
              style={{
                width: `${Math.max((it.value / max) * 100, it.value ? 3 : 0)}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
          <strong className="rep-bar-value">{it.display}</strong>
        </div>
      ))}
    </div>
  );
}
