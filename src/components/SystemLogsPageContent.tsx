"use client";

import { getStoredUser } from "@/lib/auth-storage";
import { SOCKET_URL } from "@/lib/api";
import { getActivityLogsPaged, type ActivityLog } from "@/lib/admin-api";
import { downloadBlob } from "@/components/reports/repShared";
import { getDashboardSocketOptions } from "@/lib/socket";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

/* ------------------------------------------------------------------ */
/* System Logs v2 — searchable, filterable by entity, paginated. The   */
/* actor name resolves fullName || name (app accounts use fullName).   */
/* ------------------------------------------------------------------ */

const LIMIT = 20;

type LogActor = {
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

function humanize(value?: string) {
  if (!value) return "—";
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function metadataPairs(log: ActivityLog) {
  const meta = (log.metadata || {}) as Record<string, unknown>;
  return Object.entries(meta)
    .filter(
      ([, v]) =>
        typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    )
    .slice(0, 4)
    .map(([k, v]) => ({ label: humanize(k), value: String(v) }));
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

export function SystemLogsPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const logsQuery = useQuery({
    queryKey: ["admin-activity-logs", search, entityType, page],
    queryFn: () =>
      getActivityLogsPaged({
        search: search.trim() || undefined,
        entityType: entityType || undefined,
        page,
        limit: LIMIT,
      }),
    retry: false,
  });

  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const entityTypes = logsQuery.data?.entityTypes ?? [];
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    const user = getStoredUser();
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refresh = () =>
      queryClient.invalidateQueries({ queryKey: ["admin-activity-logs"] });
    socket.on("admin_activity_log_created", refresh);
    return () => {
      socket.off("admin_activity_log_created", refresh);
      socket.disconnect();
    };
  }, [queryClient]);

  const downloadCsv = () => {
    const rows: string[][] = [
      ["Time", "Activity", "Actor", "Actor Email", "Entity", "Details"],
    ];
    for (const log of items) {
      const actor = (log.actor || {}) as LogActor;
      const pairs = metadataPairs(log);
      rows.push([
        log.createdAt
          ? format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")
          : "",
        humanize(log.action),
        actor.fullName || actor.name || log.actorRole || "System",
        actor.email || "",
        humanize(log.entityType),
        pairs.map((p) => `${p.label}: ${p.value}`).join(" | "),
      ]);
    }
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `owvo-system-logs-page-${page}.csv`
    );
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>System Logs</h1>
          <p>Live audit trail for admin and staff actions.</p>
        </div>
        <button
          className="booking-filter-reset"
          disabled={logsQuery.isLoading || items.length === 0}
          onClick={downloadCsv}
          type="button"
        >
          <Download size={15} /> Download CSV (this page)
        </button>
      </div>

      <div className="slog-filters">
        <label className="booking-search">
          <Search size={16} />
          <input
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by action or actor name/email"
            value={search}
          />
        </label>
        <select
          className="modal-input slog-entity-select"
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          value={entityType}
        >
          <option value="">All entities</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {humanize(type)}
            </option>
          ))}
        </select>
        {search || entityType ? (
          <button
            className="booking-filter-reset"
            onClick={() => {
              setSearch("");
              setEntityType("");
              setPage(1);
            }}
            type="button"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="table-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Activity</th>
              <th>Actor</th>
              <th>Entity</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => {
              const pairs = metadataPairs(log);
              const actor = (log.actor || {}) as LogActor;
              const actorName =
                actor.fullName || actor.name || log.actorRole || "System";
              return (
                <tr key={log._id}>
                  <td>
                    <div className="log-activity-cell">
                      <strong>{humanize(log.action)}</strong>
                      <span>
                        {pairs.length
                          ? pairs.map((p) => `${p.label}: ${p.value}`).join(" · ")
                          : "No extra details recorded."}
                      </span>
                    </div>
                  </td>
                  <td>
                    <strong>{actorName}</strong>
                    <span>{actor.email || actor.role || ""}</span>
                  </td>
                  <td>
                    <span className="log-entity-pill">
                      {humanize(log.entityType)}
                    </span>
                  </td>
                  <td>
                    <strong>
                      {log.createdAt
                        ? formatDistanceToNow(new Date(log.createdAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </strong>
                    <span>
                      {log.createdAt
                        ? format(new Date(log.createdAt), "dd MMM yyyy, HH:mm")
                        : ""}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {logsQuery.isLoading ? (
          <div className="empty-state">
            <Loader2 size={22} /> Loading system logs...
          </div>
        ) : logsQuery.isError ? (
          <div className="error-state">
            We could not load the system logs. Please check your internet
            connection and try again.
            <button
              className="booking-filter-reset"
              onClick={() => logsQuery.refetch()}
              style={{ marginLeft: 10 }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            {search || entityType
              ? "No logs match your search. Try a different action, actor or entity."
              : "No activity has been recorded yet."}
          </div>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="sup-pagination">
          <span className="muted">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(total, page * LIMIT)} of{" "}
            {total} logs
          </span>
          <div className="sup-pagination-buttons">
            <button
              disabled={page <= 1 || logsQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            <button
              disabled={page >= pageCount || logsQuery.isFetching}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              type="button"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
