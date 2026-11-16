"use client";

import {
  getAdminTicketsPaged,
  type SupportTicket,
  type SupportTicketFull,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { getStoredUser } from "@/lib/auth-storage";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, Inbox, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { NewTicketModal } from "./tickets/NewTicketModal";
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

const PAGE_SIZE = 20;

export function SupportDisputesPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [panelTicketId, setPanelTicketId] = useState<string | null>(null);
  const [newTicketOpen, setNewTicketOpen] = useState(false);

  // Changing any filter goes back to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter, priorityFilter]);

  const ticketsQuery = useQuery({
    queryKey: ["admin-tickets", statusFilter, typeFilter, priorityFilter, search, page],
    queryFn: () =>
      getAdminTicketsPaged({
        status: statusFilter,
        type: typeFilter,
        priority: priorityFilter,
        search: search.trim() || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  // Live updates: a new ticket or a change anywhere refreshes the list
  // (the 20-second style polling is not needed — socket + manual retry).
  useEffect(() => {
    const user = getStoredUser();
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    };
    socket.on("admin_ticket_created", refresh);
    socket.on("admin_ticket_updated", refresh);
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const data = ticketsQuery.data;
  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const counts = data?.statusCounts ?? { open: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };

  const statCards = [
    { label: "Total Tickets", sub: "All time", value: counts.total, icon: Inbox, cls: "blue" },
    { label: "Open", sub: "Need attention", value: counts.open, icon: Clock3, cls: "red" },
    { label: "In Progress", sub: "Being resolved", value: counts.in_progress, icon: Loader2, cls: "orange" },
    { label: "Resolved", sub: "All time", value: counts.resolved, icon: CheckCircle2, cls: "green" },
  ];

  const resetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Support & Disputes</h1>
          <p>Manage customer issues, complaints and disputes.</p>
        </div>
        <div className="booking-header-actions">
          <button className="booking-create-btn" type="button" onClick={() => setNewTicketOpen(true)}>
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
        <select className="booking-filter-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button className="booking-filter-reset" onClick={resetFilters} type="button">
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
              <th>Priority</th>
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
                  <span className={`ticket-priority ${t.priority}`}>{t.priority}</span>
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
        {ticketsQuery.isError && (
          <div className="error-state">
            Couldn&apos;t load tickets. Check your connection and try again.
            <button className="booking-filter-reset" style={{ marginLeft: 10 }} onClick={() => ticketsQuery.refetch()} type="button">
              Retry
            </button>
          </div>
        )}
        {!ticketsQuery.isLoading && !ticketsQuery.isError && tickets.length === 0 && (
          <div className="empty-state">No tickets found.</div>
        )}
        {total > 0 && (
          <div className="sup-pagination">
            <span className="table-sub">
              Showing {tickets.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {(page - 1) * PAGE_SIZE + tickets.length} of {total} tickets
            </span>
            <div className="sup-pagination-buttons">
              <button
                className="booking-filter-reset"
                disabled={page <= 1 || ticketsQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                Previous
              </button>
              <span className="table-sub">Page {page} of {totalPages}</span>
              <button
                className="booking-filter-reset"
                disabled={page >= totalPages || ticketsQuery.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <TicketDetailPanel ticketId={panelTicketId} onClose={() => setPanelTicketId(null)} />
      <NewTicketModal
        open={newTicketOpen}
        onClose={() => setNewTicketOpen(false)}
        onCreated={(ticket: SupportTicketFull) => {
          setNewTicketOpen(false);
          queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
          setPanelTicketId(ticket._id);
        }}
      />
    </section>
  );
}
