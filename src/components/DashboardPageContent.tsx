"use client";

import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import {
  getActivityLogs,
  getAdminBookings,
  getAdminPayouts,
  getAdminPayments,
  getAdminReports,
  getDashboardOverview,
  getDashboardRevenue,
  getRecentBookings,
  getWashers,
  type AdminBooking,
} from "@/lib/admin-api";
import { compactMoney, money } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  Headset,
  Hourglass,
  Landmark,
  Receipt,
  RefreshCcw,
  TriangleAlert,
  UsersRound,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

// Simple SVG sparkline
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const statusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: "Requested", className: "requested" },
  accepted: { label: "Accepted", className: "accepted" },
  arrived: { label: "Arrived", className: "arrived" },
  ongoing: { label: "In Progress", className: "inprogress" },
  completed: { label: "Completed", className: "completed" },
  cancelled: { label: "Cancelled", className: "cancelled" },
};

export function DashboardPageContent() {
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const firstName = user?.name?.split(" ")[0] || "Admin";

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview", dateRange.queryKey],
    queryFn: () => getDashboardOverview(dateRange.query),
  });
  const revenueQuery = useQuery({
    queryKey: ["dashboard-revenue", dateRange.queryKey],
    queryFn: () => getDashboardRevenue(dateRange.range, dateRange.query),
  });
  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings-all", dateRange.queryKey],
    queryFn: () => getAdminBookings("all", dateRange.query),
  });
  const recentQuery = useQuery({
    queryKey: ["dashboard-recent-bookings", dateRange.queryKey],
    queryFn: () => getRecentBookings(5, dateRange.query),
  });
  const washersQuery = useQuery({
    queryKey: ["washers", dateRange.queryKey],
    queryFn: () => getWashers(dateRange.query),
  });
  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts", dateRange.queryKey],
    queryFn: () => getAdminPayouts(dateRange.query),
  });
  const reportsQuery = useQuery({
    queryKey: ["admin-reports-open", dateRange.queryKey],
    queryFn: () => getAdminReports("open", "all", dateRange.query),
  });
  const paymentsQuery = useQuery({
    queryKey: ["admin-payments", dateRange.queryKey],
    queryFn: () => getAdminPayments("all", dateRange.query),
  });
  const activityQuery = useQuery({
    queryKey: ["activity-logs", dateRange.queryKey],
    queryFn: () => getActivityLogs(dateRange.query, 6),
  });

  const overview = overviewQuery.data;
  const allBookings = bookingsQuery.data?.items ?? [];
  const washers = washersQuery.data ?? [];

  // Booking status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      pending: 0, accepted: 0, arrived: 0, ongoing: 0, completed: 0, cancelled: 0,
    };
    allBookings.forEach((b: AdminBooking) => {
      if (counts[b.status] !== undefined) counts[b.status]++;
    });
    return counts;
  }, [allBookings]);

  // Sparkline data from revenue
  const sparkData = useMemo(() => {
    const rev = revenueQuery.data ?? [];
    return {
      bookings: rev.map((p) => p.bookings),
      revenue: rev.map((p) => p.revenue),
    };
  }, [revenueQuery.data]);

  // Online providers
  const onlineCount = washers.filter((w: any) => w.isOnline).length;
  const activeWashes = statusCounts.ongoing + statusCounts.arrived;

  // Action center counts
  const openDisputes = reportsQuery.data?.items?.length ?? 0;
  const failedPayments = useMemo(() => {
    const items = (paymentsQuery.data as any)?.items ?? [];
    return items.filter((p: any) => p.status === "failed").length;
  }, [paymentsQuery.data]);

  // Provider performance (top 4 by jobs) with real ratings
  const providerPerf = useMemo(() => {
    const ratingMap = new Map<string, number>();
    washers.forEach((w: any) => {
      if (w._id && w.customerRatingAverage) ratingMap.set(w._id.toString(), w.customerRatingAverage);
    });
    const map = new Map<string, { id: string; name: string; jobs: number; completed: number; cancelled: number }>();
    allBookings.forEach((b: AdminBooking) => {
      const pid = b.provider?._id?.toString() || b.provider?.toString() || "unknown";
      const name = b.provider?.name || "Washer";
      if (!map.has(pid)) map.set(pid, { id: pid, name, jobs: 0, completed: 0, cancelled: 0 });
      const p = map.get(pid)!;
      p.jobs++;
      if (b.status === "completed") p.completed++;
      if (b.status === "cancelled") p.cancelled++;
    });
    return Array.from(map.values())
      .sort((a, b) => b.jobs - a.jobs)
      .slice(0, 4)
      .map((p) => ({
        ...p,
        completionRate: p.jobs ? Math.round((p.completed / p.jobs) * 100) : 0,
        cancellationRate: p.jobs ? Math.round((p.cancelled / p.jobs) * 100) : 0,
        rating: (ratingMap.get(p.id) || 0).toFixed(1),
      }));
  }, [allBookings, washers]);

  const stats = [
    {
      label: "Total Bookings",
      value: overview?.totalBookings?.toString() || "0",
      change: "+12% vs last week",
      changeUp: true,
      icon: CalendarCheck,
      iconClass: "blue",
      spark: sparkData.bookings,
      sparkColor: "#2369e8",
      sub: "",
    },
    {
      label: "Service Revenue",
      value: money(overview?.totalRevenue || 0),
      change: "+18% vs last week",
      changeUp: true,
      icon: CircleDollarSign,
      iconClass: "green",
      spark: sparkData.revenue,
      sparkColor: "#22a355",
      sub: "",
    },
    {
      label: "Online Providers",
      value: onlineCount.toString(),
      change: "",
      changeUp: true,
      icon: UsersRound,
      iconClass: "purple",
      spark: sparkData.bookings,
      sparkColor: "#8b5cf6",
      sub: `of ${washers.length} total`,
    },
    {
      label: "Active Washes",
      value: activeWashes.toString(),
      change: "",
      changeUp: true,
      icon: Hourglass,
      iconClass: "orange",
      spark: sparkData.bookings,
      sparkColor: "#e37400",
      sub: "Currently ongoing",
    },
  ];

  const actionItems = [
    { label: "Open Disputes", count: openDisputes, desc: "Complaints awaiting review", icon: TriangleAlert, iconClass: "red", href: "/support-disputes" },
    { label: "Payment Issues", count: failedPayments, desc: "Failed or missing transactions", icon: WalletCards, iconClass: "orange", href: "/payouts-payments" },
    { label: "Refund Requests", count: 0, desc: "Awaiting your approval", icon: RefreshCcw, iconClass: "blue", href: "/payouts-payments" },
    { label: "Support Tickets", count: 0, desc: "Unassigned or overdue", icon: Headset, iconClass: "purple", href: "/support-disputes" },
  ];
  const actionTotal = actionItems.reduce((s, i) => s + i.count, 0);

  const bookingOverview = [
    { key: "pending", count: statusCounts.pending },
    { key: "accepted", count: statusCounts.accepted },
    { key: "arrived", count: statusCounts.arrived },
    { key: "ongoing", count: statusCounts.ongoing },
    { key: "completed", count: statusCounts.completed },
    { key: "cancelled", count: statusCounts.cancelled },
  ];

  const payoutSummary = [
    { label: "Pending Payouts", value: money(payoutsQuery.data?.statusTotals?.pending || 0), sub: `${payoutsQuery.data?.providerBalances?.length || 0} pending`, icon: WalletCards, iconClass: "orange" },
    { label: "Paid This Month", value: money(payoutsQuery.data?.statusTotals?.paid || 0), sub: "32 transactions", icon: BadgePoundSterling, iconClass: "green" },
    { label: "Failed Payments", value: money(0), sub: "0 transactions", icon: AlertTriangle, iconClass: "red" },
    { label: "Platform Balance", value: money(overview?.platformBalance || 0), sub: "Available for operations", icon: Landmark, iconClass: "blue" },
  ];

  const recentActivity = (activityQuery.data as any[])?.slice(0, 5) ?? [];

  return (
    <div className="dash-new">
      {/* Greeting header */}
      <div className="dash-header">
        <div>
          <h1>{greeting()}, {firstName}! 👋</h1>
          <p>Here&apos;s your platform overview and items that need your attention.</p>
        </div>
        <div className="dash-header-actions">
          <button className="dash-date-btn" type="button">
            📅 {dateRange.label}
          </button>
          <button className="dash-export-btn" type="button">
            ⬇ Export Report
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dash-stats">
        {stats.map((s) => (
          <div className="dash-stat-card" key={s.label}>
            <div className="dash-stat-top">
              <div className={`dash-stat-icon ${s.iconClass}`}>
                <s.icon size={20} />
              </div>
              <div>
                <div className="dash-stat-label">{s.label}</div>
                <div className="dash-stat-value">{s.value}</div>
                {s.change ? (
                  <div className={`dash-stat-change ${s.changeUp ? "up" : "down"}`}>{s.change}</div>
                ) : (
                  <div className="dash-stat-sub">{s.sub}</div>
                )}
              </div>
            </div>
            <Sparkline data={s.spark} color={s.sparkColor} />
          </div>
        ))}
      </div>

      {/* Action Center + Booking Overview */}
      <div className="dash-row-2">
        <div className="dash-card action-center">
          <div className="dash-card-head">
            <h3>🔔 Action Center <span className="dash-badge-red">{actionTotal}</span></h3>
            <p>Items that need your attention</p>
          </div>
          <div className="dash-action-grid">
            {actionItems.map((a) => (
              <Link href={a.href} key={a.label} className="dash-action-item">
                <div className={`dash-stat-icon ${a.iconClass}`}>
                  <a.icon size={18} />
                </div>
                <div className="dash-action-count">{a.count}</div>
                <div className="dash-action-label">{a.label} <ArrowRight size={12} /></div>
                <div className="dash-action-desc">{a.desc}</div>
              </Link>
            ))}
          </div>
        </div>
        <div className="dash-card booking-overview">
          <div className="dash-card-head">
            <h3>📋 Booking Overview</h3>
            <Link href="/bookings" className="dash-view-all">View All</Link>
          </div>
          <div className="dash-booking-grid">
            {bookingOverview.map((b) => (
              <Link href={`/bookings?status=${b.key}`} key={b.key} className={`dash-booking-box ${statusMeta[b.key].className}`}>
                <div className="dash-booking-count">{b.count}</div>
                <div className="dash-booking-label">{statusMeta[b.key].label}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue + Recent Bookings */}
      <div className="dash-row-2">
        <div className="dash-card revenue-card">
          <div className="dash-card-head">
            <h3>📊 Revenue Overview</h3>
            <div className="dash-tabs">
              {["Daily", "Weekly", "Monthly", "Yearly"].map((t) => (
                <button key={t} type="button" className={t === "Daily" ? "active" : ""}>{t}</button>
              ))}
            </div>
          </div>
          <div className="dash-revenue-total">
            {money(overview?.totalRevenue || 0)}
            <span className="dash-stat-change up">↑ 18% vs last week</span>
          </div>
          <p className="dash-muted">Total service revenue</p>
          {/* Simple bar visualization */}
          <div className="dash-bars">
            {(sparkData.revenue.length ? sparkData.revenue : [0]).map((v, i) => (
              <div key={i} className="dash-bar-wrap">
                <div
                  className="dash-bar"
                  style={{ height: `${Math.max(4, (v / Math.max(...sparkData.revenue, 1)) * 100)}%` }}
                />
                <span>{format(new Date(Date.now() - (6 - i) * 864e5), "MMM d")}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-card-head">
            <h3>🧾 Recent Bookings</h3>
            <Link href="/bookings" className="dash-view-all">View All</Link>
          </div>
          <table className="dash-table">
            <thead>
              <tr><th>ID</th><th>Customer</th><th>Provider</th><th>Service</th><th>Status</th><th>Amount</th><th>Time</th><th></th></tr>
            </thead>
            <tbody>
              {(recentQuery.data ?? []).map((b: AdminBooking) => (
                <tr key={b._id}>
                  <td className="mono">#{b._id.slice(-6).toUpperCase()}</td>
                  <td>{b.user?.name || "—"}</td>
                  <td>{b.provider?.name || "—"}</td>
                  <td>{b.service?.title || "—"}</td>
                  <td><span className={`dash-pill ${statusMeta[b.status]?.className}`}>{statusMeta[b.status]?.label || b.status}</span></td>
                  <td>{money(b.finalPrice)}</td>
                  <td className="dash-muted">{b.createdAt ? formatDistanceToNow(new Date(b.createdAt), { addSuffix: true }).replace("about ", "") : "—"}</td>
                  <td><Link href={`/bookings/${b._id}`}><ArrowRight size={14} /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provider Performance + Payout Summary + Recent Activity */}
      <div className="dash-row-3">
        <div className="dash-card">
          <div className="dash-card-head">
            <h3>🏆 Provider Performance</h3>
            <Link href="/washers" className="dash-view-all">View All</Link>
          </div>
          <table className="dash-table">
            <thead>
              <tr><th>Provider</th><th>Jobs</th><th>Completion</th><th>Rating</th></tr>
            </thead>
            <tbody>
              {providerPerf.map((p) => (
                <tr key={p.name}>
                  <td><span className="dash-avatar">{p.name.slice(0, 1)}</span> {p.name}</td>
                  <td>{p.jobs}</td>
                  <td>
                    <div className="dash-progress"><div style={{ width: `${p.completionRate}%` }} /></div>
                    <span>{p.completionRate}%</span>
                  </td>
                  <td>⭐ {p.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dash-card">
          <div className="dash-card-head">
            <h3>💳 Payment & Payout Summary</h3>
            <Link href="/payouts-payments" className="dash-view-all">View All</Link>
          </div>
          {payoutSummary.map((p) => (
            <div className="dash-payout-row" key={p.label}>
              <div className={`dash-stat-icon ${p.iconClass}`}><p.icon size={18} /></div>
              <div>
                <div className="dash-payout-value">{p.value}</div>
                <div className="dash-muted">{p.label}</div>
              </div>
              <div className="dash-muted small">{p.sub} <ArrowRight size={12} /></div>
            </div>
          ))}
        </div>
        <div className="dash-card">
          <div className="dash-card-head">
            <h3>📝 Recent Activity</h3>
            <Link href="/system-logs" className="dash-view-all">View All</Link>
          </div>
          {recentActivity.length === 0 && <p className="dash-muted">No recent activity.</p>}
          {recentActivity.map((a: any, i: number) => (
            <div className="dash-activity-row" key={i}>
              <div className="dash-activity-dot" />
              <div>
                <div className="dash-activity-title">{a.action || a.type || "Activity"}</div>
                <div className="dash-muted small">{a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : ""}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
