"use client";

import { getAdminBookingById, type AdminBookingDetail } from "@/lib/admin-api";
import { money } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Mail, MessageSquare, Phone, X } from "lucide-react";
import { useState } from "react";

const statusLabels: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function BookingDetailPanel({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("overview");

  const detailQuery = useQuery({
    queryKey: ["admin-booking-detail", bookingId],
    queryFn: () => getAdminBookingById(bookingId!),
    enabled: !!bookingId,
  });

  const booking = detailQuery.data as AdminBookingDetail | undefined;

  if (!bookingId) return null;

  if (detailQuery.isError) {
    return (
      <div className="booking-panel-overlay" onClick={onClose}>
        <div className="booking-panel" onClick={(e) => e.stopPropagation()}>
          <div className="booking-panel-header">
            <strong>Error</strong>
            <button className="mini-icon-button" onClick={onClose} type="button">
              <X size={18} />
            </button>
          </div>
          <div className="booking-panel-body">
            <p>Could not load booking details. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  const tabs = ["Overview", "Timeline", "Payment", "Notes", "Dispute"];

  return (
    <div className="booking-panel-overlay" onClick={onClose}>
      <div className="booking-panel" onClick={(e) => e.stopPropagation()}>
        <div className="booking-panel-header">
          <div>
            <strong>#{booking?._id ? booking._id.slice(-6).toUpperCase() : "..."}</strong>
            <span className={`table-status ${booking?.status || ""}`}>
              {statusLabels[booking?.status || ""] || booking?.status}
            </span>
          </div>
          <button className="mini-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        {booking?.bookingDate && (
          <p className="booking-panel-date">
            {format(new Date(booking.bookingDate), "dd MMM yyyy, hh:mm a")}
          </p>
        )}

        <div className="booking-panel-actions">
          {["Resend SMS", "Message", "Invoice", "More"].map((a) => (
            <button key={a} className="booking-panel-action-btn" type="button">
              {a}
            </button>
          ))}
        </div>

        <div className="booking-panel-tabs">
          {tabs.map((t) => (
            <button
              key={t}
              className={tab === t.toLowerCase() ? "active" : ""}
              onClick={() => setTab(t.toLowerCase())}
              type="button"
            >
              {t}
            </button>
          ))}
        </div>

        <div className="booking-panel-body">
          {detailQuery.isLoading && <p>Loading...</p>}
          {booking && tab === "overview" && (
            <>
              <div className="booking-panel-section">
                <h4>Customer Information</h4>
                <div className="booking-panel-person">
                  <span className="table-avatar">
                    {(booking.user?.name || "C").slice(0, 1)}
                  </span>
                  <div>
                    <strong>{booking.user?.name || "Customer"}</strong>
                    <span className="table-sub">{(booking.user as any)?.phoneNumber || ""}</span>
                    <span className="table-sub">{booking.user?.email || ""}</span>
                  </div>
                  <div className="booking-panel-icons">
                    <Phone size={16} /> <MessageSquare size={16} /> <Mail size={16} />
                  </div>
                </div>
              </div>

              <div className="booking-panel-section">
                <h4>Provider Information</h4>
                <div className="booking-panel-person">
                  <span className="table-avatar">
                    {(booking.provider?.name || "W").slice(0, 1)}
                  </span>
                  <div>
                    <strong>{booking.provider?.name || "Washer"}</strong>
                    <span className="table-sub">{(booking.provider as any)?.phoneNumber || ""}</span>
                    <span className="table-sub">
                      ⭐ {(booking.provider as any)?.customerRatingAverage?.toFixed(1) || "—"}
                    </span>
                  </div>
                  <div className="booking-panel-icons">
                    <Phone size={16} /> <MessageSquare size={16} /> <Mail size={16} />
                  </div>
                </div>
              </div>

              <div className="booking-panel-section">
                <h4>Booking Information</h4>
                <div className="booking-panel-row"><span>Service</span><strong>{booking.service?.title || "—"}</strong></div>
                <div className="booking-panel-row"><span>Vehicle</span><strong>{(booking as any).vehicle?.model || (booking as any).vehicleSnapshot?.model || "—"}</strong></div>
                <div className="booking-panel-row"><span>Location</span><strong>{
                  typeof (booking as any).address === "string"
                    ? (booking as any).address
                    : (booking as any).address?.addressLine || (booking as any).address?.formatted || "—"
                }</strong></div>
                <div className="booking-panel-row"><span>Scheduled</span><strong>{booking.bookingDate ? format(new Date(booking.bookingDate), "dd MMM yyyy, hh:mm a") : "—"}</strong></div>
              </div>

              <div className="booking-panel-section">
                <h4>Payment Information</h4>
                <div className="booking-panel-row"><span>Service Amount</span><strong>{money((booking as any).price || booking.finalPrice)}</strong></div>
                <div className="booking-panel-row"><span>Total Amount</span><strong>{money(booking.finalPrice)}</strong></div>
                <div className="booking-panel-row"><span>Payment Status</span>
                  <span className={`payment-badge ${(booking as any).payment?.status === "paid" ? "paid" : "failed"}`}>
                    {(booking as any).payment?.status || "pending"}
                  </span>
                </div>
                {(booking as any).payment?.stripePaymentIntentId && (
                  <div className="booking-panel-row"><span>Transaction ID</span><strong className="mono-sm">{(booking as any).payment.stripePaymentIntentId}</strong></div>
                )}
              </div>
            </>
          )}
          {booking && tab === "timeline" && (
            <div className="booking-panel-section">
              <h4>Timeline</h4>
              {[
                { label: "Requested", time: booking.createdAt },
                { label: "Arrived", time: (booking as any).arrivedAt },
                { label: "Completed", time: (booking as any).completedAt },
                { label: "Cancelled", time: (booking as any).cancelledAt },
              ].filter((s) => s.time).map((s) => (
                <div className="booking-panel-row" key={s.label}>
                  <span>{s.label}</span>
                  <strong>{format(new Date(s.time), "dd MMM yyyy, hh:mm a")}</strong>
                </div>
              ))}
              {(booking as any).cancellationReason && (
                <div className="booking-panel-row"><span>Cancel Reason</span><strong>{(booking as any).cancellationReason}</strong></div>
              )}
            </div>
          )}
          {booking && tab === "payment" && (
            <div className="booking-panel-section">
              <h4>Payment Details</h4>
              <div className="booking-panel-row"><span>Service Amount</span><strong>{money((booking as any).price || booking.finalPrice)}</strong></div>
              {(booking as any).addonsTotal ? (
                <div className="booking-panel-row"><span>Add-ons</span><strong>{money((booking as any).addonsTotal)}</strong></div>
              ) : null}
              {(booking as any).discountPrice ? (
                <div className="booking-panel-row"><span>Discount</span><strong>−{money((booking as any).discountPrice)}</strong></div>
              ) : null}
              <div className="booking-panel-row"><span>Total</span><strong>{money(booking.finalPrice)}</strong></div>
            </div>
          )}
          {booking && tab === "notes" && (
            <div className="booking-panel-section">
              <h4>Notes</h4>
              <p className="table-sub">No notes yet. Notes feature coming soon.</p>
            </div>
          )}
          {booking && tab === "dispute" && (
            <div className="booking-panel-section">
              <h4>Dispute</h4>
              <p className="table-sub">No dispute filed. Dispute system coming soon.</p>
            </div>
          )}
        </div>

        <div className="booking-panel-footer">
          <button className="booking-create-btn" type="button">✏️ Edit Booking</button>
          <button className="booking-cancel-btn" type="button">🚫 Cancel Booking</button>
        </div>
      </div>
    </div>
  );
}
