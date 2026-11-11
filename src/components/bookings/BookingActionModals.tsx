"use client";

import {
  getWashers,
  sendAdminBookingNotification,
  updateAdminBookingStatusV2,
  type AdminBookingV2,
} from "@/lib/admin-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

// ─── Shared booking helpers (page + panel dono use karte hain) ───

export const BK_STATUS_LABELS: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

// Backend ke transition matrix ki copy — button sirf tab enable hota hai
// jab move asal me mumkin ho. Asal check server par bhi hota hai.
export const BK_TRANSITIONS: Record<string, string[]> = {
  pending: ["accepted", "cancelled"],
  accepted: ["arrived", "cancelled"],
  arrived: ["ongoing", "cancelled"],
  ongoing: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  declined: ["accepted", "cancelled"],
};

export const bkCan = (from: string, to: string) =>
  (BK_TRANSITIONS[from] || []).includes(to);

export const bkShortId = (id?: string) =>
  id ? `#B${id.slice(-6).toUpperCase()}` : "—";

const londonDateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
const londonDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const londonTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export const bkDateTime = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : londonDateTimeFmt.format(d);
};
export const bkDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : londonDateFmt.format(d);
};
export const bkTime = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : londonTimeFmt.format(d);
};

// Booking ki apni commission — hamesha booking par fix hue rate /
// snapshot se. Complete booking par asal snapshot amount; pending
// par usi fix rate se hisaab (completion par rakam yehi kategi).
// Rate hi na ho (bohat purani booking, backfill se pehle) to null —
// wahan UI "—" dikhata hai, current rate se andaza nahi lagta.
export function bkCommissionOf(b: any): {
  rate: number | null;
  amount: number | null;
  net: number | null;
} {
  if (!b) return { rate: null, amount: null, net: null };
  const rate =
    b.commissionRate != null && b.commissionRate !== ""
      ? Number(b.commissionRate)
      : null;
  const gross = Number(b.finalPrice ?? b.price) || 0;
  if (b.commissionAmount != null) {
    const amount = Number(b.commissionAmount) || 0;
    const net =
      b.providerNetAmount != null
        ? Number(b.providerNetAmount) || 0
        : Math.round((gross - amount) * 100) / 100;
    return { rate, amount, net };
  }
  if (rate != null && gross > 0) {
    const amount = Math.round(gross * rate * 100) / 100;
    return { rate, amount, net: Math.round((gross - amount) * 100) / 100 };
  }
  return { rate, amount: null, net: null };
}

export const bkPaymentBadge = (booking: {
  payment?: { status?: string };
  refund?: { status?: string } | null;
}): { label: string; cls: string } => {
  if (booking.refund?.status === "refunded")
    return { label: "Refunded", cls: "bk2-pay-refunded" };
  const s = booking.payment?.status || "pending";
  if (s === "paid") return { label: "Paid", cls: "bk2-pay-paid" };
  if (s === "failed") return { label: "Failed", cls: "bk2-pay-failed" };
  return { label: "Pending", cls: "bk2-pay-pending" };
};

export type BkVehicleInfo = {
  line: string;
  registrationNo: string;
  size: string;
  image: string;
  has: boolean;
};

// Vehicle har haal me nikalo: pehle snapshot (booking ke waqt ki copy),
// warna populated vehicle record. Dono na hon to has=false — UI imaandaar
// "Not provided" dikhayegi.
export const bkVehicleOf = (booking: any): BkVehicleInfo => {
  const snap = booking?.vehicleSnapshot || {};
  const veh =
    booking?.vehicle && typeof booking.vehicle === "object"
      ? booking.vehicle
      : {};
  const pick = (a: any, b: any) =>
    a !== undefined && a !== null && a !== "" ? a : b;
  const make = pick(snap.make, veh.make) || "";
  const model = pick(snap.model, veh.model) || "";
  const year = pick(snap.year, veh.year);
  const registrationNo = pick(snap.registrationNo, veh.registrationNo) || "";
  const size = pick(snap.size, veh.size) || "";
  const rawImage = pick(snap.image, veh.image);
  const image =
    typeof rawImage === "string" ? rawImage : rawImage?.url || "";
  const line = [make, model, year].filter(Boolean).join(" ");
  return {
    line,
    registrationNo,
    size,
    image,
    has: Boolean(line || registrationNo),
  };
};

const CANCEL_REASONS = [
  "Customer requested cancellation",
  "Provider unavailable",
  "Duplicate booking",
  "Incorrect booking details",
  "Payment issue",
  "Other",
];

export type BookingActionKind =
  | "accepted"
  | "arrived"
  | "ongoing"
  | "completed"
  | "cancelled"
  | "notification";

const ACTION_TITLES: Record<BookingActionKind, string> = {
  accepted: "Accept Booking",
  arrived: "Mark as Arrived",
  ongoing: "Start Wash",
  completed: "Complete Booking",
  cancelled: "Cancel Booking",
  notification: "Send Notification",
};

function toArray(d: any): any[] {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

export function BookingActionModal({
  booking,
  action,
  onClose,
  onDone,
}: {
  booking: AdminBookingV2;
  action: BookingActionKind;
  onClose: () => void;
  onDone?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [providerId, setProviderId] = useState(
    (booking.provider as any)?._id || ""
  );
  const [eta, setEta] = useState("");
  const [reason, setReason] = useState(CANCEL_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [notifyBoth, setNotifyBoth] = useState(true);
  const [message, setMessage] = useState("");
  const [toCustomer, setToCustomer] = useState(true);
  const [toProvider, setToProvider] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const washersQuery = useQuery({
    queryKey: ["washers"],
    queryFn: () => getWashers(),
    enabled: action === "accepted",
  });
  const washers = toArray(washersQuery.data);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-bookings-v2"] });
    queryClient.invalidateQueries({ queryKey: ["admin-booking-detail-v2"] });
    queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
  };

  const statusMutation = useMutation({
    mutationFn: (payload: Parameters<typeof updateAdminBookingStatusV2>[1]) =>
      updateAdminBookingStatusV2(booking._id, payload),
    onSuccess: () => {
      invalidate();
      onDone?.(
        `Booking ${bkShortId(booking._id)} is now ${
          BK_STATUS_LABELS[action] || action
        }.`
      );
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message || "Something went wrong"),
  });

  const notifyMutation = useMutation({
    mutationFn: () =>
      sendAdminBookingNotification(booking._id, {
        message: message.trim(),
        notifyCustomer: toCustomer,
        notifyProvider: toProvider,
      }),
    onSuccess: () => {
      onDone?.("Notification sent.");
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message || "Could not send notification"),
  });

  const busy = statusMutation.isPending || notifyMutation.isPending;

  const handleSubmit = () => {
    setError("");
    if (action === "notification") {
      if (!message.trim()) {
        setError("Please write a message");
        return;
      }
      if (!toCustomer && !toProvider) {
        setError("Select at least one recipient");
        return;
      }
      notifyMutation.mutate();
      return;
    }
    if (action === "accepted") {
      if (!providerId) {
        setError("Please select a provider");
        return;
      }
      statusMutation.mutate({
        status: "accepted",
        providerId,
        estimatedArrival: eta ? new Date(eta).toISOString() : undefined,
      });
      return;
    }
    if (action === "arrived" || action === "ongoing") {
      statusMutation.mutate({ status: action });
      return;
    }
    if (action === "completed") {
      statusMutation.mutate({
        status: "completed",
        notes: notes.trim() || undefined,
        notifyCustomer: notifyBoth,
        notifyProvider: notifyBoth,
      });
      return;
    }
    if (action === "cancelled") {
      const finalReason = reason === "Other" ? notes.trim() : reason;
      if (!finalReason) {
        setError("Please write the cancellation reason");
        return;
      }
      statusMutation.mutate({
        status: "cancelled",
        reason: finalReason,
        notes: reason === "Other" ? undefined : notes.trim() || undefined,
      });
    }
  };

  return (
    <div className="bk2-modal-overlay" onClick={onClose}>
      <div className="bk2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk2-modal-header">
          <strong>{ACTION_TITLES[action]}</strong>
          <button
            aria-label="Close"
            className="mini-icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="bk2-modal-body">
          <p className="bk2-modal-sub">
            {bkShortId(booking._id)} · {booking.user?.name || "Customer"} ·{" "}
            {booking.service?.title || "Wash Service"}
          </p>
          {error ? <div className="error-state bk2-inline-error">{error}</div> : null}

          {action === "accepted" && (
            <>
              <label className="bk2-label">Assign provider *</label>
              <select
                className="bk2-input"
                onChange={(e) => setProviderId(e.target.value)}
                value={providerId}
              >
                <option value="">Select provider...</option>
                {washers.map((w: any) => (
                  <option key={w._id} value={w._id}>
                    {w.name} {w.isOnline ? "(Online)" : "(Offline)"}
                  </option>
                ))}
              </select>
              <label className="bk2-label">
                Estimated arrival (optional)
              </label>
              <input
                className="bk2-input"
                onChange={(e) => setEta(e.target.value)}
                type="datetime-local"
                value={eta}
              />
            </>
          )}

          {action === "arrived" && (
            <p className="bk2-modal-text">
              Confirm the provider has arrived at the customer&apos;s location.
              The customer will see the status change in the app.
            </p>
          )}

          {action === "ongoing" && (
            <p className="bk2-modal-text">
              Confirm the wash has started. The booking moves to In Progress
              for the customer and the provider.
            </p>
          )}

          {action === "completed" && (
            <>
              <label className="bk2-label">Completion notes (optional)</label>
              <textarea
                className="bk2-input"
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth recording about this wash..."
                rows={3}
                value={notes}
              />
              <label className="bk2-check">
                <input
                  checked={notifyBoth}
                  onChange={(e) => setNotifyBoth(e.target.checked)}
                  type="checkbox"
                />
                Notify customer &amp; provider
              </label>
            </>
          )}

          {action === "cancelled" && (
            <>
              <label className="bk2-label">Cancellation reason *</label>
              <select
                className="bk2-input"
                onChange={(e) => setReason(e.target.value)}
                value={reason}
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <label className="bk2-label">
                {reason === "Other" ? "Reason details *" : "Notes (optional)"}
              </label>
              <textarea
                className="bk2-input"
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  reason === "Other"
                    ? "Write the cancellation reason..."
                    : "Extra details (optional)..."
                }
                rows={3}
                value={notes}
              />
              <p className="bk2-modal-text">
                The reason is saved on the booking and shared with the customer
                and provider.
              </p>
            </>
          )}

          {action === "notification" && (
            <>
              <label className="bk2-label">Message *</label>
              <textarea
                className="bk2-input"
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write the notification message..."
                rows={4}
                value={message}
              />
              <label className="bk2-check">
                <input
                  checked={toCustomer}
                  onChange={(e) => setToCustomer(e.target.checked)}
                  type="checkbox"
                />
                Send to customer ({booking.user?.name || "Customer"})
              </label>
              <label className="bk2-check">
                <input
                  checked={toProvider}
                  onChange={(e) => setToProvider(e.target.checked)}
                  type="checkbox"
                />
                Send to provider ({booking.provider?.name || "Provider"})
              </label>
            </>
          )}
        </div>
        <div className="bk2-modal-footer">
          <button
            className="booking-filter-reset"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
          <button
            className={
              action === "cancelled" ? "bk2-btn-danger" : "booking-create-btn"
            }
            disabled={busy}
            onClick={handleSubmit}
            type="button"
          >
            {busy ? "Working..." : ACTION_TITLES[action]}
          </button>
        </div>
      </div>
    </div>
  );
}
