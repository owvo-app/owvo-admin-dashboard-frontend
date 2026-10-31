"use client";

import { SOCKET_URL } from "@/lib/api";
import {
  exportAdminBookingsCsv,
  getAdminBookingsV2,
  getAdminServicesPricing,
  type AdminBookingV2,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth-storage";
import { money } from "@/lib/format";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Eye,
  Loader2,
  Navigation,
  PlayCircle,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  BK_STATUS_LABELS,
  BookingActionModal,
  bkCan,
  bkDate,
  bkPaymentBadge,
  bkShortId,
  bkTime,
  type BookingActionKind,
} from "./bookings/BookingActionModals";
import { BookingDetailPanel } from "./bookings/BookingDetailPanel";
import { CreateBookingModal } from "./bookings/CreateBookingModal";

const STATUS_CARDS = [
  { key: "pending", label: "Requested", icon: Clock3, cls: "blue" },
  { key: "accepted", label: "Accepted", icon: CheckCircle2, cls: "green" },
  { key: "arrived", label: "Arrived", icon: Navigation, cls: "purple" },
  { key: "ongoing", label: "In Progress", icon: PlayCircle, cls: "orange" },
  { key: "completed", label: "Completed", icon: BadgeCheck, cls: "green" },
  { key: "cancelled", label: "Cancelled", icon: XCircle, cls: "red" },
];

const ROW_ACTIONS: Array<{
  status: BookingActionKind;
  label: string;
  icon: typeof Eye;
}> = [
  { status: "accepted", label: "Accept", icon: CheckCircle2 },
  { status: "arrived", label: "Mark arrived", icon: Navigation },
  { status: "ongoing", label: "Start wash", icon: PlayCircle },
  { status: "completed", label: "Complete", icon: BadgeCheck },
  { status: "cancelled", label: "Cancel", icon: XCircle },
];

function toArray(d: any): any[] {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.services)) return d.services;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

function BookingRow({
  booking,
  canSeeMoney,
  selected,
  onSelect,
  onView,
  onAction,
}: {
  booking: AdminBookingV2;
  canSeeMoney: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onView: (id: string) => void;
  onAction: (booking: AdminBookingV2, action: BookingActionKind) => void;
}) {
  const pay = bkPaymentBadge(booking);
  const customerPhoto = (booking.user as any)?.photo?.url;
  const providerPhoto = (booking.provider as any)?.photo?.url;
  const rating = booking.providerRating;
  const vehicleText =
    (booking as any).vehicleSnapshot?.model ||
    [booking.vehicleSnapshot?.make, booking.vehicleSnapshot?.model]
      .filter(Boolean)
      .join(" ") ||
    "";

  return (
    <tr className="clickable-row" onClick={() => onView(booking._id)}>
      <td onClick={(e) => e.stopPropagation()}>
        <input
          checked={selected}
          onChange={() => onSelect(booking._id)}
          type="checkbox"
        />
      </td>
      <td>
        <strong>{bkShortId(booking._id)}</strong>
        {booking.hasOpenDispute ? (
          <span className="bk2-dispute-dot" title="Open dispute on this booking">
            ⚠ Dispute
          </span>
        ) : null}
      </td>
      <td>
        <span>{bkDate(booking.bookingDate)}</span>
        <span className="table-sub">{bkTime(booking.bookingDate)}</span>
      </td>
      <td>
        <div className="table-customer">
          {customerPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="bk2-avatar-img" src={customerPhoto} />
          ) : (
            <span className="table-avatar">
              {(booking.user?.name || "C").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{booking.user?.name || "Customer"}</strong>
            <span className="table-sub">
              {(booking.user as any)?.phoneNumber || booking.user?.email || ""}
            </span>
          </div>
        </div>
      </td>
      <td>
        <div className="table-customer">
          {providerPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="bk2-avatar-img" src={providerPhoto} />
          ) : (
            <span className="table-avatar">
              {(booking.provider?.name || "W").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>{booking.provider?.name || "Provider"}</strong>
            <span className="table-sub">
              {rating && rating.count > 0
                ? `⭐ ${rating.average.toFixed(1)} (${rating.count})`
                : "⭐ No ratings yet"}
            </span>
          </div>
        </div>
      </td>
      <td>
        <strong>{booking.service?.title || "Wash Service"}</strong>
        <span className="table-sub">{vehicleText}</span>
      </td>
      {canSeeMoney ? (
        <td className="numeric-cell">{money(booking.finalPrice)}</td>
      ) : null}
      <td>
        <span className={`bk2-pay ${pay.cls}`}>{pay.label}</span>
      </td>
      <td>
        <span className={`table-status ${booking.status}`}>
          {BK_STATUS_LABELS[booking.status] || booking.status}
        </span>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="row-actions">
          <button
            aria-label="View booking"
            className="mini-icon-button"
            onClick={() => onView(booking._id)}
            title="View details"
            type="button"
          >
            <Eye size={15} />
          </button>
          {ROW_ACTIONS.map((a) => {
            const Icon = a.icon;
            const allowed = bkCan(booking.status, a.status);
            return (
              <button
                aria-label={a.label}
                className="mini-icon-button"
                disabled={!allowed}
                key={a.status}
                onClick={() => onAction(booking, a.status)}
                title={
                  allowed
                    ? a.label
                    : `${a.label} is not available for a ${
                        BK_STATUS_LABELS[booking.status] || booking.status
                      } booking`
                }
                type="button"
              >
                <Icon size={15} />
              </button>
            );
          })}
          <button
            aria-label="Send notification"
            className="mini-icon-button"
            onClick={() => onAction(booking, "notification")}
            title="Send notification"
            type="button"
          >
            <Bell size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function BookingsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [location, setLocation] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [day, setDay] = useState("");
  const [disputedOnly, setDisputedOnly] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [panelBookingId, setPanelBookingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modal, setModal] = useState<{
    booking: AdminBookingV2;
    action: BookingActionKind;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const user = useMemo(() => getStoredUser(), []);
  const canSeeMoney = user?.role === "admin";

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };

  // Search debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Koi bhi filter badle to pehle page par wapas + selection saaf
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [status, search, serviceId, location, paymentStatus, day, disputedOnly, limit, dateRange.queryKey]);

  const bookingsQuery = useQuery({
    queryKey: [
      "admin-bookings-v2",
      status,
      dateRange.queryKey,
      search,
      serviceId,
      location,
      paymentStatus,
      day,
      disputedOnly,
      page,
      limit,
    ],
    queryFn: () =>
      getAdminBookingsV2({
        status,
        ...dateRange.query,
        search: search || undefined,
        serviceId: serviceId || undefined,
        location: location || undefined,
        paymentStatus: paymentStatus || undefined,
        day: day || undefined,
        disputed: disputedOnly || undefined,
        page,
        limit,
      }),
  });

  const servicesQuery = useQuery({
    queryKey: ["services-pricing"],
    queryFn: getAdminServicesPricing,
  });
  const serviceOptions = toArray(servicesQuery.data);

  // Live updates: nayi booking ya status change par list khud refresh
  useEffect(() => {
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-v2"] });
    socket.on("admin_booking_created", refresh);
    socket.on("admin_booking_status_updated", refresh);
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const data = bookingsQuery.data;
  const bookings = data?.items ?? [];
  const pagination = data?.pagination ?? { page: 1, limit, total: 0, pages: 1 };
  const summary = data?.summary;
  const locationOptions = data?.locations ?? [];
  const byStatus = summary?.byStatus ?? {};
  const totalCount = summary?.total ?? pagination.total;

  const hasFilters = Boolean(
    search || serviceId || location || paymentStatus || day || disputedOnly || status !== "all"
  );
  const moreActive = Boolean(paymentStatus || day || disputedOnly);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("all");
    setServiceId("");
    setLocation("");
    setPaymentStatus("");
    setDay("");
    setDisputedOnly(false);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const blob = await exportAdminBookingsCsv({
        status,
        ...dateRange.query,
        search: search || undefined,
        serviceId: serviceId || undefined,
        location: location || undefined,
        paymentStatus: paymentStatus || undefined,
        day: day || undefined,
        disputed: disputedOnly || undefined,
        ids: selectedIds.length ? selectedIds : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bookings-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(
        selectedIds.length
          ? `Exported ${selectedIds.length} selected booking(s).`
          : "Export downloaded."
      );
    } catch {
      showToast("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const total = Math.max(pagination.pages || 1, 1);
    const cur = Math.min(page, total);
    const out: Array<number | "…"> = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || Math.abs(i - cur) <= 1) out.push(i);
      else if (out[out.length - 1] !== "…") out.push("…");
    }
    return out;
  }, [page, pagination.pages]);

  const fromRow = bookings.length ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const toRow = (pagination.page - 1) * pagination.limit + bookings.length;

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
            disabled={exporting}
            onClick={handleExport}
            type="button"
          >
            {exporting ? "Exporting..." : "⬇ Export"}
          </button>
        </div>
      </div>

      {/* Summary cards — kul numbers hamesha server summary se */}
      <div className="booking-summary-grid-7">
        <button
          className={`booking-summary-card ${status === "all" ? "active" : ""}`}
          onClick={() => setStatus("all")}
          type="button"
        >
          <div className="booking-summary-icon blue">
            <ClipboardList size={20} />
          </div>
          <div>
            <div className="booking-summary-value">{totalCount}</div>
            <div className="booking-summary-label">Total Bookings</div>
            <div className="bk2-card-sub">
              {summary ? `+${summary.newThisMonth} this month` : ""}
            </div>
          </div>
        </button>
        {STATUS_CARDS.map((c) => (
          <button
            className={`booking-summary-card ${status === c.key ? "active" : ""}`}
            key={c.key}
            onClick={() => setStatus(status === c.key ? "all" : c.key)}
            type="button"
          >
            <div className={`booking-summary-icon ${c.cls}`}>
              <c.icon size={20} />
            </div>
            <div>
              <div className="booking-summary-value">{byStatus[c.key] ?? 0}</div>
              <div className="booking-summary-label">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="booking-filters">
        <div className="booking-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search booking ID, customer, provider, phone or postcode..."
            type="text"
            value={searchInput}
          />
        </div>
        <select
          className="booking-filter-select"
          onChange={(e) => setStatus(e.target.value)}
          value={status}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Requested</option>
          <option value="accepted">Accepted</option>
          <option value="arrived">Arrived</option>
          <option value="ongoing">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="declined">Declined</option>
        </select>
        <select
          className="booking-filter-select"
          onChange={(e) => setServiceId(e.target.value)}
          value={serviceId}
        >
          <option value="">All Services</option>
          {serviceOptions.map((s: any) => (
            <option key={s._id} value={s._id}>
              {s.title}
            </option>
          ))}
        </select>
        <select
          className="booking-filter-select"
          onChange={(e) => setLocation(e.target.value)}
          value={location}
        >
          <option value="">All Locations</option>
          {locationOptions.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          className={`booking-filter-reset bk2-more-btn ${moreActive ? "bk2-more-active" : ""}`}
          onClick={() => setShowMore((v) => !v)}
          type="button"
        >
          <SlidersHorizontal size={14} /> More Filters{moreActive ? " •" : ""}
        </button>
        <button
          className="booking-filter-reset"
          onClick={resetFilters}
          type="button"
        >
          Reset
        </button>
      </div>

      {showMore && (
        <div className="bk2-more-panel">
          <label className="bk2-more-field">
            <span>Payment status</span>
            <select
              className="booking-filter-select"
              onChange={(e) => setPaymentStatus(e.target.value)}
              value={paymentStatus}
            >
              <option value="">All payments</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
          </label>
          <label className="bk2-more-field">
            <span>Specific day</span>
            <input
              className="booking-filter-select"
              onChange={(e) => setDay(e.target.value)}
              type="date"
              value={day}
            />
          </label>
          <label className="bk2-check bk2-more-check">
            <input
              checked={disputedOnly}
              onChange={(e) => setDisputedOnly(e.target.checked)}
              type="checkbox"
            />
            Only disputed bookings
          </label>
          {day ? (
            <span className="bk2-more-note">
              Day filter replaces the top date range.
            </span>
          ) : null}
        </div>
      )}

      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>
                <input
                  checked={
                    bookings.length > 0 &&
                    bookings.every((b) => selectedIds.includes(b._id))
                  }
                  onChange={(e) =>
                    setSelectedIds(
                      e.target.checked ? bookings.map((b) => b._id) : []
                    )
                  }
                  type="checkbox"
                />
              </th>
              <th>Booking ID</th>
              <th>Date &amp; Time</th>
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
            {bookings.map((booking) => (
              <BookingRow
                booking={booking}
                canSeeMoney={canSeeMoney}
                key={booking._id}
                onAction={(b, action) => setModal({ booking: b, action })}
                onSelect={(id) =>
                  setSelectedIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id]
                  )
                }
                onView={(id) => setPanelBookingId(id)}
                selected={selectedIds.includes(booking._id)}
              />
            ))}
          </tbody>
        </table>

        {bookingsQuery.isLoading ? (
          <div className="empty-state">
            <Loader2 size={22} /> Loading bookings...
          </div>
        ) : null}
        {bookingsQuery.isError ? (
          <div className="error-state">
            Could not load bookings. Check your connection and try again.
            <button
              className="booking-filter-reset"
              onClick={() => bookingsQuery.refetch()}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}
        {!bookingsQuery.isLoading &&
        !bookingsQuery.isError &&
        bookings.length === 0 ? (
          <div className="empty-state">
            {hasFilters
              ? "No bookings match these filters."
              : "No bookings in this date range. Try widening the range from the top bar (for example, All Time)."}
            {hasFilters ? (
              <button
                className="booking-filter-reset"
                onClick={resetFilters}
                type="button"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Pagination */}
        {pagination.total > 0 ? (
          <div className="bk2-pagination">
            <span>
              Showing {fromRow}–{toRow} of {pagination.total} bookings
              {selectedIds.length
                ? ` · ${selectedIds.length} selected`
                : ""}
            </span>
            <div className="bk2-pagination-controls">
              <select
                className="bk2-page-size"
                onChange={(e) => setLimit(Number(e.target.value))}
                value={limit}
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button
                className="bk2-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                ‹ Prev
              </button>
              {pageNumbers.map((n, i) =>
                n === "…" ? (
                  <span className="bk2-page-ellipsis" key={`e-${i}`}>
                    …
                  </span>
                ) : (
                  <button
                    className={`bk2-page-btn ${n === page ? "active" : ""}`}
                    key={n}
                    onClick={() => setPage(n)}
                    type="button"
                  >
                    {n}
                  </button>
                )
              )}
              <button
                className="bk2-page-btn"
                disabled={page >= (pagination.pages || 1)}
                onClick={() =>
                  setPage((p) => Math.min(pagination.pages || 1, p + 1))
                }
                type="button"
              >
                Next ›
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <BookingDetailPanel
        bookingId={panelBookingId}
        onClose={() => setPanelBookingId(null)}
      />
      {showCreateModal && (
        <CreateBookingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(msg) => showToast(msg)}
        />
      )}
      {modal && (
        <BookingActionModal
          action={modal.action}
          booking={modal.booking}
          onClose={() => setModal(null)}
          onDone={(msg) => showToast(msg)}
        />
      )}
      {toast ? <div className="bk2-toast">{toast}</div> : null}
    </section>
  );
}
