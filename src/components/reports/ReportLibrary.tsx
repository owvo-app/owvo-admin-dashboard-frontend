"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAnalyticsReport,
  downloadAnalyticsReport,
  duplicateAnalyticsReport,
  generateAnalyticsReport,
  getAdminServicesPricing,
  getWashers,
  listAnalyticsReports,
  previewAnalyticsReport,
  previewAnalyticsReportFile,
  renameAnalyticsReport,
  type GenerateReportPayload,
  type GeneratedReportRow,
} from "@/lib/admin-api";
import {
  StateBlock,
  downloadBlob,
  openBlobInTab,
  repDateTime,
} from "./repShared";

export const REPORT_TYPE_LABELS: Record<string, string> = {
  earnings: "Earnings",
  payouts: "Payouts",
  refunds: "Refunds",
  bookings: "Bookings",
  services: "Services",
  customers: "Customers",
  financial: "Financial Summary",
};

const TYPE_BADGE: Record<string, string> = {
  earnings: "rep-badge-green",
  payouts: "rep-badge-blue",
  refunds: "rep-badge-red",
  bookings: "rep-badge-navy",
  services: "rep-badge-yellow",
  customers: "rep-badge-purple",
  financial: "rep-badge-teal",
};

const BOOKING_STATUSES = ["pending", "accepted", "arrived", "ongoing", "completed", "cancelled", "declined"];
const PAYOUT_STATUSES = ["pending", "processing", "paid", "failed"];
const REFUND_STATUSES = ["requested", "under_review", "approved", "processing", "refunded", "rejected", "failed"];

export function fileNameOf(r: GeneratedReportRow) {
  const safe = r.name.replace(/[^\w\- ]+/g, "").trim() || "report";
  return `${safe}.${r.format}`;
}

/* ════════════════ GENERATE MODAL ════════════════ */
export function GenerateReportModal({
  open,
  onClose,
  currentRange,
  onGenerated,
}: {
  open: boolean;
  onClose: () => void;
  currentRange: Record<string, string>;
  onGenerated: (r: GeneratedReportRow) => void;
}) {
  const [type, setType] = useState("earnings");
  const [format, setFormat] = useState<"pdf" | "xlsx" | "csv">("csv");
  const [groupBy, setGroupBy] = useState("day");
  const [rangeMode, setRangeMode] = useState("current");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState("");

  const providersQuery = useQuery({
    queryKey: ["rep", "filter-providers"],
    queryFn: () => getWashers({ range: "all" }),
    enabled: open,
  });
  const servicesQuery = useQuery({
    queryKey: ["rep", "filter-services"],
    queryFn: () => getAdminServicesPricing(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (payload: GenerateReportPayload) => generateAnalyticsReport(payload),
    onSuccess: (row) => {
      setError("");
      onGenerated(row);
      onClose();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Report could not be generated. Please try again."),
  });

  if (!open) return null;

  const statusOptions =
    type === "payouts" ? PAYOUT_STATUSES : type === "refunds" ? REFUND_STATUSES : ["bookings", "earnings"].includes(type) ? BOOKING_STATUSES : [];
  const showProvider = ["earnings", "payouts", "refunds", "bookings"].includes(type);
  const showService = ["earnings", "bookings"].includes(type);

  const submit = () => {
    const payload: GenerateReportPayload = { type, format, groupBy };
    if (rangeMode === "current") {
      payload.range = currentRange.range;
      if (currentRange.from) payload.from = currentRange.from;
      if (currentRange.to) payload.to = currentRange.to;
    } else if (rangeMode === "custom") {
      if (!from || !to) {
        setError("Custom range ke liye From aur To dono dates chahiyein.");
        return;
      }
      payload.from = `${from}T00:00:00.000Z`;
      payload.to = `${to}T23:59:59.999Z`;
    } else {
      payload.range = rangeMode;
    }
    const filters: GenerateReportPayload["filters"] = {};
    if (status) filters.status = status;
    if (paymentStatus && type === "bookings") filters.paymentStatus = paymentStatus;
    if (providerId && showProvider) filters.providerId = providerId;
    if (serviceId && showService) filters.serviceId = serviceId;
    if (Object.keys(filters).length) payload.filters = filters;
    mutation.mutate(payload);
  };

  return (
    <div className="rep-modal-overlay" role="dialog" aria-modal="true">
      <div className="rep-modal">
        <div className="rep-modal-head">
          <h3>Generate Report</h3>
          <button type="button" className="rep-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="rep-form-grid">
          <label className="rep-field">
            <span>Report Type</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className="rep-select">
              {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="rep-field">
            <span>Group By</span>
            <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="rep-select">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="provider">Provider</option>
              <option value="service">Service</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="rep-field">
            <span>Date Range</span>
            <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)} className="rep-select">
              <option value="current">Current page range</option>
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="yearly">This Year</option>
              <option value="all">All Time</option>
              <option value="custom">Custom…</option>
            </select>
          </label>
          <div className="rep-field">
            <span>Format</span>
            <div className="rep-radio-row">
              {(["pdf", "xlsx", "csv"] as const).map((f) => (
                <label key={f} className={`rep-radio ${format === f ? "rep-radio-on" : ""}`}>
                  <input type="radio" name="rep-format" checked={format === f} onChange={() => setFormat(f)} />
                  {f === "xlsx" ? "Excel" : f.toUpperCase()}
                </label>
              ))}
            </div>
          </div>
          {rangeMode === "custom" ? (
            <>
              <label className="rep-field">
                <span>From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rep-input" />
              </label>
              <label className="rep-field">
                <span>To</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rep-input" />
              </label>
            </>
          ) : null}
          {statusOptions.length ? (
            <label className="rep-field">
              <span>Booking / Record Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rep-select">
                <option value="">All statuses</option>
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {type === "bookings" ? (
            <label className="rep-field">
              <span>Payment Status</span>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rep-select">
                <option value="">All</option>
                <option value="pending">pending</option>
                <option value="paid">paid</option>
                <option value="failed">failed</option>
              </select>
            </label>
          ) : null}
          {showProvider ? (
            <label className="rep-field">
              <span>Provider</span>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="rep-select">
                <option value="">All providers</option>
                {(providersQuery.data || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name || p.email || "Provider"}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showService ? (
            <label className="rep-field">
              <span>Service</span>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="rep-select">
                <option value="">All services</option>
                {(servicesQuery.data?.catalogServices || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        {error ? <p className="rep-form-error">{error}</p> : null}
        <div className="rep-modal-foot">
          <button type="button" className="rep-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rep-btn rep-btn-yellow" onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════ PREVIEW MODAL ════════════════ */
export function PreviewModal({
  report,
  onClose,
}: {
  report: GeneratedReportRow | null;
  onClose: () => void;
}) {
  const isPdf = report?.format === "pdf";
  const query = useQuery({
    queryKey: ["analytics", "preview", report?.id],
    queryFn: () => previewAnalyticsReport(report!.id),
    enabled: !!report && !isPdf,
  });
  if (!report) return null;

  const openPdf = async () => {
    const blob = await previewAnalyticsReportFile(report.id);
    openBlobInTab(blob);
  };
  const download = async () => {
    const blob = await downloadAnalyticsReport(report.id);
    downloadBlob(blob, fileNameOf(report));
  };

  return (
    <div className="rep-modal-overlay" role="dialog" aria-modal="true">
      <div className="rep-modal rep-modal-wide">
        <div className="rep-modal-head">
          <h3>{report.name}</h3>
          <button type="button" className="rep-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {isPdf ? (
          <div className="rep-state">
            <p>PDF reports browser ke naye tab me khulti hain.</p>
            <div className="rep-modal-foot rep-modal-foot-center">
              <button type="button" className="rep-btn rep-btn-yellow" onClick={openPdf}>
                Open PDF
              </button>
              <button type="button" className="rep-btn" onClick={download}>
                Download
              </button>
            </div>
          </div>
        ) : (
          <StateBlock
            loading={query.isLoading}
            error={query.isError ? query.error : null}
            empty={!!query.data && query.data.rows.length === 0}
            emptyText="Is report me koi rows nahi hain."
            onRetry={() => query.refetch()}
          >
            {query.data ? (
              <>
                <div className="rep-table-scroll">
                  <table className="admin-table rep-table">
                    <thead>
                      <tr>
                        {query.data.columns.map((c, i) => (
                          <th key={i}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {query.data.truncated ? (
                  <p className="rep-note">
                    Preview pehli 200 rows dikha raha hai — kul {query.data.totalRows} rows hain. Poori
                    file ke liye Download karein.
                  </p>
                ) : null}
                <div className="rep-modal-foot">
                  <button type="button" className="rep-btn rep-btn-yellow" onClick={download}>
                    Download
                  </button>
                </div>
              </>
            ) : null}
          </StateBlock>
        )}
      </div>
    </div>
  );
}

/* ════════════════ REPORTS TABLE (Recent + Library) ════════════════ */
export function ReportTable({
  reports,
  isAdmin,
  onPreview,
  onChanged,
}: {
  reports: GeneratedReportRow[];
  isAdmin: boolean;
  onPreview: (r: GeneratedReportRow) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renameOf, setRenameOf] = useState<GeneratedReportRow | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteOf, setDeleteOf] = useState<GeneratedReportRow | null>(null);
  const [actionError, setActionError] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics", "reports"] });
    onChanged();
  };
  const download = async (r: GeneratedReportRow) => {
    try {
      const blob = await downloadAnalyticsReport(r.id);
      downloadBlob(blob, fileNameOf(r));
    } catch {
      setActionError("Download fail ho gaya. Dobara koshish karein.");
    }
  };
  const renameMutation = useMutation({
    mutationFn: () => renameAnalyticsReport(renameOf!.id, renameText.trim()),
    onSuccess: () => {
      setRenameOf(null);
      invalidate();
    },
    onError: () => setActionError("Rename fail ho gaya."),
  });
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateAnalyticsReport(id),
    onSuccess: invalidate,
    onError: () => setActionError("Duplicate fail ho gaya."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnalyticsReport(id),
    onSuccess: () => {
      setDeleteOf(null);
      invalidate();
    },
    onError: () => setActionError("Delete fail ho gaya."),
  });

  if (!reports.length)
    return <div className="rep-state">Abhi koi report generate nahi hui.</div>;

  return (
    <>
      {actionError ? <p className="rep-form-error">{actionError}</p> : null}
      <div className="rep-table-scroll">
        <table className="admin-table rep-table">
          <thead>
            <tr>
              <th>Report Name</th>
              <th>Type</th>
              <th>Period</th>
              <th>Generated On</th>
              <th>Generated By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.name}</strong>
                  <span className="rep-cell-sub">
                    {r.format.toUpperCase()} · {r.rowCount} rows
                  </span>
                </td>
                <td>
                  <span className={`rep-badge ${TYPE_BADGE[r.type] || "rep-badge-navy"}`}>
                    {REPORT_TYPE_LABELS[r.type] || r.type}
                  </span>
                </td>
                <td>{r.rangeLabel}</td>
                <td>{repDateTime(r.createdAt)}</td>
                <td>{r.generatedBy || "—"}</td>
                <td>
                  <div className="rep-row-actions">
                    <button type="button" className="rep-btn rep-btn-small" onClick={() => download(r)}>
                      Download
                    </button>
                    <button type="button" className="rep-btn rep-btn-small" onClick={() => onPreview(r)}>
                      View
                    </button>
                    <button
                      type="button"
                      className="rep-icon-btn"
                      aria-label="More actions"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setMenu(
                          menu?.id === r.id
                            ? null
                            : { id: r.id, x: Math.max(rect.right - 170, 8), y: rect.bottom + 6 }
                        );
                      }}
                    >
                      •••
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {menu ? (
        <>
          <div className="rep-menu-backdrop" onClick={() => setMenu(null)} />
          <div className="rep-menu" style={{ left: menu.x, top: menu.y }}>
            <button
              type="button"
              onClick={() => {
                const r = reports.find((x) => x.id === menu.id);
                setMenu(null);
                if (r) {
                  setRenameText(r.name);
                  setRenameOf(r);
                }
              }}
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => {
                duplicateMutation.mutate(menu.id);
                setMenu(null);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => {
                const r = reports.find((x) => x.id === menu.id);
                setMenu(null);
                if (r) download(r);
              }}
            >
              Download
            </button>
            {isAdmin ? (
              <button
                type="button"
                className="rep-menu-danger"
                onClick={() => {
                  const r = reports.find((x) => x.id === menu.id);
                  setMenu(null);
                  if (r) setDeleteOf(r);
                }}
              >
                Delete
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      {renameOf ? (
        <div className="rep-modal-overlay" role="dialog" aria-modal="true">
          <div className="rep-modal rep-modal-small">
            <div className="rep-modal-head">
              <h3>Rename Report</h3>
              <button type="button" className="rep-icon-btn" onClick={() => setRenameOf(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <label className="rep-field">
              <span>New name</span>
              <input
                className="rep-input"
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                maxLength={140}
              />
            </label>
            <div className="rep-modal-foot">
              <button type="button" className="rep-btn" onClick={() => setRenameOf(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rep-btn rep-btn-yellow"
                disabled={!renameText.trim() || renameMutation.isPending}
                onClick={() => renameMutation.mutate()}
              >
                {renameMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOf ? (
        <div className="rep-modal-overlay" role="dialog" aria-modal="true">
          <div className="rep-modal rep-modal-small">
            <div className="rep-modal-head">
              <h3>Delete Report</h3>
              <button type="button" className="rep-icon-btn" onClick={() => setDeleteOf(null)} aria-label="Close">
                ✕
              </button>
            </div>
            <p>
              “{deleteOf.name}” hamesha ke liye delete ho jayegi. Ye amal wapas nahi ho sakta.
            </p>
            <div className="rep-modal-foot">
              <button type="button" className="rep-btn" onClick={() => setDeleteOf(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="rep-btn rep-btn-danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteOf.id)}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ════════════════ CUSTOM REPORTS TAB ════════════════ */
export function CustomReportsTab({
  isAdmin,
  currentRange,
  onPreview,
  onGenerateOpen,
}: {
  isAdmin: boolean;
  currentRange: Record<string, string>;
  onPreview: (r: GeneratedReportRow) => void;
  onGenerateOpen: () => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["analytics", "reports", "library", search, typeFilter, page],
    queryFn: () =>
      listAnalyticsReports({ search, type: typeFilter || undefined, page, limit: 15 }),
  });
  void currentRange;
  return (
    <div className="rep-card">
      <div className="rep-card-head">
        <h3>Generated Reports Library</h3>
        <button type="button" className="rep-btn rep-btn-yellow" onClick={onGenerateOpen}>
          Generate Report
        </button>
      </div>
      <div className="rep-filter-row">
        <input
          className="rep-input"
          placeholder="Search reports…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="rep-select"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          {Object.entries(REPORT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <StateBlock
        loading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => query.refetch()}
      >
        {query.data ? (
          <>
            <ReportTable
              reports={query.data.reports}
              isAdmin={isAdmin}
              onPreview={onPreview}
              onChanged={() => query.refetch()}
            />
            {query.data.pagination.pages > 1 ? (
              <div className="rep-pagination">
                <button
                  type="button"
                  className="rep-btn rep-btn-small"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span>
                  Page {query.data.pagination.page} of {query.data.pagination.pages} ·{" "}
                  {query.data.pagination.total} reports
                </span>
                <button
                  type="button"
                  className="rep-btn rep-btn-small"
                  disabled={page >= query.data.pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </StateBlock>
    </div>
  );
}
