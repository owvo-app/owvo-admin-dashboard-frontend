"use client";

import {
  createAdminTicket,
  getCustomers,
  getTicketUserBookings,
  getWashers,
  type SupportTicketFull,
} from "@/lib/admin-api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useState } from "react";

type Person = { _id: string; name?: string; fullName?: string; email?: string };

function pickItems(data: unknown): Person[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Person[];
  const items = (data as { items?: Person[] }).items;
  return Array.isArray(items) ? items : [];
}

function personLabel(p: Person) {
  return p.fullName || p.name || p.email || "Unnamed user";
}

function serverMessage(error: unknown) {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return (
    e?.response?.data?.message ||
    e?.message ||
    "Something went wrong. Please try again."
  );
}

export function NewTicketModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (ticket: SupportTicketFull) => void;
}) {
  const [reporterKind, setReporterKind] = useState<"customer" | "provider">("customer");
  const [reporterId, setReporterId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [type, setType] = useState("complaint");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => getCustomers({ range: "all" }),
    enabled: open && reporterKind === "customer",
  });
  const washersQuery = useQuery({
    queryKey: ["washers"],
    queryFn: () => getWashers(),
    enabled: open && reporterKind === "provider",
  });
  const peopleQuery = reporterKind === "customer" ? customersQuery : washersQuery;
  const people = pickItems(peopleQuery.data);

  const bookingsQuery = useQuery({
    queryKey: ["ticket-user-bookings", reporterId],
    queryFn: () => getTicketUserBookings(reporterId),
    enabled: open && !!reporterId,
  });
  const bookings = bookingsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminTicket({
        reporterId,
        subject: subject.trim(),
        description: description.trim(),
        type,
        priority,
        bookingId: bookingId || undefined,
      }),
    onSuccess: (ticket) => {
      setError("");
      onCreated(ticket);
    },
    onError: (e) => setError(serverMessage(e)),
  });

  if (!open) return null;

  const canSubmit =
    !!reporterId &&
    subject.trim().length > 0 &&
    description.trim().length > 0 &&
    !createMutation.isPending;

  const handleSubmit = () => {
    if (!reporterId) return setError("Choose who this ticket is for.");
    if (!subject.trim()) return setError("Subject is required.");
    if (!description.trim()) return setError("Description is required.");
    setError("");
    createMutation.mutate();
  };

  return (
    <div className="booking-panel-overlay bk2-center-overlay" onClick={onClose}>
      <div className="create-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="booking-panel-header">
          <div>
            <strong>New Support Ticket</strong>
          </div>
          <button className="mini-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="booking-panel-body">
          {error && <div className="error-state bk2-inline-error">{error}</div>}

          <label className="modal-label">Ticket for *</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={reporterKind === "customer" ? "booking-create-btn" : "booking-filter-reset"}
              onClick={() => { setReporterKind("customer"); setReporterId(""); setBookingId(""); }}
            >
              Customer
            </button>
            <button
              type="button"
              className={reporterKind === "provider" ? "booking-create-btn" : "booking-filter-reset"}
              onClick={() => { setReporterKind("provider"); setReporterId(""); setBookingId(""); }}
            >
              Provider
            </button>
          </div>

          <label className="modal-label">{reporterKind === "customer" ? "Customer" : "Provider"} *</label>
          <select
            className="modal-input"
            value={reporterId}
            onChange={(e) => { setReporterId(e.target.value); setBookingId(""); }}
          >
            <option value="">
              {peopleQuery.isLoading
                ? "Loading..."
                : peopleQuery.isError
                  ? "Could not load — close and try again"
                  : `Select a ${reporterKind}`}
            </option>
            {people.map((p) => (
              <option key={p._id} value={p._id}>
                {personLabel(p)}{p.email ? ` (${p.email})` : ""}
              </option>
            ))}
          </select>
          {!peopleQuery.isLoading && !peopleQuery.isError && people.length === 0 && (
            <p className="table-sub" style={{ marginTop: 6 }}>No {reporterKind}s found.</p>
          )}

          <label className="modal-label" style={{ marginTop: 12 }}>Related booking (optional)</label>
          <select
            className="modal-input"
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            disabled={!reporterId}
          >
            <option value="">
              {!reporterId
                ? "Select the person first"
                : bookingsQuery.isLoading
                  ? "Loading bookings..."
                  : "No linked booking"}
            </option>
            {bookings.map((b) => (
              <option key={b._id} value={b._id}>
                #{b._id.slice(-6).toUpperCase()} — {b.status || ""}
                {b.bookingDate ? ` — ${format(new Date(b.bookingDate), "dd MMM yyyy")}` : ""}
                {typeof b.finalPrice === "number" ? ` — £${b.finalPrice.toFixed(2)}` : ""}
              </option>
            ))}
          </select>
          {reporterId && !bookingsQuery.isLoading && bookings.length === 0 && (
            <p className="table-sub" style={{ marginTop: 6 }}>This person has no bookings.</p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Type *</label>
              <select className="modal-input" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="complaint">Complaint</option>
                <option value="refund">Refund</option>
                <option value="dispute">Dispute</option>
                <option value="technical">Technical</option>
                <option value="cancellation">Cancellation</option>
                <option value="payment">Payment</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Priority</label>
              <select className="modal-input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <label className="modal-label" style={{ marginTop: 12 }}>Subject *</label>
          <input
            className="modal-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of the issue"
            maxLength={200}
          />

          <label className="modal-label" style={{ marginTop: 12 }}>Description *</label>
          <textarea
            className="modal-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What happened? The reporter will see this ticket in their app."
            rows={4}
            maxLength={2000}
          />
          <p className="table-sub" style={{ marginTop: 6 }}>
            The reporter gets a notification and can reply from their app.
          </p>
        </div>

        <div className="booking-panel-footer">
          <button className="booking-filter-reset" onClick={onClose} type="button" style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className="booking-create-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            type="button"
            style={{ flex: 1, padding: "10px 12px" }}
          >
            {createMutation.isPending ? "Creating..." : "Create Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}
