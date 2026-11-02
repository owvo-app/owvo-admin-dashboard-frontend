"use client";

import {
  createAdminBookingV2,
  getAdminAddons,
  getAdminCustomerDetail,
  getAdminServicesPricing,
  getCustomers,
  getWashers,
} from "@/lib/admin-api";
import { money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ─── Google Maps loader (panel wala hi pattern) ───
let bkMapsPromise: Promise<any> | null = null;
function loadGoogleMapsScript(apiKey: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (bkMapsPromise) return bkMapsPromise;
  bkMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.bkGoogleMaps = "true";
    script.onload = () => resolve((window as any).google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return bkMapsPromise;
}

type PickedAddress = { addressLine: string; latitude: number; longitude: number };

// Address input with Google Places suggestions — sirf suggestion PICK
// karne par hi address save hota hai (Customers wala hi rule), taake
// booking par hamesha asal coordinates hon aur map kaam kare.
function AddressAutocomplete({
  value,
  onTextChange,
  onPick,
}: {
  value: string;
  onTextChange: (text: string) => void;
  onPick: (addr: PickedAddress) => void;
}) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const servicesRef = useRef<{ auto: any; places: any; anchor: HTMLDivElement | null }>({
    auto: null,
    places: null,
    anchor: null,
  });

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) return;
    loadGoogleMapsScript(apiKey)
      .then((google) => {
        servicesRef.current.auto =
          new google.maps.places.AutocompleteService();
        servicesRef.current.places = new google.maps.places.PlacesService(
          servicesRef.current.anchor || document.createElement("div")
        );
      })
      .catch(() => {});
  }, []);

  const handleChange = (text: string) => {
    onTextChange(text);
    const auto = servicesRef.current.auto;
    if (!auto || text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    auto.getPlacePredictions(
      { input: text, componentRestrictions: { country: "gb" } },
      (preds: any[]) => {
        setSuggestions(preds || []);
        setOpen(true);
      }
    );
  };

  const handlePick = (pred: any) => {
    const places = servicesRef.current.places;
    setOpen(false);
    if (!places) return;
    places.getDetails(
      { placeId: pred.place_id, fields: ["formatted_address", "geometry"] },
      (place: any, status: string) => {
        if (status === "OK" && place?.geometry?.location) {
          onPick({
            addressLine: place.formatted_address || pred.description,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          });
        }
      }
    );
  };

  return (
    <div className="bk2-ac-wrap">
      <div ref={(el) => { servicesRef.current.anchor = el; }} style={{ display: "none" }} />
      <input
        className="modal-input"
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Start typing the service address..."
        value={value}
      />
      {open && suggestions.length > 0 ? (
        <div className="bk2-ac-list">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              onClick={() => handlePick(s)}
              type="button"
            >
              {s.description}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toArray(d: any): any[] {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.services)) return d.services;
  if (Array.isArray(d.data)) return d.data;
  return [];
}

export function CreateBookingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("10:00");
  const [addressText, setAddressText] = useState("");
  const [picked, setPicked] = useState<PickedAddress | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    // Range na bhejo to backend default "weekly" laga kar sirf is
    // haftay join honay walay customers deta hai — directory ke liye
    // hamesha "all" bhejo (Customers page wala hi pattern).
    queryFn: () => getCustomers({ range: "all" }),
  });
  const washersQuery = useQuery({
    queryKey: ["washers"],
    queryFn: () => getWashers(),
  });
  const servicesQuery = useQuery({
    queryKey: ["services-pricing"],
    queryFn: getAdminServicesPricing,
  });
  const addonsQuery = useQuery({
    queryKey: ["admin-addons"],
    queryFn: getAdminAddons,
  });
  const customerDetailQuery = useQuery({
    queryKey: ["admin-customer-detail", customerId],
    queryFn: () => getAdminCustomerDetail(customerId),
    enabled: !!customerId,
  });

  const customers = toArray(customersQuery.data);
  const washers = toArray(washersQuery.data);
  // Services-pricing ka jawab catalog ko "catalogServices" me deta
  // hai — pehle yahan aam list dhoondi jati thi jo jawab me hoti hi
  // nahi, is liye Service dropdown hamesha khali ata tha.
  const services = toArray(
    (servicesQuery.data as any)?.catalogServices ?? servicesQuery.data
  ).filter((s: any) => s.isActive !== false);
  const addons = (addonsQuery.data ?? []).filter(
    (a: any) => a.isActive !== false
  );
  const vehicles = customerDetailQuery.data?.vehicles ?? [];

  const selectedService = services.find((s: any) => s._id === serviceId);
  const estimatedTotal =
    (Number(selectedService?.price) || 0) +
    addons
      .filter((a: any) => addonIds.includes(a._id))
      .reduce((sum: number, a: any) => sum + (Number(a.price) || 0), 0);

  const createMutation = useMutation({
    mutationFn: createAdminBookingV2,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-v2"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onCreated?.("Booking created and assigned to the provider.");
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message || "Failed to create booking"),
  });

  const handleSubmit = () => {
    setError("");
    if (!customerId || !providerId || !serviceId || !bookingDate) {
      setError("Please fill all required fields");
      return;
    }
    if (!picked) {
      setError(
        "Please pick the address from the suggestions so the exact location is saved."
      );
      return;
    }
    createMutation.mutate({
      customerId,
      providerId,
      serviceId,
      vehicleId: vehicleId || undefined,
      addonIds: addonIds.length ? addonIds : undefined,
      bookingDate: `${bookingDate}T${bookingTime}:00`,
      address: picked,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="booking-panel-overlay bk2-center-overlay" onClick={onClose}>
      <div
        className="create-booking-modal bk2-create-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="booking-panel-header">
          <h3 style={{ margin: 0 }}>Create Booking</h3>
          <button
            aria-label="Close"
            className="mini-icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="booking-panel-body">
          {error ? (
            <div className="error-state bk2-inline-error">{error}</div>
          ) : null}

          <label className="modal-label">Customer *</label>
          <select
            className="modal-input"
            onChange={(e) => {
              setCustomerId(e.target.value);
              setVehicleId("");
            }}
            value={customerId}
          >
            <option value="">Select customer...</option>
            {customers.map((c: any) => (
              <option key={c._id} value={c._id}>
                {c.name} — {c.email}
              </option>
            ))}
          </select>

          <label className="modal-label">Provider *</label>
          <select
            className="modal-input"
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

          <label className="modal-label">Service *</label>
          <select
            className="modal-input"
            onChange={(e) => setServiceId(e.target.value)}
            value={serviceId}
          >
            <option value="">Select service...</option>
            {services.map((s: any) => (
              <option key={s._id} value={s._id}>
                {s.title} — £{s.price}
              </option>
            ))}
          </select>

          <label className="modal-label">Vehicle (customer&apos;s vehicles)</label>
          <select
            className="modal-input"
            disabled={!customerId || customerDetailQuery.isLoading}
            onChange={(e) => setVehicleId(e.target.value)}
            value={vehicleId}
          >
            <option value="">
              {!customerId
                ? "Select a customer first"
                : customerDetailQuery.isLoading
                  ? "Loading vehicles..."
                  : vehicles.length === 0
                    ? "Customer has no vehicles"
                    : "No vehicle"}
            </option>
            {vehicles.map((v) => (
              <option key={v._id} value={v._id}>
                {[v.make, v.model, v.registrationNo].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>

          {addons.length > 0 ? (
            <>
              <label className="modal-label">Add-ons</label>
              <div className="bk2-addon-grid">
                {addons.map((a: any) => (
                  <label className="bk2-check" key={a._id}>
                    <input
                      checked={addonIds.includes(a._id)}
                      onChange={(e) =>
                        setAddonIds((prev) =>
                          e.target.checked
                            ? [...prev, a._id]
                            : prev.filter((x) => x !== a._id)
                        )
                      }
                      type="checkbox"
                    />
                    {a.name} · {money(a.price)}
                  </label>
                ))}
              </div>
            </>
          ) : null}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Date *</label>
              <input
                className="modal-input"
                onChange={(e) => setBookingDate(e.target.value)}
                type="date"
                value={bookingDate}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="modal-label">Time *</label>
              <input
                className="modal-input"
                onChange={(e) => setBookingTime(e.target.value)}
                type="time"
                value={bookingTime}
              />
            </div>
          </div>

          <label className="modal-label">Address *</label>
          <AddressAutocomplete
            onPick={(addr) => {
              setPicked(addr);
              setAddressText(addr.addressLine);
            }}
            onTextChange={(text) => {
              setAddressText(text);
              setPicked(null);
            }}
            value={addressText}
          />
          {picked ? (
            <span className="table-sub">
              ✓ Location saved ({picked.latitude.toFixed(5)},{" "}
              {picked.longitude.toFixed(5)})
            </span>
          ) : null}

          <label className="modal-label">Notes</label>
          <textarea
            className="modal-input"
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            rows={3}
            value={notes}
          />

          <div className="bk2-price-preview">
            <span>Estimated total</span>
            <strong>{money(estimatedTotal)}</strong>
            <small>
              The server confirms the final price from the catalog. The
              booking is created as Accepted with payment Pending — the
              customer pays in the app.
            </small>
          </div>
        </div>
        <div className="booking-panel-footer">
          <button
            className="booking-filter-reset"
            onClick={onClose}
            style={{ flex: 1 }}
            type="button"
          >
            Cancel
          </button>
          <button
            className="booking-create-btn"
            disabled={createMutation.isPending}
            onClick={handleSubmit}
            style={{ flex: 2 }}
            type="button"
          >
            {createMutation.isPending ? "Creating..." : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
