"use client";

import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
  getAdminTickets,
  type SupportTicket,
} from "@/lib/admin-api";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, Inbox, Loader2 } from "lucide-react";
import { useState } from "react";
import { TicketDetailPanel } from "./tickets/TicketDetailPanel";

const typeLabels: Record<string, { label: string; className: string }> = {
  complaint: { label: "Complaint", className: "complaint" },
  refund: { label: "Refund", className: "refund" },
  dispute: { label: "Dispute", className: "dispute" },
  technical: { label: "Technical", className: "technical" },
  cancellation: { label: "Cancellation", className: "cancellation" },
  payment: { label: "Payment", className: "payment" },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "open" },
  in_progress: { label: "In Progress", className: "inprogress" },
  resolved: { label: "Resolved", className: "resolved" },
  closed: { label: "Closed", className: "closed" },
};

export function SupportDisputesPageContent() {
  const dateRange = useDashboardDateRange();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [panelTicketId, setPanelTicketId] = useState<string | null>(null);

  const ticketsQuery = useQuery({
    queryKey: ["admin-tickets", statusFilter, typeFilter, search],
    queryFn: () => getAdminTickets({ status: statusFilter, type: typeFilter, search: search.trim() || undefined }),
  });

  const data = ticketsQuery.data;
  const tickets = data?.items ?? [];
  const counts = data?.statusCounts ?? { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };

  const statCards = [
    { label: "Total Tickets", sub: "All time", value: counts.total, icon: Inbox, cls: "blue" },
    { label: "Open", sub: "Need attention", value: counts.open, icon: Clock3, cls: "red" },
    { label: "In Progress", sub: "Being resolved", value: counts.in_progress, icon: Loader2, cls: "orange" },
    { label: "Resolved", sub: "This month", value: counts.resolved, icon: CheckCircle2, cls: "green" },
  ];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Support & Disputes</h1>
          <p>Manage customer issues, complaints and disputes.</p>
        </div>
        <div className="booking-header-actions">
          <button className="booking-create-btn" type="button" onClick={() => alert("Admin ticket creation coming soon")}>
            + New Ticket
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dash-stats">
        {statCards.map((s) => (
          <div className="dash-stat-card" key={s.label}>
            <div className="dash-stat-top">
              <div className={`dash-stat-icon ${s.cls}`}>
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

      {/* Filters */}
      <div className="booking-filters">
        <div className="booking-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Search by ticket ID, customer or provider..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="booking-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="complaint">Complaint</option>
          <option value="refund">Refund</option>
          <option value="dispute">Dispute</option>
          <option value="technical">Technical</option>
          <option value="cancellation">Cancellation</option>
          <option value="payment">Payment</option>
        </select>
        <select className="booking-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <button
          className="booking-filter-reset"
          onClick={() => { setSearch(""); setTypeFilter("all"); setStatusFilter("all"); }}
          type="button"
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Type</th>
              <th>Subject</th>
              <th>Booking</th>
              <th>Customer / Provider</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t: SupportTicket) => (
              <tr key={t._id} className="clickable-row" onClick={() => setPanelTicketId(t._id)}>
                <td><strong>#{t.ticketNumber}</strong></td>
                <td>
                  <span className={`ticket-type ${typeLabels[t.type]?.className || ""}`}>
                    {typeLabels[t.type]?.label || t.type}
                  </span>
                </td>
                <td>{t.subject}</td>
                <td>{t.booking ? `#${t.booking._id.slice(-6).toUpperCase()}` : "—"}</td>
                <td>
                  <strong>{t.reporter?.name || "—"}</strong>
                  <span className="table-sub" style={{ textTransform: "capitalize" }}>{t.reporterRole}</span>
                </td>
                <td>
                  <span className={`ticket-status ${statusLabels[t.status]?.className || ""}`}>
                    {statusLabels[t.status]?.label || t.status}
                  </span>
                </td>
                <td className="table-sub">
                  {t.createdAt ? formatDistanceToNow(new Date(t.createdAt), { addSuffix: true }).replace("about ", "") : "—"}
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <button className="mini-icon-button" onClick={() => setPanelTicketId(t._id)} title="View" type="button">
                    •••
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {ticketsQuery.isLoading && (
          <div className="empty-state"><Loader2 size={22} /> Loading tickets...</div>
        )}
        {!ticketsQuery.isLoading && tickets.length === 0 && (
          <div className="empty-state">No tickets found.</div>
        )}
        {ticketsQuery.isError && (
          <div className="error-state">Could not load tickets. Check backend deployment.</div>
        )}
      </div>

      <TicketDetailPanel ticketId={panelTicketId} onClose={() => setPanelTicketId(null)} />
    </section>
  );
}
