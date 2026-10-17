"use client";

import {
  createAdminBooking,
  getAdminServicesPricing,
  getCustomers,
  getWashers,
} from "@/lib/admin-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

export function CreateBookingModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("10:00");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const customersQuery = useQuery({ queryKey: ["customers"], queryFn: () => getCustomers() });
  const washersQuery = useQuery({ queryKey: ["washers"], queryFn: () => getWashers() });
  const servicesQuery = useQuery({ queryKey: ["services-pricing"], queryFn: getAdminServicesPricing });

  const createMutation = useMutation({
    mutationFn: createAdminBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      onClose();
    },
    onError: (e: any) => {
      setError(e?.response?.data?.message || "Failed to create booking");
    },
  });

  const handleSubmit = () => {
    setError("");
    if (!customerId || !providerId || !serviceId || !bookingDate || !address.trim()) {
      setError("Please fill all required fields");
      return;
    }
    const datetime = `${bookingDate}T${bookingTime}:00`;
    createMutation.mutate({ customerId, providerId, serviceId, bookingDate: datetime, address: address.trim(), notes: notes.trim() });
  };

  const customers = (customersQuery.data as any)?.items ?? customersQuery.data ?? [];
  const washers = (washersQuery.data as any) ?? [];
  const services = (servicesQuery.data as any)?.services ?? servicesQuery.data ?? [];

  return (
    <div className="booking-panel-overlay" onClick={onClose}>
      <div className="create-booking-modal" onClick={(e) => e.stopPropagation()}>
        <div className="booking-panel-header">
          <h3 style={{ margin: 0 }}>Create Booking</h3>
          <button className="mini-icon-button" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <div className="booking-panel-body">
          {error && <div className="error-state" style={{ marginBottom: 12 }}>{error}</div>}

          <label className="modal-label">Customer *</label>
          <select className="modal-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select customer...</option>
            {(Array.isArray(customers) ? customers : []).map((c: any) => (
              <option key={c._id} value={c._id}>{c.name} — {c.email}</option>
            ))}
          </select>

          <label className="modal-label">Provider *</label>
          <select className="modal-input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
            <option value="">Select provider...</option>
            {(Array.isArray(washers) ? washers : []).map((w: any) => (
              <option key={w._id} value={w._id}>{w.name} {w.isOnline ? "(Online)" : "(Offline)"}</option>
            ))}
          </select>

          <label className="modal-label">Service *</label>
          <select className="modal-input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Select service...</option>
            {(Array.isArray(services) ? services : []).map((s: any) => (
              <option key={s._id} value={s._id}>{s.title} — £{s.price}</option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Date *</label>
              <input type="date" className="modal-input" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Time *</label>
              <input type="time" className="modal-input" value={bookingTime} onChange={(e) => setBookingTime(e.target.value)} />
            </div>
          </div>

          <label className="modal-label">Address *</label>
          <input
            className="modal-input"
            placeholder="Service location address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <label className="modal-label">Notes</label>
          <textarea
            className="modal-input"
            placeholder="Optional notes..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        <div className="booking-panel-footer">
          <button className="booking-filter-reset" onClick={onClose} type="button" style={{ flex: 1 }}>Cancel</button>
          <button
            className="booking-create-btn"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            type="button"
            style={{ flex: 2 }}
          >
            {createMutation.isPending ? "Creating..." : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
