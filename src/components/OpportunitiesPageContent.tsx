"use client";

import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
  getAdminOpportunities,
  type Opportunity,
} from "@/lib/admin-api";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  BarChart3,
  CheckCircle2,
  Gift,
  Loader2,
  UsersRound,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CreateOpportunityPanel } from "./opportunities/CreateOpportunityPanel";
import {
  approvePayout,
  getBonusPayouts,
  getOpportunityProgress,
} from "@/lib/admin-api";
import { useMutation } from "@tanstack/react-query";

const typeBadges: Record<string, string> = {
  daily: "opp-type-daily",
  weekly: "opp-type-weekly",
  custom: "opp-type-custom",
  location: "opp-type-location",
  service: "opp-type-service",
  milestone: "opp-type-milestone",
  referral: "opp-type-referral",
};

const statusBadges: Record<string, string> = {
  active: "opp-status-active",
  scheduled: "opp-status-scheduled",
  paused: "opp-status-paused",
  ended: "opp-status-ended",
};

export function OpportunitiesPageContent() {
  const dateRange = useDashboardDateRange();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["campaigns", "promotions", "progress", "payouts"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const oppQuery = useQuery({
    queryKey: ["admin-opportunities", statusFilter, typeFilter, search],
    queryFn: () =>
      getAdminOpportunities({
        status: statusFilter,
        type: typeFilter,
        search: search.trim() || undefined,
      }),
    enabled: activeTab === "campaigns",
  });

  const progressQuery = useQuery({
    queryKey: ["opportunity-progress"],
    queryFn: () => getOpportunityProgress(),
    enabled: activeTab === "progress",
  });

  const payoutsQuery = useQuery({
    queryKey: ["bonus-payouts"],
    queryFn: () => getBonusPayouts(),
    enabled: activeTab === "payouts",
  });

  const payoutMutation = useMutation({
    mutationFn: (id: string) => approvePayout(id),
    onSuccess: () => {
      payoutsQuery.refetch();
    },
  });

  const data = oppQuery.data;
  const items = data?.items ?? [];
  const stats = data?.stats ?? { activeCampaigns: 0, totalParticipants: 0, rewardsEarned: 0 };
  const breakdown = data?.statusBreakdown ?? { all: 0, active: 0, scheduled: 0, paused: 0, ended: 0 };

  const tabs = [
    { key: "campaigns", label: "Campaigns" },
    { key: "promotions", label: "Promotions" },
    { key: "progress", label: "Provider Progress" },
    { key: "payouts", label: "Bonus Payouts" },
  ];

  const statCards = [
    { label: "Active Campaigns", value: stats.activeCampaigns, sub: "Total live now", icon: Gift, cls: "orange" },
    { label: "Total Participants", value: stats.totalParticipants, sub: "Active providers", icon: UsersRound, cls: "purple" },
    { label: "Rewards Earned", value: "£" + stats.rewardsEarned, sub: "This period", icon: CheckCircle2, cls: "green" },
    { label: "Bookings from Campaigns", value: items.length, sub: "Tracked", icon: BarChart3, cls: "blue" },
  ];

  const statusPills = [
    { key: "all", label: "All Campaigns", count: breakdown.all },
    { key: "active", label: "Active", count: breakdown.active },
    { key: "scheduled", label: "Scheduled", count: breakdown.scheduled },
    { key: "paused", label: "Paused", count: breakdown.paused },
    { key: "ended", label: "Ended", count: breakdown.ended },
  ];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Provider Opportunities</h1>
          <p>Create and manage booking targets, bonuses and promotional campaigns for providers.</p>
        </div>
        <div className="booking-header-actions">
          <button className="booking-filter-select" type="button">
            Oct 17, 2026 - Oct 23, 2026
          </button>
          <button className="booking-create-btn" type="button" onClick={() => setShowCreate(true)}>
            + Create Opportunity
          </button>
        </div>
      </div>

      <div className="opp-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={activeTab === t.key ? "opp-tab active" : "opp-tab"}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === "campaigns" && (
            <>
              <div className="dash-stats">
                {statCards.map((s) => (
                  <div className="dash-stat-card" key={s.label}>
                    <div className="dash-stat-top">
                      <div className={"dash-stat-icon " + s.cls}>
                        <s.icon size={20} />
                      </div>
                      <div>
                        <div className="dash-stat-value">{s.value}</div>
                        <div className="dash-stat-label">{s.label}</div>
                        <div className="dash-stat-sub">• {s.sub}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="booking-filters" style={{ gap: 8 }}>
                {statusPills.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setStatusFilter(p.key)}
                    className={statusFilter === p.key ? "booking-create-btn" : "booking-filter-reset"}
                    style={
                      statusFilter === p.key
                        ? { background: "#111", color: "#fff" }
                        : { border: "1px solid #e5e7eb" }
                    }
                  >
                    {p.label} <span style={{ opacity: 0.7 }}>({p.count})</span>
                  </button>
                ))}
              </div>

              <div className="booking-filters">
                <div className="booking-search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    type="text"
                    placeholder="Search campaigns..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select className="booking-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="custom">Custom</option>
                  <option value="location">Location</option>
                  <option value="service">Service</option>
                  <option value="milestone">Milestone</option>
                  <option value="referral">Referral</option>
                </select>
                <button
                  className="booking-filter-reset"
                  onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <div className="table-card">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th>Type</th>
                      <th>Target</th>
                      <th>Reward</th>
                      <th>Duration</th>
                      <th>Participants</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((o: Opportunity) => (
                      <tr key={o._id}>
                        <td>
                          <strong>{o.name}</strong>
                          {o.description && <span className="table-sub">{o.description}</span>}
                        </td>
                        <td>
                          <span className={"opp-type " + (typeBadges[o.type] || "")} style={{ textTransform: "capitalize" }}>
                            {o.type}
                          </span>
                        </td>
                        <td>{o.target} {o.targetUnit || "bookings"}</td>
                        <td><strong>£{o.rewardAmount}</strong></td>
                        <td className="table-sub">
                          {o.startDate && format(new Date(o.startDate), "MMM dd")} - {o.endDate && format(new Date(o.endDate), "MMM dd, yyyy")}
                        </td>
                        <td>{o.participants ?? 0}</td>
                        <td>
                          <span className={"opp-status " + (statusBadges[o.status] || "")} style={{ textTransform: "capitalize" }}>
                            {o.status}
                          </span>
                        </td>
                        <td>
                          <button className="mini-icon-button" type="button" title="Actions">
                            •••
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {oppQuery.isLoading && (
                  <div className="empty-state"><Loader2 size={22} /> Loading campaigns...</div>
                )}
                {!oppQuery.isLoading && items.length === 0 && (
                  <div className="empty-state">No campaigns found. Create your first opportunity!</div>
                )}
                {oppQuery.isError && (
                  <div className="error-state">Could not load campaigns. Check backend deployment.</div>
                )}
              </div>
            </>
          )}

          {activeTab === "promotions" && (
            <div className="table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Promotion</th>
                    <th>Type</th>
                    <th>Reward</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.filter((o) => ["custom", "referral"].includes(o.type)).map((o: Opportunity) => (
                    <tr key={o._id}>
                      <td>
                        <strong>{o.name}</strong>
                        {o.description && <span className="table-sub">{o.description}</span>}
                      </td>
                      <td>
                        <span className={"opp-type " + (typeBadges[o.type] || "")} style={{ textTransform: "capitalize" }}>
                          {o.type}
                        </span>
                      </td>
                      <td><strong>£{o.rewardAmount}</strong></td>
                      <td className="table-sub">
                        {o.startDate && format(new Date(o.startDate), "MMM dd")} - {o.endDate && format(new Date(o.endDate), "MMM dd, yyyy")}
                      </td>
                      <td>
                        <span className={"opp-status " + (statusBadges[o.status] || "")} style={{ textTransform: "capitalize" }}>
                          {o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {items.filter((o) => ["custom", "referral"].includes(o.type)).length === 0 && (
                <div className="empty-state">No promotions found.</div>
              )}
            </div>
          )}

          {activeTab === "progress" && (
            <div className="table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Campaign</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {(progressQuery.data ?? []).map((p: any) => (
                    <tr key={p._id}>
                      <td>
                        <strong>{p.provider?.name || "—"}</strong>
                        <span className="table-sub">{p.provider?.email || ""}</span>
                      </td>
                      <td>{p.opportunity?.name || "—"}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="opp-preview-bar" style={{ flex: 1, minWidth: 80 }}>
                            <div style={{ width: Math.min(100, (p.progress / (p.opportunity?.target || 1)) * 100) + "%" }} />
                          </div>
                          <span className="table-sub">{p.progress}/{p.opportunity?.target || "—"}</span>
                        </div>
                      </td>
                      <td>
                        <span className="opp-status opp-status-active" style={{ textTransform: "capitalize" }}>
                          {p.status}
                        </span>
                      </td>
                      <td className="table-sub">
                        {p.updatedAt && format(new Date(p.updatedAt), "MMM dd, yyyy")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {progressQuery.isLoading && (
                <div className="empty-state"><Loader2 size={22} /> Loading progress...</div>
              )}
              {!progressQuery.isLoading && (progressQuery.data ?? []).length === 0 && (
                <div className="empty-state">No provider progress yet.</div>
              )}
            </div>
          )}

          {activeTab === "payouts" && (
            <div className="table-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Campaign</th>
                    <th>Amount</th>
                    <th>Claimed</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(payoutsQuery.data ?? []).map((p: any) => (
                    <tr key={p._id}>
                      <td><strong>{p.provider?.name || "—"}</strong></td>
                      <td>{p.opportunity?.name || "—"}</td>
                      <td><strong>£{p.opportunity?.rewardAmount || p.paidAmount || 0}</strong></td>
                      <td className="table-sub">
                        {p.claimedAt && format(new Date(p.claimedAt), "MMM dd, yyyy")}
                      </td>
                      <td>
                        <span className={"opp-status " + (p.status === "paid" ? "opp-status-active" : "opp-status-scheduled")}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.status === "claimed" && (
                          <button
                            className="booking-create-btn"
                            style={{ padding: "6px 12px", fontSize: 12 }}
                            onClick={() => payoutMutation.mutate(p._id)}
                            disabled={payoutMutation.isPending}
                            type="button"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payoutsQuery.isLoading && (
                <div className="empty-state"><Loader2 size={22} /> Loading payouts...</div>
              )}
              {!payoutsQuery.isLoading && (payoutsQuery.data ?? []).length === 0 && (
                <div className="empty-state">No bonus payouts yet.</div>
              )}
            </div>
          )}
        </div>
        {showCreate && (
          <div style={{ width: 340, flexShrink: 0 }}>
            <CreateOpportunityPanel onClose={() => setShowCreate(false)} />
          </div>
        )}
      </div>
    </section>
  );
}
