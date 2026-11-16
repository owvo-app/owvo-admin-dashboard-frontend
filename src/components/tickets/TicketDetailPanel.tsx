"use client";

import {
  adminReplyToTicketWithFile,
  getAdminTicketFull,
  getTicketAssignees,
  resolveTicketOutcome,
  updateAdminTicket,
  type SupportTicketFull,
} from "@/lib/admin-api";
import { getStoredUser } from "@/lib/auth-storage";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Mail, MessageSquare, Paperclip, Phone, X } from "lucide-react";
import { useRef, useState } from "react";

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

const outcomeLabels: Record<string, string> = {
  refund_full: "Full refund to customer",
  refund_partial: "Partial refund to customer",
  release_provider: "Release to provider (no refund)",
  split: "Split — part refunded, the rest stays with the provider",
  no_action: "No money action",
};

const sourceLabels: Record<string, string> = {
  app: "Support (app)",
  admin: "Created by admin",
  report: "Booking — Report an Issue",
};

function serverMessage(error: unknown) {
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e?.response?.data?.message || e?.message || "Something went wrong. Please try again.";
}

function fileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [replyError, setReplyError] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [outcome, setOutcome] = useState("refund_full");
  const [outcomeAmount, setOutcomeAmount] = useState("");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [outcomeError, setOutcomeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUser = getStoredUser();
  const isAdmin = currentUser?.role === "admin";

  const detailQuery = useQuery({
    queryKey: ["admin-ticket-detail", ticketId],
    queryFn: () => getAdminTicketFull(ticketId!),
    enabled: !!ticketId,
  });

  const assigneesQuery = useQuery({
    queryKey: ["ticket-assignees"],
    queryFn: () => getTicketAssignees(),
    enabled: !!ticketId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["admin-ticket-detail", ticketId] });
  };

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateAdminTicket>[1]) =>
      updateAdminTicket(ticketId!, data),
    onSuccess: invalidate,
  });

  const replyMutation = useMutation({
    mutationFn: () => adminReplyToTicketWithFile(ticketId!, replyText.trim(), replyFile),
    onSuccess: () => {
      setReplyText("");
      setReplyFile(null);
      setReplyError("");
      invalidate();
    },
    onError: (e) => setReplyError(serverMessage(e)),
  });

  const outcomeMutation = useMutation({
    mutationFn: () =>
      resolveTicketOutcome(ticketId!, {
        outcome,
        amount:
          outcome === "refund_partial" || outcome === "split"
            ? Number(outcomeAmount)
            : undefined,
        note: outcomeNote.trim() || undefined,
      }),
    onSuccess: () => {
      setOutcomeError("");
      invalidate();
    },
    onError: (e) => setOutcomeError(serverMessage(e)),
  });

  if (!ticketId) return null;

  const ticket = detailQuery.data as SupportTicketFull | undefined;
  const tabs = ["Details", "Messages", "Booking", "Resolution"];

  const needsOutcome =
    !!ticket &&
    (ticket.type === "dispute" || ticket.type === "refund") &&
    !!ticket.booking &&
    !ticket.resolutionOutcome?.type;
  const isFinished = ticket?.status === "resolved" || ticket?.status === "closed";
  const outcomeFormVisible = needsOutcome && !isFinished;

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
          {detailQuery.isError && (
            <div className="error-state">
              Couldn&apos;t load this ticket. Check your connection and try again.
              <button className="booking-filter-reset" style={{ marginLeft: 10 }} onClick={() => detailQuery.refetch()} type="button">
                Retry
              </button>
            </div>
          )}

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
                <div className="booking-panel-row">
                  <span>Source</span>
                  <strong>{sourceLabels[ticket.source || "app"] || "Support (app)"}</strong>
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
                    {m.text ? <p>{m.text}</p> : null}
                    {m.attachment?.url && m.attachment.type === "image" && (
                      <a href={m.attachment.url} target="_blank" rel="noreferrer">
                        <img className="sup-msg-image" src={m.attachment.url} alt={m.attachment.name || "Attachment"} />
                      </a>
                    )}
                    {m.attachment?.url && m.attachment.type !== "image" && (
                      <a className="sup-msg-file" href={m.attachment.url} target="_blank" rel="noreferrer">
                        📎 {m.attachment.name || "Attachment"}
                        {m.attachment.size ? ` (${fileSize(m.attachment.size)})` : ""}
                      </a>
                    )}
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
                {replyFile && (
                  <div className="sup-file-chip">
                    <span>📎 {replyFile.name} ({fileSize(replyFile.size)})</span>
                    <button type="button" onClick={() => setReplyFile(null)}>Remove</button>
                  </div>
                )}
                {replyError && <div className="error-state" style={{ marginTop: 8 }}>{replyError}</div>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  style={{ display: "none" }}
                  onChange={(e) => setReplyFile(e.target.files?.[0] || null)}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    className="booking-filter-reset"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    title="Attach an image or PDF (max 12MB)"
                  >
                    <Paperclip size={15} /> Attach
                  </button>
                  <button
                    className="booking-create-btn"
                    style={{ flex: 1 }}
                    onClick={() => (replyText.trim() || replyFile) && replyMutation.mutate()}
                    disabled={replyMutation.isPending || (!replyText.trim() && !replyFile)}
                    type="button"
                  >
                    {replyMutation.isPending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
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
                  {typeof ticket.booking.finalPrice === "number" && (
                    <div className="booking-panel-row"><span>Amount</span><strong>£{ticket.booking.finalPrice.toFixed(2)}</strong></div>
                  )}
                  <button
                    className="booking-create-btn"
                    style={{ marginTop: 12, width: "100%" }}
                    onClick={() => { window.location.href = `/bookings?booking=${ticket.booking!._id}`; }}
                    type="button"
                  >
                    Open Booking
                  </button>
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

              {ticket.resolutionOutcome?.type ? (
                <div className="sup-outcome-box">
                  <div className="booking-panel-row">
                    <span>Outcome</span>
                    <strong>{outcomeLabels[ticket.resolutionOutcome.type] || ticket.resolutionOutcome.type}</strong>
                  </div>
                  {(ticket.resolutionOutcome.amount || 0) > 0 && (
                    <div className="booking-panel-row">
                      <span>Refunded</span>
                      <strong>£{(ticket.resolutionOutcome.amount || 0).toFixed(2)}</strong>
                    </div>
                  )}
                  {ticket.resolutionOutcome.decidedBy?.name && (
                    <div className="booking-panel-row">
                      <span>Decided by</span>
                      <strong>{ticket.resolutionOutcome.decidedBy.name}</strong>
                    </div>
                  )}
                  {ticket.resolutionOutcome.decidedAt && (
                    <div className="booking-panel-row">
                      <span>Decided</span>
                      <strong>{format(new Date(ticket.resolutionOutcome.decidedAt), "dd MMM yyyy, hh:mm a")}</strong>
                    </div>
                  )}
                  {ticket.resolutionOutcome.note && (
                    <p className="ticket-desc">{ticket.resolutionOutcome.note}</p>
                  )}
                </div>
              ) : outcomeFormVisible ? (
                <div className="sup-outcome-box">
                  <p className="table-sub" style={{ marginBottom: 10 }}>
                    This {ticket.type} is linked to a booking, so it needs a money
                    outcome to finish. The refund runs through Payments &amp; Refunds —
                    the provider&apos;s held earnings are settled by the outcome.
                  </p>
                  <label className="modal-label">Outcome</label>
                  <select className="modal-input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                    <option value="refund_full">Full refund to customer</option>
                    <option value="refund_partial">Partial refund to customer</option>
                    <option value="split">Split — part refunded, rest to provider</option>
                    <option value="release_provider">Release to provider (no refund)</option>
                    <option value="no_action">No money action</option>
                  </select>
                  {(outcome === "refund_partial" || outcome === "split") && (
                    <>
                      <label className="modal-label" style={{ marginTop: 10 }}>Refund amount (£)</label>
                      <input
                        className="modal-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={outcomeAmount}
                        onChange={(e) => setOutcomeAmount(e.target.value)}
                        placeholder="e.g. 10.00"
                      />
                    </>
                  )}
                  {!isAdmin && (
                    <p className="table-sub" style={{ marginTop: 8 }}>
                      Refunds above £50 need an admin to decide.
                    </p>
                  )}
                  <label className="modal-label" style={{ marginTop: 10 }}>Note for the customer (optional)</label>
                  <textarea
                    className="modal-input"
                    value={outcomeNote}
                    onChange={(e) => setOutcomeNote(e.target.value)}
                    rows={2}
                    placeholder="Shown as the resolution note"
                  />
                  {outcomeError && <div className="error-state" style={{ marginTop: 8 }}>{outcomeError}</div>}
                  <button
                    className="booking-create-btn"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => outcomeMutation.mutate()}
                    disabled={
                      outcomeMutation.isPending ||
                      ((outcome === "refund_partial" || outcome === "split") &&
                        !(Number(outcomeAmount) > 0))
                    }
                    type="button"
                  >
                    {outcomeMutation.isPending ? "Saving..." : "Decide & Resolve Ticket"}
                  </button>
                </div>
              ) : (
                <>
                  {ticket.resolutionNote && <p className="ticket-desc">{ticket.resolutionNote}</p>}
                  {!ticket.resolutionNote && (
                    <p className="table-sub">No resolution recorded yet.</p>
                  )}
                </>
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
            <option value="resolved" disabled={needsOutcome && !isFinished}>
              Resolved{needsOutcome && !isFinished ? " (needs outcome)" : ""}
            </option>
            <option value="closed" disabled={needsOutcome && !isFinished}>
              Closed{needsOutcome && !isFinished ? " (needs outcome)" : ""}
            </option>
          </select>
          <select
            className="booking-filter-select"
            style={{ flex: 1 }}
            value={ticket?.assignedTo?._id || ""}
            onChange={(e) =>
              updateMutation.mutate({ assignedTo: e.target.value || null })
            }
            disabled={updateMutation.isPending || assigneesQuery.isLoading}
            title="Assign this ticket"
          >
            <option value="">Unassigned</option>
            {(assigneesQuery.data ?? []).map((a) => (
              <option key={a._id} value={a._id}>
                {a.name || a.email || "Staff"}{a.role ? ` (${a.role})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
