"use client";

import {
  adminReplyToTicket,
  getAdminTicketById,
  updateAdminTicket,
  type SupportTicket,
} from "@/lib/admin-api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, MessageSquare, Phone, X } from "lucide-react";
import { useState } from "react";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const typeLabels: Record<string, string> = {
  complaint: "Complaint",
  refund: "Refund",
  dispute: "Dispute",
  technical: "Technical",
  cancellation: "Cancellation",
  payment: "Payment",
};

export function TicketDetailPanel({
  ticketId,
  onClose,
}: {
  ticketId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("details");
  const [replyText, setReplyText] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-ticket-detail", ticketId],
    queryFn: () => getAdminTicketById(ticketId!),
    enabled: !!ticketId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateAdminTicket>[1]) =>
      updateAdminTicket(ticketId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", ticketId] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (text: string) => adminReplyToTicket(ticketId!, text),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", ticketId] });
    },
  });

  if (!ticketId) return null;

  const ticket = detailQuery.data as SupportTicket | undefined;
  const tabs = ["Details", "Messages", "Booking", "Resolution"];

  const handleSaveNotes = () => {
    updateMutation.mutate({ adminNotes });
  };

  return (
    <div className="booking-panel-overlay" onClick={onClose}>
      <div className="booking-panel" onClick={(e) => e.stopPropagation()}>
        <div className="booking-panel-header">
          <div>
            <strong>#{ticket?.ticketNumber || "..."}</strong>
            <span className={`ticket-status ${ticket?.status || ""}`}>
              {statusLabels[ticket?.status || ""] || ticket?.status}
            </span>
          </div>
          <button className="mini-icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        {ticket?.createdAt && (
          <p className="booking-panel-date">
            Created {format(new Date(ticket.createdAt), "dd MMM yyyy, hh:mm a")}
          </p>
        )}

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
          {detailQuery.isError && <p className="error-state">Could not load ticket.</p>}

          {ticket && tab === "details" && (
            <>
              <div className="booking-panel-section">
                <h4>Subject</h4>
                <p style={{ margin: "0 0 12px", fontWeight: 600 }}>{ticket.subject}</p>
                <h4>Description</h4>
                <p className="ticket-desc">{ticket.description}</p>
              </div>

              <div className="booking-panel-section">
                <div className="booking-panel-person">
                  <span className="table-avatar">{(ticket.reporter?.name || "U").slice(0, 1)}</span>
                  <div>
                    <strong>{ticket.reporter?.name || "Unknown"}</strong>
                    <span className="table-sub">{(ticket.reporter as any)?.phoneNumber || ticket.reporter?.email || ""}</span>
                    <span className="table-sub" style={{ textTransform: "capitalize" }}>{ticket.reporterRole}</span>
                  </div>
                  <div className="booking-panel-icons">
                    <Phone size={16} /> <MessageSquare size={16} /> <Mail size={16} />
                  </div>
                </div>
              </div>

              {ticket.booking && (
                <div className="booking-panel-section">
                  <h4>Related Booking</h4>
                  <div className="booking-panel-row">
                    <span>Booking</span>
                    <strong>#{ticket.booking._id.slice(-6).toUpperCase()}</strong>
                  </div>
                  {ticket.booking.bookingDate && (
                    <div className="booking-panel-row">
                      <span>Date</span>
                      <strong>{format(new Date(ticket.booking.bookingDate), "dd MMM yyyy")}</strong>
                    </div>
                  )}
                </div>
              )}

              <div className="booking-panel-section">
                <div className="booking-panel-row"><span>Category</span><strong>{typeLabels[ticket.type] || ticket.type}</strong></div>
                <div className="booking-panel-row">
                  <span>Priority</span>
                  <span className={`ticket-priority ${ticket.priority}`}>{ticket.priority}</span>
                </div>
                {ticket.assignedTo && (
                  <div className="booking-panel-row"><span>Assigned to</span><strong>{ticket.assignedTo.name}</strong></div>
                )}
              </div>

              <div className="booking-panel-section">
                <h4>Admin Notes</h4>
                <textarea
                  className="modal-input"
                  placeholder="Add internal notes..."
                  value={adminNotes || ticket.adminNotes || ""}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
                <button
                  className="booking-filter-reset"
                  style={{ marginTop: 8 }}
                  onClick={handleSaveNotes}
                  disabled={updateMutation.isPending}
                  type="button"
                >
                  Save Notes
                </button>
              </div>
            </>
          )}

          {ticket && tab === "messages" && (
            <div className="booking-panel-section">
              <h4>Messages</h4>
              <div className="ticket-messages">
                {(ticket.messages || []).map((m, i) => (
                  <div key={i} className={`ticket-msg ${m.senderRole === "admin" || m.senderRole === "staff" ? "admin" : "user"}`}>
                    <div className="ticket-msg-head">
                      <strong>{m.sender?.name || m.senderRole}</strong>
                      <span>{m.createdAt ? formatDistanceToNow(new Date(m.createdAt), { addSuffix: true }) : ""}</span>
                    </div>
                    <p>{m.text}</p>
                  </div>
                ))}
                {(!ticket.messages || ticket.messages.length === 0) && (
                  <p className="table-sub">No messages yet.</p>
                )}
              </div>
              <div className="ticket-reply">
                <textarea
                  className="modal-input"
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={3}
                />
                <button
                  className="booking-create-btn"
                  style={{ marginTop: 8, width: "100%" }}
                  onClick={() => replyText.trim() && replyMutation.mutate(replyText.trim())}
                  disabled={replyMutation.isPending || !replyText.trim()}
                  type="button"
                >
                  {replyMutation.isPending ? "Sending..." : "Send Reply"}
                </button>
              </div>
            </div>
          )}

          {ticket && tab === "booking" && (
            <div className="booking-panel-section">
              <h4>Booking Details</h4>
              {ticket.booking ? (
                <>
                  <div className="booking-panel-row"><span>Booking ID</span><strong>#{ticket.booking._id.slice(-6).toUpperCase()}</strong></div>
                  <div className="booking-panel-row"><span>Status</span><strong>{ticket.booking.status}</strong></div>
                  {ticket.booking.bookingDate && (
                    <div className="booking-panel-row"><span>Date</span><strong>{format(new Date(ticket.booking.bookingDate), "dd MMM yyyy, hh:mm a")}</strong></div>
                  )}
                </>
              ) : (
                <p className="table-sub">No booking linked to this ticket.</p>
              )}
            </div>
          )}

          {ticket && tab === "resolution" && (
            <div className="booking-panel-section">
              <h4>Resolution</h4>
              <div className="booking-panel-row"><span>Status</span><strong>{statusLabels[ticket.status]}</strong></div>
              {ticket.resolutionNote && (
                <p className="ticket-desc">{ticket.resolutionNote}</p>
              )}
              {ticket.resolvedAt && (
                <div className="booking-panel-row">
                  <span>Resolved</span>
                  <strong>{format(new Date(ticket.resolvedAt), "dd MMM yyyy, hh:mm a")}</strong>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="booking-panel-footer" style={{ paddingBottom: 60 }}>
          <select
            className="booking-filter-select"
            style={{ flex: 1 }}
            value={ticket?.status || ""}
            onChange={(e) => updateMutation.mutate({ status: e.target.value })}
            disabled={updateMutation.isPending}
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button
            className="booking-create-btn"
            type="button"
            style={{ flex: 1, padding: "10px 12px" }}
            onClick={() => alert("Staff assignment coming soon")}
          >
            Assign to Staff
          </button>
        </div>
      </div>
    </div>
  );
}
