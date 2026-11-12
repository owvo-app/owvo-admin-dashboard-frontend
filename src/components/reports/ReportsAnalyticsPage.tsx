"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  exportAnalyticsTab,
  generateAnalyticsReport,
  getAnalyticsOverview,
  getAnalyticsTrend,
  listAnalyticsReports,
  type GenerateReportPayload,
  type GeneratedReportRow,
} from "@/lib/admin-api";
import { money } from "@/lib/format";
import { getStoredUser } from "@/lib/auth-storage";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { PctChip, RepBars, RepDonut, RepLineChart, StateBlock, downloadBlob } from "./repShared";
import {
  BookingsTab,
  CustomersTab,
  FinancialTab,
  ProvidersTab,
  RevenueTab,
  ServicesTab,
} from "./ReportsTabs";
import {
  CustomReportsTab,
  GenerateReportModal,
  PreviewModal,
  ReportTable,
} from "./ReportLibrary";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "bookings", label: "Bookings" },
  { key: "revenue", label: "Revenue" },
  { key: "providers", label: "Providers" },
  { key: "customers", label: "Customers" },
  { key: "services", label: "Services" },
  { key: "financial", label: "Financial" },
  { key: "reports", label: "Custom Reports" },
];

const KPI_LABELS: Record<string, string> = {
  totalBookings: "Total Bookings",
  grossVolume: "Gross Volume",
  commission: "OWVO Commission",
  providerEarnings: "Provider Earnings",
  refunds: "Refunds",
  paidOut: "Paid Out",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

const QUICK_REPORTS: { label: string; desc: string; payload: GenerateReportPayload }[] = [
  {
    label: "Daily Performance",
    desc: "Today's bookings and performance",
    payload: { type: "bookings", format: "csv", groupBy: "day", range: "daily" },
  },
  {
    label: "Provider Payout Summary",
    desc: "What providers were paid",
    payload: { type: "payouts", format: "csv", groupBy: "provider" },
  },
  {
    label: "Refunds Report",
    desc: "Full refunds detail",
    payload: { type: "refunds", format: "csv", groupBy: "none" },
  },
  {
    label: "Service Performance",
    desc: "How each service is performing",
    payload: { type: "services", format: "csv", groupBy: "service" },
  },
  {
    label: "Customer Insights",
    desc: "Top customers and their spending",
    payload: { type: "customers", format: "csv", groupBy: "none" },
  },
  {
    label: "Financial Summary",
    desc: "Complete financial summary",
    payload: { type: "financial", format: "csv", groupBy: "none" },
  },
];

export function ReportsAnalyticsPage() {
  const dateRange = useDashboardDateRange();
  const queryClient = useQueryClient();
  const me = getStoredUser();
  const isAdmin = me?.role === "admin";

  const rangeQuery = useMemo(
    () => new URLSearchParams(dateRange.query).toString(),
    [dateRange.query]
  );
  const qk = dateRange.queryKey;

  const [tab, setTab] = useState("overview");
  const [trendGrouping, setTrendGrouping] = useState("daily");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [preview, setPreview] = useState<GeneratedReportRow | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [miniType, setMiniType] = useState("earnings");
  const [miniFormat, setMiniFormat] = useState<"pdf" | "xlsx" | "csv">("csv");

  const overviewQuery = useQuery({
    queryKey: ["analytics", "overview", qk],
    queryFn: () => getAnalyticsOverview(rangeQuery),
    enabled: tab === "overview",
  });
  const trendQuery = useQuery({
    queryKey: ["analytics", "trend", qk, trendGrouping],
    queryFn: () => getAnalyticsTrend(rangeQuery, trendGrouping),
    enabled: tab === "overview",
  });
  const recentQuery = useQuery({
    queryKey: ["analytics", "reports", "recent"],
    queryFn: () => listAnalyticsReports({ limit: 5 }),
    enabled: tab === "overview",
  });

  const afterGenerated = (row: GeneratedReportRow) => {
    queryClient.invalidateQueries({ queryKey: ["analytics", "reports"] });
    setNotice(`Report ready: ${row.name}`);
    setPreview(row);
  };

  const generateMutation = useMutation({
    mutationFn: (payload: GenerateReportPayload) => generateAnalyticsReport(payload),
    onSuccess: afterGenerated,
    onError: () => setNotice("The report could not be generated. Please try again."),
  });

  const runQuick = (payload: GenerateReportPayload) => {
    const p: GenerateReportPayload = { ...payload };
    if (!p.range) {
      p.range = dateRange.query.range;
      if (dateRange.query.from) p.from = dateRange.query.from;
      if (dateRange.query.to) p.to = dateRange.query.to;
    }
    generateMutation.mutate(p);
  };

  const runExport = async (format: string) => {
    setExportOpen(false);
    try {
      const blob = await exportAnalyticsTab(tab, format, rangeQuery);
      downloadBlob(blob, `owvo-${tab}-export.${format === "xlsx" ? "xlsx" : format}`);
    } catch {
      setNotice("Export failed. Please try again.");
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["analytics"] });
  };

  const ov = overviewQuery.data;

  return (
    <div className="data-page rep-page">
      <div className="data-page-header rep-header">
        <div>
          <h1>Reports &amp; Analytics</h1>
          <p className="rep-subtitle">
            Business performance, revenue and reports — {dateRange.label}
          </p>
        </div>
        <div className="rep-header-actions">
          <button type="button" className="rep-btn" onClick={refresh}>
            ⟳ Refresh
          </button>
          <div className="rep-export-wrap">
            <button type="button" className="rep-btn rep-btn-dark" onClick={() => setExportOpen((o) => !o)}>
              Export ▾
            </button>
            {exportOpen ? (
              <>
                <div className="rep-menu-backdrop" onClick={() => setExportOpen(false)} />
                <div className="rep-menu rep-export-menu">
                  <button type="button" onClick={() => runExport("pdf")}>
                    PDF
                  </button>
                  <button type="button" onClick={() => runExport("xlsx")}>
                    Excel
                  </button>
                  <button type="button" onClick={() => runExport("csv")}>
                    CSV
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rep-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`rep-tab ${tab === t.key ? "rep-tab-on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice ? (
        <div className="rep-notice">
          <span>{notice}</span>
          <button type="button" className="rep-icon-btn" onClick={() => setNotice("")} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ) : null}

      {tab === "overview" ? (
        <div className="rep-overview-layout">
          <div className="rep-main-col">
            <StateBlock
              loading={overviewQuery.isLoading}
              error={overviewQuery.isError ? overviewQuery.error : null}
              onRetry={() => overviewQuery.refetch()}
            >
              {ov ? (
                <>
                  <div className="rep-kpi-grid">
                    {ov.kpis.map((k) => (
                      <div className="rep-kpi" key={k.key}>
                        <span className="rep-kpi-label">{KPI_LABELS[k.key] || k.key}</span>
                        <strong className="rep-kpi-value">
                          {k.money ? money(k.value) : k.value}
                        </strong>
                        <PctChip value={k.changePct} />
                      </div>
                    ))}
                  </div>

                  <div className="rep-card">
                    <div className="rep-card-head">
                      <h3>Revenue &amp; Commission Trend</h3>
                      <div className="rep-segmented">
                        {["daily", "weekly", "monthly"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            className={trendGrouping === g ? "rep-seg-on" : ""}
                            onClick={() => setTrendGrouping(g)}
                          >
                            {g === "daily" ? "Daily" : g === "weekly" ? "Weekly" : "Monthly"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <StateBlock
                      loading={trendQuery.isLoading}
                      error={trendQuery.isError ? trendQuery.error : null}
                      empty={!!trendQuery.data && trendQuery.data.series.every((s) => s.gross === 0 && s.commission === 0)}
                      emptyText="No revenue in this range."
                      onRetry={() => trendQuery.refetch()}
                    >
                      {trendQuery.data ? (
                        <RepLineChart
                          points={trendQuery.data.series.map((s) => ({
                            label: s.label,
                            a: s.gross,
                            b: s.commission,
                          }))}
                          aName="Gross Volume"
                          bName="Commission"
                        />
                      ) : null}
                    </StateBlock>
                  </div>

                  <div className="rep-two-col">
                    <div className="rep-card">
                      <div className="rep-card-head">
                        <h3>Bookings by Service</h3>
                      </div>
                      {ov.byService.length ? (
                        <RepDonut
                          slices={ov.byService.map((s) => ({ label: s.title, value: s.count }))}
                          centerLabel="Bookings"
                        />
                      ) : (
                        <div className="rep-state">No bookings in this range.</div>
                      )}
                    </div>
                    <div className="rep-card">
                      <div className="rep-card-head">
                        <h3>Booking Status</h3>
                      </div>
                      {ov.statusDistribution.length ? (
                        <>
                          <RepDonut
                            slices={ov.statusDistribution.map((s) => ({
                              label: STATUS_LABELS[s.status] || s.status,
                              value: s.count,
                            }))}
                            centerLabel="Bookings"
                          />
                          <p className="rep-note">
                            Open disputes: <strong>{ov.openDisputes}</strong> (Support &amp; Disputes)
                          </p>
                        </>
                      ) : (
                        <div className="rep-state">No bookings in this range.</div>
                      )}
                    </div>
                  </div>

                  <div className="rep-two-col">
                    <div className="rep-card">
                      <div className="rep-card-head">
                        <h3>Top Providers</h3>
                        <button type="button" className="rep-link-btn" onClick={() => setTab("providers")}>
                          View All →
                        </button>
                      </div>
                      {ov.topProviders.length ? (
                        <div className="rep-top-list">
                          {ov.topProviders.map((p) => (
                            <div className="rep-top-row" key={p.providerId}>
                              <div>
                                <strong>
                                  {p.number} {p.name}
                                </strong>
                                <span className="rep-cell-sub">{p.jobs} jobs</span>
                              </div>
                              <strong>{money(p.earnings)}</strong>
                            </div>
                          ))}
                          <RepBars
                            items={ov.topProviders.map((p) => ({
                              label: p.name,
                              value: p.earnings,
                              display: money(p.earnings),
                            }))}
                          />
                        </div>
                      ) : (
                        <div className="rep-state">No earnings in this range.</div>
                      )}
                    </div>
                    <div className="rep-card">
                      <div className="rep-card-head">
                        <h3>Top Services</h3>
                        <button type="button" className="rep-link-btn" onClick={() => setTab("services")}>
                          View All →
                        </button>
                      </div>
                      {ov.topServices.length ? (
                        <RepBars
                          items={ov.topServices.map((s) => ({
                            label: s.title,
                            value: s.revenue,
                            display: money(s.revenue),
                          }))}
                        />
                      ) : (
                        <div className="rep-state">No revenue in this range.</div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </StateBlock>

            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Recent Reports</h3>
                <button type="button" className="rep-link-btn" onClick={() => setTab("reports")}>
                  View All Reports →
                </button>
              </div>
              <StateBlock
                loading={recentQuery.isLoading}
                error={recentQuery.isError ? recentQuery.error : null}
                onRetry={() => recentQuery.refetch()}
              >
                {recentQuery.data ? (
                  <ReportTable
                    reports={recentQuery.data.reports}
                    isAdmin={isAdmin}
                    onPreview={setPreview}
                    onChanged={() => recentQuery.refetch()}
                  />
                ) : null}
              </StateBlock>
            </div>
          </div>

          <aside className="rep-side-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Generate Report</h3>
              </div>
              <label className="rep-field">
                <span>Report Type</span>
                <select className="rep-select" value={miniType} onChange={(e) => setMiniType(e.target.value)}>
                  <option value="earnings">Earnings Summary</option>
                  <option value="payouts">Payouts</option>
                  <option value="refunds">Refunds</option>
                  <option value="bookings">Bookings</option>
                  <option value="services">Services</option>
                  <option value="customers">Customers</option>
                  <option value="financial">Financial Summary</option>
                </select>
              </label>
              <div className="rep-field">
                <span>Format</span>
                <div className="rep-radio-row">
                  {(["pdf", "xlsx", "csv"] as const).map((f) => (
                    <label key={f} className={`rep-radio ${miniFormat === f ? "rep-radio-on" : ""}`}>
                      <input
                        type="radio"
                        name="rep-mini-format"
                        checked={miniFormat === f}
                        onChange={() => setMiniFormat(f)}
                      />
                      {f === "xlsx" ? "Excel" : f.toUpperCase()}
                    </label>
                  ))}
                </div>
              </div>
              <p className="rep-note">Range: {dateRange.label} (the page's global filter)</p>
              <button
                type="button"
                className="rep-btn rep-btn-yellow rep-btn-block"
                disabled={generateMutation.isPending}
                onClick={() =>
                  generateMutation.mutate({
                    type: miniType,
                    format: miniFormat,
                    groupBy: "day",
                    range: dateRange.query.range,
                    from: dateRange.query.from,
                    to: dateRange.query.to,
                  })
                }
              >
                {generateMutation.isPending ? "Generating…" : "Generate Report"}
              </button>
              <button type="button" className="rep-link-btn rep-more-options" onClick={() => setGenerateOpen(true)}>
                More options (filters, custom range)…
              </button>
            </div>

            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Quick Reports</h3>
              </div>
              <div className="rep-quick-list">
                {QUICK_REPORTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="rep-quick-item"
                    disabled={generateMutation.isPending}
                    onClick={() => runQuick(q.payload)}
                  >
                    <span>
                      <strong>{q.label}</strong>
                      <em>{q.desc}</em>
                    </span>
                    <b>→</b>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {tab === "bookings" ? <BookingsTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "revenue" ? <RevenueTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "providers" ? <ProvidersTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "customers" ? <CustomersTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "services" ? <ServicesTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "financial" ? <FinancialTab rq={rangeQuery} qk={qk} /> : null}
      {tab === "reports" ? (
        <CustomReportsTab
          isAdmin={isAdmin}
          currentRange={dateRange.query}
          onPreview={setPreview}
          onGenerateOpen={() => setGenerateOpen(true)}
        />
      ) : null}

      <GenerateReportModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        currentRange={dateRange.query}
        onGenerated={afterGenerated}
      />
      <PreviewModal report={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
