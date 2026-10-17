"use client";

import {
  getAdminBookings,
  updateAdminBookingStatus,
  type AdminBooking,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth-storage";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock3, Eye, Loader2, Navigation, PlayCircle, XCircle, AlertTriangle, Hourglass } from "lucide-react";
import { BookingDetailPanel } from "./bookings/BookingDetailPanel";
import { CreateBookingModal } from "./bookings/CreateBookingModal";
import { useMemo, useState } from "react";

const statusOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Requested" },
  { value: "accepted", label: "Accepted" },
  { value: "arrived", label: "Arrived" },
  { value: "ongoing", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusLabels: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const actionButtons = [
  { status: "accepted", label: "Accept", icon: CheckCircle2 },
  { status: "arrived", label: "Arrived", icon: Navigation },
  { status: "ongoing", label: "Start", icon: PlayCircle },
  { status: "completed", label: "Complete", icon: CheckCircle2 },
  { status: "cancelled", label: "Cancel", icon: XCircle },
];

function BookingRow({
  booking,
  canSeeMoney,
  onUpdate,
  updating,
  selected,
  onSelect,
  onViewPanel,
}: {
  booking: AdminBooking;
  canSeeMoney: boolean;
  onUpdate: (bookingId: string, status: string) => void;
  updating: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onViewPanel: (id: string) => void;
}) {
  const date = booking.bookingDate ? new Date(booking.bookingDate) : null;
  const paid = (booking as any).payment?.status === "paid";
  const customerInitial = (booking.user?.name || "C").slice(0, 1).toUpperCase();

  return (
    <tr className="clickable-row">
      <td onClick={(e) => { e.stopPropagation(); onSelect(booking._id); }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(booking._id)}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <strong>#{booking._id.slice(-6).toUpperCase()}</strong>
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <span>{date ? format(date, "dd MMM yyyy") : "No date"}</span>
        <span className="table-sub">{date ? format(date, "hh:mm a") : ""}</span>
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <div className="table-customer">
          <span className="table-avatar">{customerInitial}</span>
          <div>
            <strong>{booking.user?.name || "Customer"}</strong>
            <span className="table-sub">{(booking.user as any)?.phoneNumber || booking.user?.email || ""}</span>
          </div>
        </div>
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <strong>{booking.provider?.name || "Washer"}</strong>
        <span className="table-sub">⭐ {(booking.provider as any)?.customerRatingAverage?.toFixed(1) || "—"}</span>
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <strong>{booking.service?.title || "Wash Service"}</strong>
        <span className="table-sub">{(booking as any).vehicle?.model || (booking as any).vehicleSnapshot?.model || ""}</span>
      </td>
      {canSeeMoney ? <td className="numeric-cell" onClick={() => (window.location.href = `/bookings/${booking._id}`)}>{money(booking.finalPrice)}</td> : null}
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <span className={`payment-badge ${paid ? "paid" : "failed"}`}>
          {paid ? "✓ Paid" : "✗ Failed"}
        </span>
      </td>
      <td onClick={() => (window.location.href = `/bookings/${booking._id}`)}>
        <span className={`table-status ${booking.status}`}>
          {statusLabels[booking.status] || booking.status}
        </span>
      </td>
      <td>
        <div className="row-actions">
          <button
            aria-label="View booking"
            className="mini-icon-button"
            onClick={(e) => { e.stopPropagation(); onViewPanel(booking._id); }}
            title="Quick view"
            type="button"
          >
            <Eye size={15} />
          </button>
          {actionButtons.map((action) => {
            const Icon = action.icon;
            return (
              <button
                aria-label={`${action.label} booking`}
                className="mini-icon-button"
                disabled={updating || booking.status === action.status}
                key={action.status}
                onClick={(e) => { e.stopPropagation(); onUpdate(booking._id, action.status); }}
                title={action.label}
                type="button"
              >
                {updating ? <Loader2 size={15} /> : <Icon size={15} />}
              </button>
            );
          })}
        </div>
      </td>
    </tr>
  );
}

export function BookingsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelBookingId, setPanelBookingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const user = useMemo(() => getStoredUser(), []);
  const canSeeMoney = user?.role === "admin";

  const bookingsQuery = useQuery({
    queryKey: ["admin-bookings", status, dateRange.queryKey],
    queryFn: () => getAdminBookings(status, dateRange.query),
  });

  const statusMutation = useMutation({
    mutationFn: ({ bookingId, nextStatus }: { bookingId: string; nextStatus: string }) =>
      updateAdminBookingStatus(bookingId, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-upcoming-bookings"] });
    },
  });

  // Summary counts - fetched separately for all statuses
  const summaryQuery = useQuery({
    queryKey: ["admin-bookings-summary", dateRange.queryKey],
    queryFn: () => getAdminBookings("all", dateRange.query),
  });

  const bookings = bookingsQuery.data?.items ?? [];
  const allBookings = summaryQuery.data?.items ?? [];

  // Client-side search + service filter
  const filteredBookings = bookings.filter((b) => {
    if (serviceFilter !== "all" && b.service?._id !== serviceFilter && b.service?.title !== serviceFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b._id.toLowerCase().includes(q) ||
      (b.user?.name || "").toLowerCase().includes(q) ||
      (b.provider?.name || "").toLowerCase().includes(q)
    );
  });

  // Unique services for filter dropdown
  const serviceOptions = Array.from(
    new Map(allBookings.map((b) => [b.service?._id || b.service?.title, b.service?.title || "Unknown"])).entries()
  );

  const summaryCounts = {
    requested: allBookings.filter((b) => b.status === "pending").length,
    accepted: allBookings.filter((b) => b.status === "accepted").length,
    arrived: allBookings.filter((b) => b.status === "arrived").length,
    inProgress: allBookings.filter((b) => b.status === "ongoing").length,
    completed: allBookings.filter((b) => b.status === "completed").length,
    cancelled: allBookings.filter((b) => b.status === "cancelled").length,
    disputed: 0, // Backend me dispute field nahi hy abhi
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Bookings</h1>
          <p>Manage all customer bookings and track their real-time status.</p>
        </div>
        <div className="booking-header-actions">
          <button
            className="booking-create-btn"
            onClick={() => setShowCreateModal(true)}
            type="button"
          >
            + Create Booking
          </button>
          <button
            className="booking-export-btn"
            onClick={() => {
              const csv = [
                "Booking ID,Date,Customer,Provider,Service,Amount,Payment,Status",
                ...filteredBookings.map((b) =>
                  [
                    `#${b._id.slice(-6).toUpperCase()}`,
                    b.bookingDate ? new Date(b.bookingDate).toLocaleDateString() : "",
                    b.user?.name || "",
                    b.provider?.name || "",
                    b.service?.title || "",
                    b.finalPrice || "",
                    (b as any).payment?.status || "",
                    b.status,
                  ].join(",")
                ),
              ].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
              a.click();
            }}
            type="button"
          >
            ⬇ Export
          </button>
        </div>
      </div>

      {/* Summary cards - 7 statuses */}
      <div className="booking-summary-grid-7">
        {[
          { key: "pending", label: "Requested", count: summaryCounts.requested, icon: Clock3, cls: "blue" },
          { key: "accepted", label: "Accepted", count: summaryCounts.accepted, icon: CheckCircle2, cls: "green" },
          { key: "arrived", label: "Arrived", count: summaryCounts.arrived, icon: Navigation, cls: "purple" },
          { key: "ongoing", label: "In Progress", count: summaryCounts.inProgress, icon: PlayCircle, cls: "orange" },
          { key: "completed", label: "Completed", count: summaryCounts.completed, icon: CheckCircle2, cls: "green" },
          { key: "cancelled", label: "Cancelled", count: summaryCounts.cancelled, icon: XCircle, cls: "red" },
          { key: "disputed", label: "Disputed", count: summaryCounts.disputed, icon: AlertTriangle, cls: "orange" },
        ].map((c) => (
          <button
            key={c.key}
            className={`booking-summary-card ${status === c.key ? "active" : ""}`}
            onClick={() => c.key !== "disputed" && setStatus(status === c.key ? "all" : c.key)}
            type="button"
            title={c.key === "disputed" ? "Dispute tracking coming soon" : undefined}
          >
            <div className={`booking-summary-icon ${c.cls}`}>
              <c.icon size={20} />
            </div>
            <div>
              <div className="booking-summary-value">{c.count}</div>
              <div className="booking-summary-label">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div className="booking-filters">
        <div className="booking-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            type="text"
            placeholder="Search by booking ID, customer name, provider name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="booking-filter-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Requested</option>
          <option value="accepted">Accepted</option>
          <option value="arrived">Arrived</option>
          <option value="ongoing">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          className="booking-filter-select"
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
        >
          <option value="all">All Services</option>
          {serviceOptions.map(([id, title]) => (
            <option key={id} value={id}>{title}</option>
          ))}
        </select>
        <button
          className="booking-filter-reset"
          onClick={() => { setSearch(""); setStatus("all"); setServiceFilter("all"); }}
          type="button"
        >
          Reset
        </button>
      </div>

      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" onChange={(e) => {
                if (e.target.checked) setSelectedIds(filteredBookings.map((b) => b._id));
                else setSelectedIds([]);
              }} /></th>
              <th>Booking ID</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Provider</th>
              <th>Service</th>
              {canSeeMoney ? <th className="numeric-cell">Amount</th> : null}
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.map((booking) => (
              <BookingRow
                booking={booking}
                canSeeMoney={canSeeMoney}
                key={booking._id}
                onUpdate={(bookingId, nextStatus) =>
                  statusMutation.mutate({ bookingId, nextStatus })
                }
                updating={statusMutation.isPending}
                selected={selectedIds.includes(booking._id)}
                onSelect={(id) =>
                  setSelectedIds((prev) =>
                    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                  )
                }
                onViewPanel={(id) => setPanelBookingId(id)}
              />
            ))}
          </tbody>
        </table>
        {bookingsQuery.isLoading ? (
          <div className="empty-state">
            <Clock3 size={22} />
            Loading bookings...
          </div>
        ) : null}
        {!bookingsQuery.isLoading && filteredBookings.length === 0 ? (
          <div className="empty-state">No bookings found for this filter.</div>
        ) : null}
        {bookingsQuery.isError ? (
          <div className="error-state">Could not load bookings. Check backend and login token.</div>
        ) : null}

      {/* Detail slide-in panel */}
      <BookingDetailPanel
        bookingId={panelBookingId}
        onClose={() => setPanelBookingId(null)}
      />
      {showCreateModal && <CreateBookingModal onClose={() => setShowCreateModal(false)} />}
      </div>
    </section>
  );
}
