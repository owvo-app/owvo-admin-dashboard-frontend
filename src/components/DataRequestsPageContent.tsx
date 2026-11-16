"use client";

import {
  downloadDataRequestExport,
  getAdminDataRequestsPaged,
  updateAdminDataRequest,
  type AdminDataRequestFull,
  type DataRequestUser,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { getStoredUser } from "@/lib/auth-storage";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  Loader2,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { downloadBlob } from "./reports/repShared";

/* ------------------------------------------------------------------ */
/* Data Requests (GDPR) — subject access requests with approval-       */
/* controlled exports, a 30-day due date per request, and a record of  */
/* every self-service account deletion.                                */
/* ------------------------------------------------------------------ */

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export function personName(user?: DataRequestUser | null) {
  return user?.fullName || user?.name || user?.email || "Deleted account";
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy, HH:mm");
}

function shortId(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

function statusLabel(status: string) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

type DueInfo = { label: string; cls: string } | null;

function dueInfo(request: AdminDataRequestFull): DueInfo {
  if (request.status !== "pending" || !request.dueAt) return null;
  const due = new Date(request.dueAt).getTime();
  if (Number.isNaN(due)) return null;
  const days = Math.ceil((due - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: `Overdue by ${Math.abs(days)}d`, cls: "overdue" };
  if (days === 0) return { label: "Due today", cls: "soon" };
  if (days <= 7) return { label: `Due in ${days}d`, cls: "soon" };
  return { label: `Due in ${days}d`, cls: "" };
}

function exportCount(data: unknown, key: string) {
  if (!data || typeof data !== "object") return 0;
  const value = (data as Record<string, unknown>)[key];
  return Array.isArray(value) ? value.length : 0;
}

function errorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return maybe?.response?.data?.message || maybe?.message || fallback;
}

export function DataRequestsPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminDataRequestFull | null>(null);

  const requestsQuery = useQuery({
    queryKey: ["admin-data-requests", status, search, page],
    queryFn: () =>
      getAdminDataRequestsPaged({
        status,
        search: search.trim() || undefined,
        page,
        limit: 20,
      }),
    retry: false,
  });

  // Live: a new request or a decision made elsewhere refreshes the list.
  useEffect(() => {
    const user = getStoredUser();
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["admin-data-requests"] });
    socket.on("admin_data_request_created", refresh);
    socket.on("admin_data_request_updated", refresh);
    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const data = requestsQuery.data;
  const counts = data?.statusCounts;
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const cards = [
    { label: "Total Requests", value: counts?.total ?? 0, icon: Database, cls: "blue" },
    { label: "Pending", value: counts?.pending ?? 0, icon: Clock3, cls: "orange" },
    { label: "Overdue", value: counts?.overdue ?? 0, icon: AlertTriangle, cls: "red" },
    { label: "Approved", value: counts?.approved ?? 0, icon: CheckCircle2, cls: "green" },
    { label: "Rejected", value: counts?.rejected ?? 0, icon: XCircle, cls: "red" },
  ];

  return (
    <div className="data-page" data-page>
      <div className="data-page-header" data-page-header>
        <div>
          <h1 className="page-title">Data Requests</h1>
          <p className="page-subtitle">
            Subject access requests from customers and providers, with
            approval-controlled exports. UK GDPR: each request must be answered
            within 30 days.
          </p>
        </div>
      </div>

      <div className="dash-stats">
        {cards.map((card) => (
          <div className="dash-stat-card" key={card.label}>
            <span className={`dash-stat-icon ${card.cls}`}>
              <card.icon size={20} />
            </span>
            <div>
              <p>{card.label}</p>
              <strong>{card.value.toLocaleString("en-GB")}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="booking-filters">
        <input
          className="booking-search"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search by requester name or email"
          type="search"
          value={search}
        />
        <div className="filter-pills">
          {STATUS_TABS.map((tab) => (
            <button
              className={status === tab.key ? "filter-pill active" : "filter-pill"}
              key={tab.key}
              onClick={() => {
                setStatus(tab.key);
                setPage(1);
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          className="booking-filter-reset"
          onClick={() => {
            setSearch("");
            setStatus("all");
            setPage(1);
          }}
          type="button"
        >
          Reset
        </button>
      </div>

      <div className="table-card prov-table-card">
        {requestsQuery.isLoading ? (
          <div className="empty-state">
            <Loader2 size={22} /> Loading data requests...
          </div>
        ) : requestsQuery.isError ? (
          <div className="error-state">
            We could not load data requests. Please check your internet
            connection and try again.
            <button
              className="booking-filter-reset"
              onClick={() => requestsQuery.refetch()}
              style={{ marginLeft: 10 }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            {search || status !== "all"
              ? "No data requests match this search."
              : "No data requests yet. When a customer or provider asks for a copy of their data in the app, it will appear here."}
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Requester</th>
                <th>Role</th>
                <th>Submitted</th>
                <th>Due</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {items.map((request) => {
                const due = dueInfo(request);
                return (
                  <tr
                    className={selected?._id === request._id ? "is-selected" : ""}
                    key={request._id}
                  >
                    <td>
                      <strong>{shortId(request._id)}</strong>{" "}
                      <span
                        className={
                          request.requestType === "deletion"
                            ? "dr-type-badge deletion"
                            : "dr-type-badge"
                        }
                      >
                        {request.requestType === "deletion" ? "Deletion" : "Export"}
                      </span>
                    </td>
                    <td>
                      <strong>{personName(request.user)}</strong>
                      <br />
                      <span className="muted">{request.user?.email || "—"}</span>
                    </td>
                    <td>
                      {request.requesterRole === "provider" ? "Provider" : "Customer"}
                    </td>
                    <td>{fmtDate(request.createdAt)}</td>
                    <td>
                      {due ? (
                        <span className={`dr-due-chip ${due.cls}`}>{due.label}</span>
                      ) : request.status === "pending" ? (
                        "—"
                      ) : (
                        fmtDate(request.reviewedAt)
                      )}
                    </td>
                    <td>
                      <span className={`table-status ${request.status}`}>
                        {statusLabel(request.status)}
                      </span>
                    </td>
                    <td>
                      <button
                        className="dr-view-btn"
                        onClick={() => setSelected(request)}
                        type="button"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.total > 0 ? (
        <div className="sup-pagination">
          <span>
            Showing {(data.page - 1) * data.limit + 1}–
            {Math.min(data.page * data.limit, data.total)} of {data.total}{" "}
            requests
          </span>
          <div className="sup-pagination-buttons">
            <button
              className="booking-filter-reset"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {data.page} of {totalPages}
            </span>
            <button
              className="booking-filter-reset"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <DataRequestPanel
          key={selected._id}
          onClose={() => setSelected(null)}
          onUpdated={(updated) => {
            setSelected(updated);
            queryClient.invalidateQueries({ queryKey: ["admin-data-requests"] });
          }}
          request={selected}
        />
      ) : null}
    </div>
  );
}

function DataRequestPanel({
  request,
  onClose,
  onUpdated,
}: {
  request: AdminDataRequestFull;
  onClose: () => void;
  onUpdated: (request: AdminDataRequestFull) => void;
}) {
  const me = getStoredUser();
  const canReview = me?.role === "admin";
  const [adminNote, setAdminNote] = useState(request.adminNote || "");
  const [actionError, setActionError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const isDeletion = request.requestType === "deletion";
  const due = dueInfo(request);
  const exportData = request.exportData as Record<string, unknown> | undefined;

  const reviewMutation = useMutation({
    mutationFn: (decision: "approved" | "rejected") =>
      updateAdminDataRequest(request._id, {
        status: decision,
        adminNote: adminNote.trim() || undefined,
      }),
    onSuccess: (updated) => {
      setActionError("");
      onUpdated(updated as AdminDataRequestFull);
    },
    onError: (error) =>
      setActionError(
        errorMessage(error, "Could not save the decision. Please try again.")
      ),
  });

  const handleDownload = async () => {
    setDownloading(true);
    setActionError("");
    try {
      const blob = await downloadDataRequestExport(request._id);
      downloadBlob(blob, `owvo-data-export-${request._id.slice(-6).toUpperCase()}.json`);
    } catch (error) {
      setActionError(
        errorMessage(error, "Could not download the export. Please try again.")
      );
    } finally {
      setDownloading(false);
    }
  };

  const summaryItems = exportData
    ? [
        { label: "Vehicles", value: exportCount(exportData, "vehicles") },
        { label: "Bookings", value: exportCount(exportData, "bookings") },
        { label: "Payments", value: exportCount(exportData, "payments") },
        { label: "Reports", value: exportCount(exportData, "reports") },
        { label: "Messages", value: exportCount(exportData, "chatMessages") },
        { label: "Receipts", value: exportCount(exportData, "receipts") },
      ]
    : [];

  return (
    <div className="dr-panel-overlay" onClick={onClose} role="presentation">
      <aside
        className="dr-panel"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dr-panel-header">
          <div>
            <h2>
              Request {shortId(request._id)}{" "}
              <span
                className={
                  isDeletion ? "dr-type-badge deletion" : "dr-type-badge"
                }
              >
                {isDeletion ? "Deletion" : "Export"}
              </span>
            </h2>
            <p className="muted">
              {personName(request.user)} requested this on{" "}
              {fmtDate(request.createdAt)}
            </p>
          </div>
          <button
            aria-label="Close"
            className="dr-close-btn"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="dr-panel-body">
          <div>
            <p className="dr-section-title">Requester</p>
            <dl className="dr-kv">
              <dt>Name</dt>
              <dd>{personName(request.user)}</dd>
              <dt>Email</dt>
              <dd>{request.user?.email || "—"}</dd>
              <dt>Phone</dt>
              <dd>{request.user?.phoneNumber || "—"}</dd>
              <dt>Role</dt>
              <dd>
                {request.requesterRole === "provider" ? "Provider" : "Customer"}
              </dd>
              <dt>Account</dt>
              <dd>{request.user?.accountStatus || "active"}</dd>
            </dl>
          </div>

          <div>
            <p className="dr-section-title">Request</p>
            <dl className="dr-kv">
              <dt>Status</dt>
              <dd>
                <span className={`table-status ${request.status}`}>
                  {statusLabel(request.status)}
                </span>
              </dd>
              <dt>Submitted</dt>
              <dd>{fmtDate(request.createdAt)}</dd>
              {request.status === "pending" ? (
                <>
                  <dt>Due date</dt>
                  <dd>
                    {fmtDate(request.dueAt)}{" "}
                    {due ? (
                      <span className={`dr-due-chip ${due.cls}`}>{due.label}</span>
                    ) : null}
                  </dd>
                </>
              ) : (
                <>
                  <dt>Reviewed</dt>
                  <dd>{fmtDate(request.reviewedAt)}</dd>
                  <dt>Reviewed by</dt>
                  <dd>
                    {request.reviewedBy
                      ? personName(request.reviewedBy)
                      : "—"}
                  </dd>
                </>
              )}
              <dt>Request note</dt>
              <dd>{request.requestNote || "—"}</dd>
            </dl>
          </div>

          {isDeletion ? (
            <div className="dr-info-box">
              This is a record of a self-service account deletion completed in
              the app. The account has already been anonymised, so there is no
              export to review and this record cannot be approved or rejected.
            </div>
          ) : (
            <div>
              <p className="dr-section-title">
                {request.status === "approved"
                  ? "Approved Data Export"
                  : "Requested Data Preview"}
              </p>
              {exportData ? (
                <>
                  <div className="dr-summary-grid">
                    {summaryItems.map((item) => (
                      <div className="dr-summary-item" key={item.label}>
                        <strong>{item.value}</strong>
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <p className="muted" style={{ marginTop: 8 }}>
                    Generated {fmtDate(request.exportGeneratedAt)}. The
                    requester can only see this data in the app after the
                    request is approved.
                  </p>
                  {typeof exportData.retentionPolicy === "string" ? (
                    <div className="dr-info-box" style={{ marginTop: 8 }}>
                      {exportData.retentionPolicy}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="muted">
                  {request.status === "rejected"
                    ? "This request was rejected, so its export data was removed."
                    : "No export data is available for this request."}
                </p>
              )}
            </div>
          )}

          {!isDeletion ? (
            <div>
              <p className="dr-section-title">Admin note</p>
              <textarea
                className="modal-input"
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Optional note for the request record"
                rows={3}
                value={adminNote}
              />
            </div>
          ) : null}

          {actionError ? (
            <p className="dr-error">{actionError}</p>
          ) : null}
        </div>

        {!isDeletion ? (
          <div className="dr-panel-footer">
            {request.status === "approved" ? (
              <button
                className="booking-create-btn"
                disabled={downloading}
                onClick={handleDownload}
                type="button"
              >
                {downloading ? (
                  <Loader2 size={16} />
                ) : (
                  <Download size={16} />
                )}
                Download Export (JSON)
              </button>
            ) : null}
            {request.status === "pending" ? (
              <>
                <button
                  className="booking-filter-reset"
                  disabled={!canReview || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate("rejected")}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className="booking-create-btn"
                  disabled={!canReview || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate("approved")}
                  type="button"
                >
                  {reviewMutation.isPending ? (
                    <Loader2 size={16} />
                  ) : null}
                  Approve
                </button>
              </>
            ) : (
              <span className="muted">
                Decision recorded
                {request.reviewedBy
                  ? ` by ${personName(request.reviewedBy)}`
                  : ""}
                .
              </span>
            )}
            {!canReview ? (
              <span className="muted">
                Only admins can approve or reject data requests.
              </span>
            ) : null}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
