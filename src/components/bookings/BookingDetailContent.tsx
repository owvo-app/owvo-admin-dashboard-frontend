"use client";

import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { BookingDetailBody } from "./BookingDetailPanel";

// Full-page booking detail (/bookings/[id]) — bilkul wahi detail jo slide-in
// panel dikhata hai (shared BookingDetailBody), taake dono jagah kabhi
// alag numbers ya purani haalat na dikhe.
export default function BookingDetailContent({
  bookingId,
}: {
  bookingId: string;
}) {
  const [autoPrint, setAutoPrint] = useState(false);

  useEffect(() => {
    setAutoPrint(
      new URLSearchParams(window.location.search).get("print") === "1"
    );
  }, []);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <a className="bk2-back-link" href="/bookings">
            <ArrowLeft size={15} /> Back to Bookings
          </a>
          <h1>Booking Details</h1>
          <p>Full booking record — status, payment, chat, notes and dispute.</p>
        </div>
      </div>
      <div className="bk2-page-card">
        <BookingDetailBody autoPrint={autoPrint} bookingId={bookingId} />
      </div>
    </section>
  );
}
