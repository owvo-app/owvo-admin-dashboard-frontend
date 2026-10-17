"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowLeft,
  User,
  Car,
  CreditCard,
  Clock,
  MessageSquare,
  Star,
  Wrench,
} from "lucide-react";
import { getAdminBookingById } from "@/lib/admin-api";
import { money } from "@/lib/format";

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="booking-detail-card">
      <h3>
        <span className="booking-detail-card-icon">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="booking-detail-row">
      <span className="booking-detail-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

export default function BookingDetailContent({ bookingId }: { bookingId: string }) {
  const router = useRouter();

  const bookingQuery = useQuery({
    queryKey: ["admin-booking", bookingId],
    queryFn: () => getAdminBookingById(bookingId),
  });

  const booking: any = bookingQuery.data;

  if (bookingQuery.isLoading) {
    return (
      <section className="data-page">
        <p>Loading booking details...</p>
      </section>
    );
  }

  if (bookingQuery.isError || !booking) {
    return (
      <section className="data-page">
        <button className="mini-text-button" onClick={() => router.back()} type="button">
          <ArrowLeft size={14} /> Back
        </button>
        <p>Booking not found.</p>
      </section>
    );
  }

  const date = booking.bookingDate ? new Date(booking.bookingDate) : null;

  // Timeline steps
  const timeline = [
    { key: "created", label: "Requested", time: booking.createdAt },
    { key: "accepted", label: "Accepted", time: booking.acceptedAt },
    { key: "arrived", label: "Arrived", time: booking.arrivedAt },
    { key: "ongoing", label: "Started", time: booking.ongoingAt },
    { key: "completed", label: "Completed", time: booking.completedAt },
  ].filter((s) => s.time);
  if (booking.status === "cancelled") {
    timeline.push({ key: "cancelled", label: "Cancelled", time: booking.cancelledAt });
  }

  const addons = booking.addons || [];
  const servicePrice = booking.service?.price || booking.price || 0;

  return (
    <section className="data-page">
      <button className="mini-text-button" onClick={() => router.back()} type="button">
        <ArrowLeft size={14} /> Back to Bookings
      </button>

      {/* Header */}
      <div className="booking-detail-header">
        <div>
          <h1>Booking #{booking._id.slice(-6).toUpperCase()}</h1>
          <p>{date ? format(date, "dd MMM yyyy, hh:mm a") : "No date"}</p>
        </div>
        <span className={`table-status ${booking.status}`}>
          {statusLabels[booking.status] || booking.status}
        </span>
      </div>

      <div className="booking-detail-grid">
        {/* Customer + Washer */}
        <Section icon={<User size={16} />} title="People">
          <Row label="Customer" value={booking.user?.name || "—"} />
          <Row label="Phone" value={booking.user?.phoneNumber || "—"} />
          <Row label="Email" value={booking.user?.email || "—"} />
          <div className="booking-detail-divider" />
          <Row
            label="Washer"
            value={
              booking.provider?._id ? (
                <a href={`/washers/${booking.provider._id}`} className="booking-detail-link">
                  {booking.provider?.name || "—"}
                </a>
              ) : (
                booking.provider?.name || "—"
              )
            }
          />
          <Row label="Phone" value={booking.provider?.phoneNumber || "—"} />
        </Section>

        {/* Service */}
        <Section icon={<Wrench size={16} />} title="Service">
          <Row label="Service" value={booking.service?.title || "—"} />
          {addons.map((a: any, i: number) => (
            <Row key={i} label="Add-on" value={`${a.title || "Add-on"} — ${money(a.price || 0)}`} />
          ))}
          <div className="booking-detail-divider" />
          <Row
            label="Vehicle"
            value={
              booking.vehicle
                ? `${booking.vehicle.make || ""} ${booking.vehicle.model || ""} (${booking.vehicle.registrationNo || "—"})`
                : booking.vehicleSnapshot
                  ? `${booking.vehicleSnapshot.make || ""} ${booking.vehicleSnapshot.model || ""}`
                  : "—"
            }
          />
        </Section>

        {/* Price */}
        <Section icon={<CreditCard size={16} />} title="Payment">
          <Row label="Service" value={money(servicePrice)} />
          {(booking.addonsTotal || 0) > 0 && (
            <Row label="Add-ons" value={money(booking.addonsTotal)} />
          )}
          {(booking.discountPrice || 0) > 0 && (
            <Row label={`Discount${booking.coupon?.code ? ` (${booking.coupon.code})` : ""}`} value={`−${money(booking.discountPrice)}`} />
          )}
          <div className="booking-detail-divider" />
          <Row label="Total" value={<strong>{money(booking.finalPrice)}</strong>} />
          <Row
            label="Status"
            value={
              <span className={`table-status ${booking.payment?.status === "paid" ? "approved" : "pending"}`}>
                {booking.payment?.status || "pending"}
              </span>
            }
          />
          {booking.payment?.stripePaymentIntentId && (
            <Row label="Stripe ID" value={<code className="booking-detail-code">{booking.payment.stripePaymentIntentId}</code>} />
          )}
        </Section>

        {/* Timeline */}
        <Section icon={<Clock size={16} />} title="Timeline">
          {timeline.length === 0 ? (
            <p className="washer-detail-muted">No timeline events yet.</p>
          ) : (
            <div className="booking-timeline">
              {timeline.map((step) => (
                <div key={step.key} className="booking-timeline-step">
                  <div className="booking-timeline-dot" />
                  <div>
                    <div className="booking-timeline-label">{step.label}</div>
                    <div className="booking-timeline-time">
                      {format(new Date(step.time), "dd MMM, hh:mm a")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {booking.status === "cancelled" && booking.cancellationReason && (
            <Row label="Cancel reason" value={booking.cancellationReason} />
          )}
        </Section>
      </div>

      {/* Chat placeholder */}
      <Section icon={<MessageSquare size={16} />} title="Chat History">
        <p className="washer-detail-muted">Chat messages will appear here once the messaging API is connected.</p>
      </Section>

      {/* Ratings placeholder */}
      <div className="booking-detail-grid">
        <Section icon={<Star size={16} />} title="Customer Rating">
          <p className="washer-detail-muted">No rating yet.</p>
        </Section>
        <Section icon={<Star size={16} />} title="Washer Rating">
          <p className="washer-detail-muted">No rating yet.</p>
        </Section>
      </div>

      {/* Car icon section for vehicle details if needed */}
      <Section icon={<Car size={16} />} title="Notes">
        <p className="washer-detail-muted">Admin notes and dispute flags will appear here.</p>
      </Section>
    </section>
  );
}
