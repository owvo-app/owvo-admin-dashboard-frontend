"use client";

import { SOCKET_URL } from "@/lib/api";
import {
  addAdminBookingNote,
  createAdminBookingDispute,
  deleteAdminBookingNote,
  getAdminBookingByIdV2,
  getAdminBookingDispute,
  getAdminBookingMessages,
  getAdminBookingNotes,
  refundAdminBooking,
  sendAdminBookingMessage,
  type AdminBookingV2,
  type AdminBookingV2Detail,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth-storage";
import { money } from "@/lib/format";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  CheckCircle2,
  Mail,
  MessageSquare,
  Navigation,
  Phone,
  PlayCircle,
  Printer,
  Send,
  Share2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  BK_STATUS_LABELS,
  BookingActionModal,
  bkCan,
  bkDateTime,
  bkPaymentBadge,
  bkShortId,
  type BookingActionKind,
} from "./BookingActionModals";

// ─── Google Maps loader (OperationsPages wala hi pattern) ───
let bkMapsPromise: Promise<any> | null = null;
function loadGoogleMapsScript(apiKey: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps) return Promise.resolve(w.google);
  if (bkMapsPromise) return bkMapsPromise;
  bkMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-bk-google-maps="true"]'
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).google));
      existing.addEventListener("error", reject);
      return;
    }
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

const esc = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function agoText(iso?: string | null) {
  if (!iso) return "";
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  );
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

const ACTIVE_STATUSES = ["pending", "accepted", "arrived", "ongoing"];

// ─── Location tab map ───
function BookingLocationMap({ booking }: { booking: AdminBookingV2Detail }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "nocords">(
    "loading"
  );

  const destLat = Number(booking.address?.latitude) || 0;
  const destLng = Number(booking.address?.longitude) || 0;
  const dest = destLat !== 0 && destLng !== 0 ? { lat: destLat, lng: destLng } : null;

  const providerCoords = (booking.provider as any)?.location?.coordinates;
  const providerPoint =
    Array.isArray(providerCoords) &&
    providerCoords.length === 2 &&
    (providerCoords[0] !== 0 || providerCoords[1] !== 0) &&
    ACTIVE_STATUSES.includes(booking.status)
      ? { lat: Number(providerCoords[1]), lng: Number(providerCoords[0]) }
      : null;

  const custLat = Number(booking.customerLocation?.latitude) || 0;
  const custLng = Number(booking.customerLocation?.longitude) || 0;
  const customerPoint =
    custLat !== 0 && custLng !== 0 && ACTIVE_STATUSES.includes(booking.status)
      ? { lat: custLat, lng: custLng }
      : null;

  useEffect(() => {
    let cancelled = false;
    if (!dest && !providerPoint && !customerPoint) {
      setState("nocords");
      return;
    }
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    if (!apiKey) {
      setState("error");
      return;
    }
    loadGoogleMapsScript(apiKey)
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        const center = dest || providerPoint || customerPoint!;
        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const bounds = new google.maps.LatLngBounds();
        if (dest) {
          new google.maps.Marker({
            position: dest,
            map,
            title: "Booking address",
          });
          bounds.extend(dest);
        }
        if (providerPoint) {
          new google.maps.Marker({
            position: providerPoint,
            map,
            title: "Provider (live)",
            label: "P",
          });
          bounds.extend(providerPoint);
        }
        if (customerPoint) {
          new google.maps.Marker({
            position: customerPoint,
            map,
            title: "Customer (live)",
            label: "C",
          });
          bounds.extend(customerPoint);
        }
        if (!bounds.isEmpty() && (providerPoint || customerPoint)) {
          map.fitBounds(bounds, 60);
        }
        // Asal road route (Directions) — Map Standard ke mutabiq kabhi
        // seedhi line nahi.
        if (dest && providerPoint) {
          const service = new google.maps.DirectionsService();
          service.route(
            {
              origin: providerPoint,
              destination: dest,
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (result: any, status: string) => {
              if (status === "OK" && result) {
                new google.maps.DirectionsRenderer({
                  map,
                  suppressMarkers: true,
                  polylineOptions: { strokeColor: "#6c2bd9", strokeWeight: 5 },
                }).setDirections(result);
              }
            }
          );
        }
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking._id, booking.status, destLat, destLng]);

  return (
    <div className="booking-panel-section">
      <h4>Location</h4>
      {state === "nocords" ? (
        <p className="table-sub">
          Location coordinates are not available for this booking.
        </p>
      ) : state === "error" ? (
        <p className="table-sub">
          Map could not be loaded. Check the connection and try again.
        </p>
      ) : (
        <div className="bk2-map-wrap">
          <div className="bk2-map" ref={mapRef} />
          {state === "loading" ? (
            <span className="bk2-map-loading">Loading map...</span>
          ) : null}
        </div>
      )}
      <div className="booking-panel-row">
        <span>Address</span>
        <strong className="bk2-row-value">
          {booking.address?.addressLine || "—"}
        </strong>
      </div>
      <div className="booking-panel-row">
        <span>Postcode</span>
        <strong>{booking.postalCode || "—"}</strong>
      </div>
      {customerPoint ? (
        <div className="booking-panel-row">
          <span>Customer distance / ETA</span>
          <strong>
            {booking.customerDistanceMiles != null
              ? `${booking.customerDistanceMiles} mi`
              : "—"}
            {booking.customerEtaMinutes != null
              ? ` · ~${booking.customerEtaMinutes} min`
              : ""}
            {booking.customerLocation?.updatedAt
              ? ` · updated ${agoText(booking.customerLocation.updatedAt)}`
              : ""}
          </strong>
        </div>
      ) : null}
      {providerPoint ? (
        <div className="booking-panel-row">
          <span>Provider live location</span>
          <strong>Available (P on the map)</strong>
        </div>
      ) : null}
    </div>
  );
}

// ─── Chat drawer ───
function BookingChatDrawer({
  booking,
  onClose,
  showToast,
}: {
  booking: AdminBookingV2Detail;
  onClose: () => void;
  showToast: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const user = useMemo(() => getStoredUser(), []);

  const messagesQuery = useQuery({
    queryKey: ["admin-booking-messages", booking._id],
    queryFn: () => getAdminBookingMessages(booking._id),
    refetchInterval: 5000,
  });
  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    socket.on("chat_message", (payload: any) => {
      if (payload?.bookingId === booking._id) {
        queryClient.invalidateQueries({
          queryKey: ["admin-booking-messages", booking._id],
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [booking._id, queryClient, user?._id]);

  const sendMutation = useMutation({
    mutationFn: () => sendAdminBookingMessage(booking._id, text.trim()),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({
        queryKey: ["admin-booking-messages", booking._id],
      });
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.message || "Message could not be sent"),
  });

  return (
    <div className="bk2-chat-overlay" onClick={onClose}>
      <div className="bk2-chat" onClick={(e) => e.stopPropagation()}>
        <div className="bk2-chat-header">
          <div>
            <strong>Booking chat</strong>
            <span className="table-sub">
              {booking.user?.name || "Customer"} ↔{" "}
              {booking.provider?.name || "Provider"} · Admin messages are
              visible to both
            </span>
          </div>
          <button
            aria-label="Close chat"
            className="mini-icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
        <div className="bk2-chat-list" ref={listRef}>
          {messagesQuery.isLoading ? (
            <p className="table-sub">Loading messages...</p>
          ) : messagesQuery.isError ? (
            <p className="table-sub">
              Messages could not be loaded.{" "}
              <button
                className="bk2-link-btn"
                onClick={() => messagesQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </p>
          ) : messages.length === 0 ? (
            <p className="table-sub">
              No messages in this booking yet. Say hello — the customer and
              provider will both see admin messages.
            </p>
          ) : (
            messages.map((m) => (
              <div
                className={`bk2-chat-row ${m.isAdmin ? "admin" : ""}`}
                key={m._id}
              >
                <div className="bk2-chat-bubble">
                  <span className="bk2-chat-name">
                    {m.isAdmin
                      ? `${m.senderName || "OWVO Support"} · Support`
                      : m.senderName || "User"}
                  </span>
                  {m.attachment?.url ? (
                    m.attachment.type === "image" ||
                    (m.attachment.mimeType || "").startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={m.attachment.name || "Attachment"}
                        className="bk2-chat-img"
                        src={m.attachment.url}
                      />
                    ) : (
                      <a
                        className="bk2-chat-file"
                        href={m.attachment.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        📎 {m.attachment.name || "Attachment"}
                      </a>
                    )
                  ) : null}
                  {m.text ? <p>{m.text}</p> : null}
                  <span className="bk2-chat-time">
                    {m.createdAt
                      ? new Intl.DateTimeFormat("en-GB", {
                          timeZone: "Europe/London",
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        }).format(new Date(m.createdAt))
                      : ""}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="bk2-chat-input">
          <input
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim() && !sendMutation.isPending)
                sendMutation.mutate();
            }}
            placeholder="Write a message as OWVO Support..."
            value={text}
          />
          <button
            aria-label="Send message"
            className="booking-create-btn"
            disabled={!text.trim() || sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
            type="button"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Refund modal ───
function RefundModal({
  booking,
  onClose,
  onDone,
}: {
  booking: AdminBookingV2Detail;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => refundAdminBooking(booking._id, reason.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-booking-detail-v2"] });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-v2"] });
      onDone(`Refund processed for booking ${bkShortId(booking._id)}.`);
      onClose();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message || "Refund failed"),
  });

  return (
    <div className="bk2-modal-overlay" onClick={onClose}>
      <div className="bk2-modal" onClick={(e) => e.stopPropagation()}>
        <div className="bk2-modal-header">
          <strong>Refund booking {bkShortId(booking._id)}</strong>
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
          {error ? (
            <div className="error-state bk2-inline-error">{error}</div>
          ) : null}
          <p className="bk2-modal-text">
            This refunds the full amount the customer paid for this booking (
            {money(booking.finalPrice)}) back to their card through Stripe.
            Tips are not included. The booking status does not change — cancel
            it separately if needed. This cannot be undone.
          </p>
          <label className="bk2-label">Reason (optional)</label>
          <textarea
            className="bk2-input"
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being refunded?"
            rows={3}
            value={reason}
          />
          <label className="bk2-check">
            <input
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              type="checkbox"
            />
            I understand this refunds the customer in full
          </label>
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
            className="bk2-btn-danger"
            disabled={!confirmed || mutation.isPending}
            onClick={() => mutation.mutate()}
            type="button"
          >
            {mutation.isPending ? "Processing..." : "Refund now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail body (panel + full page shared) ───
export function BookingDetailBody({
  bookingId,
  autoPrint,
}: {
  bookingId: string;
  autoPrint?: boolean;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [modal, setModal] = useState<{
    booking: AdminBookingV2;
    action: BookingActionKind;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [noteText, setNoteText] = useState("");
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(
    null
  );
  const [disputeSubject, setDisputeSubject] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [disputePriority, setDisputePriority] = useState("medium");
  const [disputeError, setDisputeError] = useState("");
  const printedRef = useRef(false);
  const user = useMemo(() => getStoredUser(), []);
  const canSeeMoney = user?.role === "admin";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const detailQuery = useQuery({
    queryKey: ["admin-booking-detail-v2", bookingId],
    queryFn: () => getAdminBookingByIdV2(bookingId),
    refetchInterval: (q: any) => {
      const s = q?.state?.data?.status;
      return s && ACTIVE_STATUSES.includes(s) ? 15000 : false;
    },
  });
  const booking = detailQuery.data;

  const notesQuery = useQuery({
    queryKey: ["admin-booking-notes", bookingId],
    queryFn: () => getAdminBookingNotes(bookingId),
    enabled: tab === "notes",
  });

  const disputeQuery = useQuery({
    queryKey: ["admin-booking-dispute", bookingId],
    queryFn: () => getAdminBookingDispute(bookingId),
    enabled: tab === "dispute",
  });

  // Live status updates for this booking
  useEffect(() => {
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    socket.on("admin_booking_status_updated", (payload: any) => {
      if (payload?.bookingId === bookingId || payload?.booking?._id === bookingId) {
        queryClient.invalidateQueries({
          queryKey: ["admin-booking-detail-v2", bookingId],
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [bookingId, queryClient, user?._id]);

  const addNoteMutation = useMutation({
    mutationFn: () => addAdminBookingNote(bookingId, noteText.trim()),
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({
        queryKey: ["admin-booking-notes", bookingId],
      });
      showToast("Note added.");
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.message || "Note could not be added"),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => deleteAdminBookingNote(bookingId, noteId),
    onSuccess: () => {
      setConfirmDeleteNote(null);
      queryClient.invalidateQueries({
        queryKey: ["admin-booking-notes", bookingId],
      });
    },
    onError: (e: any) =>
      showToast(e?.response?.data?.message || "Note could not be deleted"),
  });

  const createDisputeMutation = useMutation({
    mutationFn: () =>
      createAdminBookingDispute(bookingId, {
        subject: disputeSubject.trim() || undefined,
        description: disputeDescription.trim(),
        priority: disputePriority,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-booking-dispute", bookingId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-booking-detail-v2", bookingId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-bookings-v2"] });
      showToast("Dispute created. Manage it in Support & Disputes.");
    },
    onError: (e: any) =>
      setDisputeError(e?.response?.data?.message || "Dispute could not be created"),
  });

  const printSummary = (b: AdminBookingV2Detail) => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
      showToast("Pop-ups are blocked — allow them to print.");
      return;
    }
    const pay = bkPaymentBadge(b);
    win.document.write(`<!doctype html><html><head><title>Booking ${esc(
      bkShortId(b._id)
    )}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}td{padding:8px;border-bottom:1px solid #eee;font-size:13px}td:first-child{color:#666;width:180px}</style></head><body>
      <h1>OWVO Booking ${esc(bkShortId(b._id))}</h1>
      <p>Status: ${esc(BK_STATUS_LABELS[b.status] || b.status)} · Payment: ${esc(pay.label)}</p>
      <table>
      <tr><td>Date &amp; time</td><td>${esc(bkDateTime(b.bookingDate))}</td></tr>
      <tr><td>Customer</td><td>${esc(b.user?.name)} (${esc((b.user as any)?.phoneNumber || "")})</td></tr>
      <tr><td>Provider</td><td>${esc(b.provider?.name)} (${esc((b.provider as any)?.phoneNumber || "")})</td></tr>
      <tr><td>Service</td><td>${esc(b.service?.title)}</td></tr>
      <tr><td>Vehicle</td><td>${esc([b.vehicleSnapshot?.make, b.vehicleSnapshot?.model, b.vehicleSnapshot?.registrationNo].filter(Boolean).join(" "))}</td></tr>
      <tr><td>Address</td><td>${esc(b.address?.addressLine)}</td></tr>
      <tr><td>Total</td><td>${esc(money(b.finalPrice))}</td></tr>
      </table></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  useEffect(() => {
    if (autoPrint && booking && !printedRef.current) {
      printedRef.current = true;
      printSummary(booking);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, booking]);

  if (detailQuery.isLoading) {
    return <div className="empty-state">Loading booking details...</div>;
  }
  if (detailQuery.isError || !booking) {
    return (
      <div className="error-state">
        Could not load this booking. Check your connection and try again.
        <button
          className="booking-filter-reset"
          onClick={() => detailQuery.refetch()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  const pay = bkPaymentBadge(booking);
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "timeline", label: "Timeline" },
    { key: "payment", label: "Payment" },
    { key: "location", label: "Location" },
    { key: "notes", label: "Notes" },
    {
      key: "dispute",
      label: booking.openDispute ? "Dispute ⚠" : "Dispute",
    },
  ];
  const statusActions: Array<{
    status: BookingActionKind;
    label: string;
    icon: typeof CheckCircle2;
  }> = [
    { status: "accepted", label: "Accept", icon: CheckCircle2 },
    { status: "arrived", label: "Arrived", icon: Navigation },
    { status: "ongoing", label: "Start", icon: PlayCircle },
    { status: "completed", label: "Complete", icon: BadgeCheck },
    { status: "cancelled", label: "Cancel", icon: XCircle },
  ];
  const vehicleLine = [
    booking.vehicleSnapshot?.make,
    booking.vehicleSnapshot?.model,
    booking.vehicleSnapshot?.year,
  ]
    .filter(Boolean)
    .join(" ");
  const paidRecord = (booking.payments || []).find(
    (p) => p.type === "booking" && p.paymentStatus === "complete"
  );
  const openDispute = booking.openDispute;
  const dispute = disputeQuery.data?.dispute;

  return (
    <div>
      {/* Header */}
      <div className="bk2-detail-head">
        <div>
          <strong className="bk2-detail-id">{bkShortId(booking._id)}</strong>
          <span className={`table-status ${booking.status}`}>
            {BK_STATUS_LABELS[booking.status] || booking.status}
          </span>
          {openDispute ? (
            <span className="bk2-dispute-badge">
              Open dispute {openDispute.ticketNumber || ""}
            </span>
          ) : null}
          <div className="table-sub">{bkDateTime(booking.bookingDate)}</div>
        </div>
        <div className="bk2-head-actions">
          <button
            className="booking-panel-action-btn"
            onClick={() => printSummary(booking)}
            type="button"
          >
            <Printer size={13} /> Print
          </button>
          <button
            className="booking-panel-action-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/bookings/${booking._id}`
                );
                showToast("Booking link copied.");
              } catch {
                showToast("Could not copy the link.");
              }
            }}
            type="button"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            className="booking-panel-action-btn"
            onClick={() => setChatOpen(true)}
            type="button"
          >
            <MessageSquare size={13} /> Message
          </button>
        </div>
      </div>

      {/* Status actions */}
      <div className="bk2-status-actions">
        {statusActions.map((a) => {
          const Icon = a.icon;
          const allowed = bkCan(booking.status, a.status);
          return (
            <button
              className={`bk2-status-btn ${a.status === "cancelled" ? "danger" : ""}`}
              disabled={!allowed}
              key={a.status}
              onClick={() =>
                setModal({
                  booking: booking as unknown as AdminBookingV2,
                  action: a.status,
                })
              }
              title={
                allowed
                  ? a.label
                  : `Not available for a ${BK_STATUS_LABELS[booking.status] || booking.status} booking`
              }
              type="button"
            >
              <Icon size={13} /> {a.label}
            </button>
          );
        })}
        <button
          className="bk2-status-btn"
          onClick={() =>
            setModal({
              booking: booking as unknown as AdminBookingV2,
              action: "notification",
            })
          }
          type="button"
        >
          <Bell size={13} /> Notify
        </button>
      </div>

      {/* Tabs */}
      <div className="booking-panel-tabs">
        {tabs.map((t) => (
          <button
            className={tab === t.key ? "active" : ""}
            key={t.key}
            onClick={() => setTab(t.key)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bk2-tab-body">
        {tab === "overview" && (
          <>
            <div className="booking-panel-section">
              <h4>Customer</h4>
              <div className="booking-panel-person">
                {(booking.user as any)?.photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="bk2-avatar-img bk2-avatar-lg"
                    src={(booking.user as any).photo.url}
                  />
                ) : (
                  <span className="table-avatar">
                    {(booking.user?.name || "C").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <strong>{booking.user?.name || "Customer"}</strong>
                  <span className="table-sub">
                    {(booking.user as any)?.phoneNumber || "No phone"}
                  </span>
                  <span className="table-sub">{booking.user?.email || ""}</span>
                </div>
                <div className="booking-panel-icons">
                  <button
                    aria-label="Call customer"
                    className="mini-icon-button"
                    onClick={() =>
                      showToast("Calling is coming in the next phase.")
                    }
                    type="button"
                  >
                    <Phone size={15} />
                  </button>
                  <button
                    aria-label="Message"
                    className="mini-icon-button"
                    onClick={() => setChatOpen(true)}
                    type="button"
                  >
                    <MessageSquare size={15} />
                  </button>
                  <a
                    aria-label="Email customer"
                    className="mini-icon-button"
                    href={`mailto:${booking.user?.email || ""}`}
                  >
                    <Mail size={15} />
                  </a>
                </div>
              </div>
              {booking.customerRating ? (
                <p className="bk2-rating-line">
                  Provider rated this customer ⭐{" "}
                  {booking.customerRating.rating}/5
                  {booking.customerRating.review
                    ? ` — “${booking.customerRating.review}”`
                    : ""}
                </p>
              ) : (
                <p className="bk2-rating-line muted">
                  {booking.status === "completed"
                    ? "The provider has not rated this customer yet."
                    : "The provider's rating of this customer will appear after completion."}
                </p>
              )}
            </div>

            <div className="booking-panel-section">
              <h4>Provider</h4>
              <div className="booking-panel-person">
                {(booking.provider as any)?.photo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="bk2-avatar-img bk2-avatar-lg"
                    src={(booking.provider as any).photo.url}
                  />
                ) : (
                  <span className="table-avatar">
                    {(booking.provider?.name || "W").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <strong>{booking.provider?.name || "Provider"}</strong>
                  <span className="table-sub">
                    {(booking.provider as any)?.phoneNumber || "No phone"}
                  </span>
                  <span className="table-sub">
                    {booking.providerStats
                      ? `⭐ ${booking.providerStats.ratingAverage.toFixed(1)} (${booking.providerStats.ratingCount} ratings) · ${booking.providerStats.completedJobs} jobs done`
                      : ""}
                  </span>
                </div>
                <div className="booking-panel-icons">
                  <button
                    aria-label="Call provider"
                    className="mini-icon-button"
                    onClick={() =>
                      showToast("Calling is coming in the next phase.")
                    }
                    type="button"
                  >
                    <Phone size={15} />
                  </button>
                  <button
                    aria-label="Message"
                    className="mini-icon-button"
                    onClick={() => setChatOpen(true)}
                    type="button"
                  >
                    <MessageSquare size={15} />
                  </button>
                  <a
                    aria-label="Email provider"
                    className="mini-icon-button"
                    href={`mailto:${booking.provider?.email || ""}`}
                  >
                    <Mail size={15} />
                  </a>
                </div>
              </div>
              {booking.providerRating ? (
                <p className="bk2-rating-line">
                  Rated by customer ⭐ {booking.providerRating.rating}/5
                  {booking.providerRating.review
                    ? ` — “${booking.providerRating.review}”`
                    : ""}
                </p>
              ) : (
                <p className="bk2-rating-line muted">
                  {booking.status === "completed"
                    ? "Provider has not been rated for this booking yet."
                    : "Provider rating will appear after completion."}
                </p>
              )}
            </div>

            <div className="booking-panel-section">
              <h4>Service</h4>
              <div className="bk2-service-card">
                {booking.vehicleSnapshot?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt="Vehicle"
                    className="bk2-service-img"
                    src={booking.vehicleSnapshot.image}
                  />
                ) : null}
                <div>
                  <strong>{booking.service?.title || "Wash Service"}</strong>
                  <span className="table-sub">
                    Scheduled {bkDateTime(booking.bookingDate)}
                  </span>
                  {booking.estimatedArrival ? (
                    <span className="table-sub">
                      Estimated arrival {bkDateTime(booking.estimatedArrival)}
                    </span>
                  ) : null}
                </div>
                {canSeeMoney ? (
                  <strong className="bk2-service-price">
                    {money(booking.finalPrice)}
                  </strong>
                ) : null}
              </div>
              <div className="bk2-mini-grid">
                <div className="bk2-mini-card">
                  <span>📍 Location</span>
                  <strong>{booking.address?.addressLine || "—"}</strong>
                  <small>{booking.postalCode || ""}</small>
                </div>
                <div className="bk2-mini-card">
                  <span>🚗 Vehicle</span>
                  <strong>{vehicleLine || "Not provided"}</strong>
                  <small>
                    {booking.vehicleSnapshot?.registrationNo || ""}
                    {booking.vehicleSnapshot?.size
                      ? ` · ${booking.vehicleSnapshot.size}`
                      : ""}
                  </small>
                </div>
                <div className="bk2-mini-card">
                  <span>✨ Add-ons</span>
                  {booking.addons && booking.addons.length ? (
                    <div className="bk2-chip-wrap">
                      {booking.addons.map((a, i) => (
                        <span className="bk2-chip" key={i}>
                          {a.name} · {money(a.price)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <strong>No add-ons</strong>
                  )}
                </div>
              </div>
              {booking.notes ? (
                <p className="bk2-rating-line">
                  <strong>Booking notes:</strong> {booking.notes}
                </p>
              ) : null}
            </div>

            {booking.status === "cancelled" ? (
              <div className="booking-panel-section">
                <h4>Cancellation</h4>
                <div className="booking-panel-row">
                  <span>Reason</span>
                  <strong className="bk2-row-value">
                    {booking.cancellationReason || "—"}
                  </strong>
                </div>
                <div className="booking-panel-row">
                  <span>Cancelled by</span>
                  <strong>{booking.cancelledBy || "—"}</strong>
                </div>
                <div className="booking-panel-row">
                  <span>Cancelled at</span>
                  <strong>{bkDateTime(booking.cancelledAt)}</strong>
                </div>
              </div>
            ) : null}

            <div className="booking-panel-section">
              <h4>Payment summary</h4>
              <div className="booking-panel-row">
                <span>Status</span>
                <span className={`bk2-pay ${pay.cls}`}>{pay.label}</span>
              </div>
              {canSeeMoney ? (
                <div className="booking-panel-row">
                  <span>Total</span>
                  <strong>{money(booking.finalPrice)}</strong>
                </div>
              ) : null}
              <button
                className="bk2-link-btn"
                onClick={() => setTab("payment")}
                type="button"
              >
                Open the Payment tab for the full breakdown →
              </button>
            </div>
          </>
        )}

        {tab === "timeline" && (
          <div className="booking-panel-section">
            <h4>Timeline</h4>
            <div className="bk2-timeline">
              {(booking.timeline || []).map((entry, i) => (
                <div className="bk2-timeline-item" key={i}>
                  <span className="bk2-timeline-dot" />
                  <div>
                    <strong>
                      {BK_STATUS_LABELS[entry.status] || entry.status}
                      {entry.by ? ` · by ${entry.by}` : ""}
                    </strong>
                    <span className="table-sub">
                      {entry.at ? bkDateTime(entry.at) : "Time not recorded"}
                    </span>
                    {entry.note ? (
                      <span className="table-sub">“{entry.note}”</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {(booking.timeline || []).some((t) => t.source === "derived") ? (
              <p className="table-sub">
                This booking predates status history — steps without a time
                were never recorded and are not guessed.
              </p>
            ) : null}
          </div>
        )}

        {tab === "payment" && (
          <>
            <div className="booking-panel-section">
              <h4>Price breakdown</h4>
              <div className="booking-panel-row">
                <span>Service</span>
                <strong>{money(booking.price ?? booking.finalPrice)}</strong>
              </div>
              {(booking.addons || []).map((a, i) => (
                <div className="booking-panel-row" key={i}>
                  <span>{a.name || "Add-on"}</span>
                  <strong>{money(a.price)}</strong>
                </div>
              ))}
              {booking.discountPrice ? (
                <div className="booking-panel-row">
                  <span>
                    Discount
                    {typeof booking.coupon === "object" && booking.coupon?.code
                      ? ` (${booking.coupon.code})`
                      : booking.couponCode
                        ? ` (${booking.couponCode})`
                        : ""}
                  </span>
                  <strong>−{money(booking.discountPrice)}</strong>
                </div>
              ) : null}
              <div className="booking-panel-row bk2-total-row">
                <span>Total</span>
                <strong>{money(booking.finalPrice)}</strong>
              </div>
              {booking.tipsTotal ? (
                <div className="booking-panel-row">
                  <span>Tips paid</span>
                  <strong>{money(booking.tipsTotal)}</strong>
                </div>
              ) : null}
            </div>

            <div className="booking-panel-section">
              <h4>Payment information</h4>
              <div className="booking-panel-row">
                <span>Method</span>
                <strong>
                  {booking.payment?.method === "online"
                    ? "Card / Online"
                    : booking.payment?.method || "—"}
                </strong>
              </div>
              <div className="booking-panel-row">
                <span>Status</span>
                <span className={`bk2-pay ${pay.cls}`}>{pay.label}</span>
              </div>
              <div className="booking-panel-row">
                <span>Transaction ID</span>
                <strong className="mono-sm bk2-row-value">
                  {booking.payment?.trxId || paidRecord?.transactionId || "—"}
                </strong>
              </div>
              <div className="booking-panel-row">
                <span>Paid on</span>
                <strong>
                  {paidRecord?.createdAt
                    ? bkDateTime(paidRecord.createdAt)
                    : "—"}
                </strong>
              </div>
              {booking.refund?.status === "refunded" ? (
                <>
                  <div className="booking-panel-row">
                    <span>Refund</span>
                    <strong>
                      {money(booking.refund.amount)} ·{" "}
                      {bkDateTime(booking.refund.at)}
                    </strong>
                  </div>
                  <div className="booking-panel-row">
                    <span>Refund ID</span>
                    <strong className="mono-sm bk2-row-value">
                      {booking.refund.refundId || "—"}
                    </strong>
                  </div>
                  {booking.refund.reason ? (
                    <div className="booking-panel-row">
                      <span>Refund reason</span>
                      <strong className="bk2-row-value">
                        {booking.refund.reason}
                      </strong>
                    </div>
                  ) : null}
                </>
              ) : null}
              {canSeeMoney &&
              booking.payment?.status === "paid" &&
              booking.refund?.status !== "refunded" ? (
                <button
                  className="bk2-btn-danger bk2-refund-btn"
                  onClick={() => setRefundOpen(true)}
                  type="button"
                >
                  Refund this booking
                </button>
              ) : null}
            </div>

            <div className="booking-panel-section">
              <h4>Payment records</h4>
              {(booking.payments || []).length === 0 ? (
                <p className="table-sub">
                  No payment records for this booking.
                </p>
              ) : (
                (booking.payments || []).map((p) => (
                  <div className="booking-panel-row" key={p._id}>
                    <span>
                      {p.type === "tips" ? "Tip" : "Booking payment"} ·{" "}
                      {bkDateTime(p.createdAt)}
                    </span>
                    <strong>
                      {money(p.price)} · {p.paymentStatus || p.status || ""}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "location" && <BookingLocationMap booking={booking} />}

        {tab === "notes" && (
          <div className="booking-panel-section">
            <h4>Admin notes</h4>
            <p className="table-sub">
              Private to the admin team — the customer and provider never see
              these.
            </p>
            <textarea
              className="bk2-input"
              id="bk2-note-input"
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write a note about this booking..."
              rows={3}
              value={noteText}
            />
            <button
              className="booking-create-btn bk2-note-add"
              disabled={!noteText.trim() || addNoteMutation.isPending}
              onClick={() => addNoteMutation.mutate()}
              type="button"
            >
              {addNoteMutation.isPending ? "Adding..." : "Add note"}
            </button>
            <div className="bk2-note-list">
              {notesQuery.isLoading ? (
                <p className="table-sub">Loading notes...</p>
              ) : notesQuery.isError ? (
                <p className="table-sub">
                  Notes could not be loaded.{" "}
                  <button
                    className="bk2-link-btn"
                    onClick={() => notesQuery.refetch()}
                    type="button"
                  >
                    Retry
                  </button>
                </p>
              ) : (notesQuery.data ?? []).length === 0 ? (
                <p className="table-sub">No notes yet for this booking.</p>
              ) : (
                (notesQuery.data ?? []).map((n) => (
                  <div className="bk2-note" key={n._id}>
                    <div className="bk2-note-head">
                      <strong>{n.authorName || "Admin"}</strong>
                      <span className="table-sub">{bkDateTime(n.createdAt)}</span>
                      {confirmDeleteNote === n._id ? (
                        <>
                          <button
                            className="bk2-link-btn bk2-danger-text"
                            onClick={() => deleteNoteMutation.mutate(n._id)}
                            type="button"
                          >
                            Confirm delete
                          </button>
                          <button
                            className="bk2-link-btn"
                            onClick={() => setConfirmDeleteNote(null)}
                            type="button"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          aria-label="Delete note"
                          className="bk2-note-delete"
                          onClick={() => setConfirmDeleteNote(n._id)}
                          type="button"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p>{n.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "dispute" && (
          <div className="booking-panel-section">
            <h4>Dispute</h4>
            {disputeQuery.isLoading ? (
              <p className="table-sub">Loading dispute...</p>
            ) : disputeQuery.isError ? (
              <p className="table-sub">
                Dispute could not be loaded.{" "}
                <button
                  className="bk2-link-btn"
                  onClick={() => disputeQuery.refetch()}
                  type="button"
                >
                  Retry
                </button>
              </p>
            ) : dispute ? (
              <div className="bk2-dispute-card">
                <div className="booking-panel-row">
                  <span>Ticket</span>
                  <strong>{dispute.ticketNumber || "—"}</strong>
                </div>
                <div className="booking-panel-row">
                  <span>Subject</span>
                  <strong className="bk2-row-value">{dispute.subject}</strong>
                </div>
                <div className="booking-panel-row">
                  <span>Status</span>
                  <strong>{dispute.status}</strong>
                </div>
                <div className="booking-panel-row">
                  <span>Priority</span>
                  <strong>{dispute.priority}</strong>
                </div>
                <div className="booking-panel-row">
                  <span>Opened</span>
                  <strong>{bkDateTime(dispute.createdAt)}</strong>
                </div>
                <p className="bk2-modal-text">{dispute.description}</p>
                <a className="bk2-link-btn" href="/support-disputes">
                  Manage this dispute in Support &amp; Disputes →
                </a>
              </div>
            ) : (
              <>
                <p className="table-sub">
                  No dispute has been raised for this booking. Creating one
                  opens a ticket in Support &amp; Disputes, linked to this
                  booking.
                </p>
                {disputeError ? (
                  <div className="error-state bk2-inline-error">
                    {disputeError}
                  </div>
                ) : null}
                <label className="bk2-label">Subject</label>
                <input
                  className="bk2-input"
                  onChange={(e) => setDisputeSubject(e.target.value)}
                  placeholder={`Dispute for booking ${bkShortId(booking._id)}`}
                  value={disputeSubject}
                />
                <label className="bk2-label">Description *</label>
                <textarea
                  className="bk2-input"
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="What is the dispute about?"
                  rows={4}
                  value={disputeDescription}
                />
                <label className="bk2-label">Priority</label>
                <select
                  className="bk2-input"
                  onChange={(e) => setDisputePriority(e.target.value)}
                  value={disputePriority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  className="booking-create-btn bk2-note-add"
                  disabled={
                    !disputeDescription.trim() || createDisputeMutation.isPending
                  }
                  onClick={() => {
                    setDisputeError("");
                    createDisputeMutation.mutate();
                  }}
                  type="button"
                >
                  {createDisputeMutation.isPending
                    ? "Creating..."
                    : "Create dispute"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="booking-panel-footer">
        <button
          className="booking-create-btn"
          onClick={() => setChatOpen(true)}
          type="button"
        >
          Send Message
        </button>
        <button
          className="booking-export-btn"
          onClick={() => {
            setTab("notes");
            setTimeout(
              () => document.getElementById("bk2-note-input")?.focus(),
              60
            );
          }}
          type="button"
        >
          Add Note
        </button>
        <button
          className="booking-export-btn"
          onClick={() => setTab("dispute")}
          type="button"
        >
          {booking.openDispute ? "View Dispute" : "Create Dispute"}
        </button>
      </div>

      {chatOpen && (
        <BookingChatDrawer
          booking={booking}
          onClose={() => setChatOpen(false)}
          showToast={showToast}
        />
      )}
      {refundOpen && (
        <RefundModal
          booking={booking}
          onClose={() => setRefundOpen(false)}
          onDone={(msg) => showToast(msg)}
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
    </div>
  );
}

// ─── Slide-in panel (bookings list se khulta hai) ───
export function BookingDetailPanel({
  bookingId,
  onClose,
}: {
  bookingId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (bookingId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bookingId, onClose]);

  if (!bookingId) return null;

  return (
    <div className="booking-panel-overlay" onClick={onClose}>
      <div
        className="booking-panel bk2-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="booking-panel-header">
          <strong>Booking Details</strong>
          <button
            aria-label="Close panel"
            className="mini-icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        <div className="booking-panel-body">
          <BookingDetailBody bookingId={bookingId} />
        </div>
      </div>
    </div>
  );
}
