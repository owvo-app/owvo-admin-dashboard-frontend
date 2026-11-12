"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getAnalyticsBookings,
  getAnalyticsCustomers,
  getAnalyticsFinancial,
  getAnalyticsProviders,
  getAnalyticsRevenue,
  getAnalyticsServices,
} from "@/lib/admin-api";
import { money } from "@/lib/format";
import { RepBars, RepLineChart, StateBlock, repDate } from "./repShared";

type Q = { rq: string; qk: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Requested",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

/* ════════════════ BOOKINGS TAB ════════════════ */
export function BookingsTab({ rq, qk }: Q) {
  const query = useQuery({
    queryKey: ["analytics", "bookings", qk],
    queryFn: () => getAnalyticsBookings(rq),
  });
  const d = query.data;
  return (
    <StateBlock loading={query.isLoading} error={query.isError ? query.error : null} onRetry={() => query.refetch()}>
      {d ? (
        <div className="rep-stack">
          <div className="rep-mini-grid">
            <div className="rep-mini-card">
              <span>Total Bookings</span>
              <strong>{d.total}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Completed</span>
              <strong>{d.counts.completed || 0}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Completion Rate</span>
              <strong>{d.completionRate == null ? "—" : `${d.completionRate}%`}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Cancel Rate</span>
              <strong>{d.cancelRate == null ? "—" : `${d.cancelRate}%`}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Book Now</span>
              <strong>{d.nowLater.now}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Book for Later</span>
              <strong>{d.nowLater.later}</strong>
            </div>
          </div>

          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Booking Trend</h3>
              <span className="rep-note">Created vs Completed (per day)</span>
            </div>
            {d.trend.length ? (
              <RepLineChart
                points={d.trend.map((t) => ({ label: t.date, a: t.created, b: t.completed }))}
                aName="Created"
                bName="Completed"
                moneyY={false}
              />
            ) : (
              <div className="rep-state">No bookings were created in this range.</div>
            )}
          </div>

          <div className="rep-two-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Status Counts</h3>
              </div>
              <RepBars
                items={Object.entries(d.counts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([s, c]) => ({
                    label: STATUS_LABELS[s] || s,
                    value: c,
                    display: String(c),
                  }))}
              />
            </div>
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Cancellations</h3>
              </div>
              {d.cancelledBy.length ? (
                <RepBars
                  items={d.cancelledBy.map((c) => ({
                    label: c.by === "user" ? "Customer" : c.by === "provider" ? "Provider" : c.by === "admin" ? "Admin" : "Unknown",
                    value: c.count,
                    display: String(c.count),
                  }))}
                />
              ) : (
                <div className="rep-state">No cancellations were recorded in this range.</div>
              )}
              {d.recentCancellations.length ? (
                <div className="rep-table-scroll">
                  <table className="admin-table rep-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Provider</th>
                        <th>Service</th>
                        <th>Amount</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.recentCancellations.map((c) => (
                        <tr key={c.id}>
                          <td>{c.customer}</td>
                          <td>{c.provider}</td>
                          <td>{c.service}</td>
                          <td>{money(c.amount)}</td>
                          <td>{repDate(c.at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rep-two-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Peak Hours (London)</h3>
              </div>
              <RepBars
                items={d.byHour
                  .filter((h) => h.count > 0)
                  .map((h) => ({
                    label: `${String(h.hour).padStart(2, "0")}:00`,
                    value: h.count,
                    display: String(h.count),
                  }))}
              />
              {!d.byHour.some((h) => h.count > 0) ? (
                <div className="rep-state">No data available.</div>
              ) : null}
            </div>
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Bookings by Weekday</h3>
              </div>
              <RepBars
                items={d.byWeekday.map((w) => ({ label: w.day, value: w.count, display: String(w.count) }))}
              />
            </div>
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}

/* ════════════════ REVENUE TAB ════════════════ */
export function RevenueTab({ rq, qk }: Q) {
  const [grouping, setGrouping] = useState("monthly");
  const query = useQuery({
    queryKey: ["analytics", "revenue", qk, grouping],
    queryFn: () => getAnalyticsRevenue(rq, grouping),
  });
  const d = query.data;
  return (
    <StateBlock loading={query.isLoading} error={query.isError ? query.error : null} onRetry={() => query.refetch()}>
      {d ? (
        <div className="rep-stack">
          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Revenue by Period</h3>
              <div className="rep-segmented">
                {["daily", "weekly", "monthly"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={grouping === g ? "rep-seg-on" : ""}
                    onClick={() => setGrouping(g)}
                  >
                    {g === "daily" ? "Daily" : g === "weekly" ? "Weekly" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>
            {d.periods.length ? (
              <div className="rep-table-scroll">
                <table className="admin-table rep-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Jobs</th>
                      <th>Gross</th>
                      <th>Commission</th>
                      <th>Provider Net</th>
                      <th>Tips</th>
                      <th>Refunds</th>
                      <th>Net Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.periods.map((p) => (
                      <tr key={p.date}>
                        <td>{p.date}</td>
                        <td>{p.jobs}</td>
                        <td>{money(p.gross)}</td>
                        <td>{money(p.commission)}</td>
                        <td>{money(p.net)}</td>
                        <td>{money(p.tips)}</td>
                        <td>{money(p.refunds)}</td>
                        <td>
                          <strong>{money(p.netRevenue)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Total</td>
                      <td>{d.periods.reduce((a, p) => a + p.jobs, 0)}</td>
                      <td>{money(d.totals.gross)}</td>
                      <td>{money(d.totals.commission)}</td>
                      <td>{money(d.totals.net)}</td>
                      <td>{money(d.totals.tips)}</td>
                      <td>{money(d.totals.refunds)}</td>
                      <td>
                        <strong>{money(d.totals.netRevenue)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="rep-state">No completed bookings in this range.</div>
            )}
          </div>

          <div className="rep-two-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Revenue by Service</h3>
              </div>
              {d.byService.length ? (
                <div className="rep-table-scroll">
                  <table className="admin-table rep-table">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th>Jobs</th>
                        <th>Gross</th>
                        <th>Commission</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.byService.map((s) => (
                        <tr key={s.serviceId}>
                          <td>{s.title}</td>
                          <td>{s.jobs}</td>
                          <td>{money(s.gross)}</td>
                          <td>{money(s.commission)}</td>
                          <td>{money(s.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rep-state">No data available.</div>
              )}
            </div>
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Payment Methods</h3>
              </div>
              <RepBars
                items={[
                  { label: "Card", value: d.methodSplit.card, display: money(d.methodSplit.card) },
                  { label: "Wallet", value: d.methodSplit.wallet, display: money(d.methodSplit.wallet) },
                ]}
              />
              <p className="rep-note">
                Split payments (wallet + card): {d.methodSplit.splitBookings} bookings · Wallet used in{" "}
                {d.methodSplit.walletBookings} bookings
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}

/* ════════════════ PROVIDERS TAB ════════════════ */
export function ProvidersTab({ rq, qk }: Q) {
  const query = useQuery({
    queryKey: ["analytics", "providers", qk],
    queryFn: () => getAnalyticsProviders(rq),
  });
  const d = query.data;
  return (
    <StateBlock
      loading={query.isLoading}
      error={query.isError ? query.error : null}
      empty={!!d && d.leaderboard.length === 0}
      emptyText="No provider completed a wash in this range."
      onRetry={() => query.refetch()}
    >
      {d ? (
        <div className="rep-stack">
          <p className="rep-note">New provider signups in this range: <strong>{d.signupCount}</strong></p>
          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Provider Leaderboard</h3>
              <span className="rep-note">Sorted by earnings</span>
            </div>
            <div className="rep-table-scroll">
              <table className="admin-table rep-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Provider</th>
                    <th>Jobs</th>
                    <th>Gross</th>
                    <th>Commission</th>
                    <th>Net Earnings</th>
                    <th>Tips</th>
                    <th>Rating</th>
                    <th>Completion</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.leaderboard.map((p, i) => (
                    <tr key={p.providerId}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>
                          {p.number} {p.name}
                        </strong>
                      </td>
                      <td>{p.jobs}</td>
                      <td>{money(p.gross)}</td>
                      <td>{money(p.commission)}</td>
                      <td>
                        <strong>{money(p.net)}</strong>
                      </td>
                      <td>{money(p.tips)}</td>
                      <td>{p.rating == null ? "—" : `★ ${p.rating} (${p.ratingCount})`}</td>
                      <td>{p.completionRate == null ? "—" : `${p.completionRate}%`}</td>
                      <td>
                        <span className={`rep-badge ${p.isOnline ? "rep-badge-green" : "rep-badge-navy"}`}>
                          {p.accountStatus !== "active" ? p.accountStatus : p.isOnline ? "Online" : "Offline"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}

/* ════════════════ CUSTOMERS TAB ════════════════ */
export function CustomersTab({ rq, qk }: Q) {
  const query = useQuery({
    queryKey: ["analytics", "customers", qk],
    queryFn: () => getAnalyticsCustomers(rq),
  });
  const d = query.data;
  return (
    <StateBlock loading={query.isLoading} error={query.isError ? query.error : null} onRetry={() => query.refetch()}>
      {d ? (
        <div className="rep-stack">
          <div className="rep-mini-grid">
            <div className="rep-mini-card">
              <span>Total Customers</span>
              <strong>{d.totalCustomers}</strong>
            </div>
            <div className="rep-mini-card">
              <span>New Signups (range)</span>
              <strong>{d.newSignups}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Booked in Range</span>
              <strong>{d.bookingCustomers}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Repeat Customers</span>
              <strong>{d.repeatCustomers}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Repeat Rate</span>
              <strong>{d.repeatRate == null ? "—" : `${d.repeatRate}%`}</strong>
            </div>
            <div className="rep-mini-card">
              <span>Inactive (booked before, not now)</span>
              <strong>{d.inactiveCount == null ? "—" : d.inactiveCount}</strong>
            </div>
          </div>

          <div className="rep-two-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>New Signups</h3>
              </div>
              {d.signupSeries.some((s) => s.count > 0) ? (
                <RepBars
                  items={d.signupSeries
                    .filter((s) => s.count > 0)
                    .slice(-14)
                    .map((s) => ({ label: s.date, value: s.count, display: String(s.count) }))}
                />
              ) : (
                <div className="rep-state">No new signups in this range.</div>
              )}
            </div>
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Top Customers</h3>
              </div>
              {d.topCustomers.length ? (
                <div className="rep-table-scroll">
                  <table className="admin-table rep-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Bookings</th>
                        <th>Spent</th>
                        <th>Last Booking</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topCustomers.map((c) => (
                        <tr key={c.customerId}>
                          <td>
                            <strong>{c.name}</strong>
                          </td>
                          <td>{c.bookings}</td>
                          <td>{money(c.spent)}</td>
                          <td>{repDate(c.lastBooking)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rep-state">No data available.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}

/* ════════════════ SERVICES TAB ════════════════ */
export function ServicesTab({ rq, qk }: Q) {
  const query = useQuery({
    queryKey: ["analytics", "services", qk],
    queryFn: () => getAnalyticsServices(rq),
  });
  const d = query.data;
  return (
    <StateBlock
      loading={query.isLoading}
      error={query.isError ? query.error : null}
      empty={!!d && d.services.length === 0}
      emptyText="No bookings in this range."
      onRetry={() => query.refetch()}
    >
      {d ? (
        <div className="rep-stack">
          <p className="rep-note">
            Add-on attach rate: <strong>{d.attachRate == null ? "—" : `${d.attachRate}%`}</strong> of{" "}
            {d.totalBookings} bookings
          </p>
          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Service Performance</h3>
            </div>
            <div className="rep-table-scroll">
              <table className="admin-table rep-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Bookings</th>
                    <th>Share</th>
                    <th>Revenue</th>
                    <th>Commission</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.services.map((s) => (
                    <tr key={s.serviceId}>
                      <td>
                        <strong>{s.title}</strong>
                        {s.basePrice != null ? <span className="rep-cell-sub">from {money(s.basePrice)}</span> : null}
                      </td>
                      <td>{s.bookings}</td>
                      <td>
                        <div className="rep-share">
                          <div className="rep-share-track">
                            <div className="rep-share-fill" style={{ width: `${s.share}%` }} />
                          </div>
                          <span>{s.share}%</span>
                        </div>
                      </td>
                      <td>{money(s.revenue)}</td>
                      <td>{money(s.commission)}</td>
                      <td>
                        {s.isActive == null ? (
                          "—"
                        ) : (
                          <span className={`rep-badge ${s.isActive ? "rep-badge-green" : "rep-badge-red"}`}>
                            {s.isActive ? "Active" : "Inactive"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Add-ons Performance</h3>
            </div>
            {d.addons.length ? (
              <div className="rep-table-scroll">
                <table className="admin-table rep-table">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th>Times Added</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.addons.map((a) => (
                      <tr key={a.name}>
                        <td>
                          <strong>{a.name}</strong>
                        </td>
                        <td>{a.times}</td>
                        <td>{money(a.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rep-state">No add-ons were added in this range.</div>
            )}
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}

/* ════════════════ FINANCIAL TAB ════════════════ */
export function FinancialTab({ rq, qk }: Q) {
  const query = useQuery({
    queryKey: ["analytics", "financial", qk],
    queryFn: () => getAnalyticsFinancial(rq),
  });
  const d = query.data;
  return (
    <StateBlock loading={query.isLoading} error={query.isError ? query.error : null} onRetry={() => query.refetch()}>
      {d ? (
        <div className="rep-stack">
          <div className="rep-mini-grid">
            <div className="rep-mini-card">
              <span>Paid Out</span>
              <strong>{money(d.paidOut.total)}</strong>
              <em>{d.paidOut.count} payouts</em>
            </div>
            <div className="rep-mini-card">
              <span>Refunds Processed</span>
              <strong>{money(d.refundsProcessed.total)}</strong>
              <em>{d.refundsProcessed.count} refunds</em>
            </div>
            <div className="rep-mini-card">
              <span>Wallet Top-ups</span>
              <strong>{money(d.walletTopups.total)}</strong>
              <em>{d.walletTopups.count} top-ups</em>
            </div>
            <div className="rep-mini-card">
              <span>Wallet Payments</span>
              <strong>{money(d.walletPayments.total)}</strong>
              <em>{d.walletPayments.count} payments</em>
            </div>
            <div className="rep-mini-card">
              <span>Commission Withdrawals</span>
              <strong>{money(d.commissionWithdrawals.total)}</strong>
              <em>{d.commissionWithdrawals.count} withdrawals</em>
            </div>
            <div className="rep-mini-card">
              <span>Stripe Balance</span>
              <strong>{d.stripe ? money(d.stripe.available) : "—"}</strong>
              <em>{d.stripe ? `Pending ${money(d.stripe.pending)} · ${d.stripe.currency}` : "Unavailable"}</em>
            </div>
          </div>

          <div className="rep-two-col">
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Collections by Method</h3>
              </div>
              <RepBars
                items={[
                  { label: "Card", value: d.methodSplit.card, display: money(d.methodSplit.card) },
                  { label: "Wallet", value: d.methodSplit.wallet, display: money(d.methodSplit.wallet) },
                ]}
              />
              <p className="rep-note">Collections from completed bookings — the same ledger as Payments &amp; Refunds.</p>
            </div>
            <div className="rep-card">
              <div className="rep-card-head">
                <h3>Payouts by Status</h3>
              </div>
              {d.payoutsByStatus.length ? (
                <div className="rep-table-scroll">
                  <table className="admin-table rep-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.payoutsByStatus.map((r) => (
                        <tr key={r.status}>
                          <td>{r.status}</td>
                          <td>{r.count}</td>
                          <td>{money(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rep-state">No payouts in this range.</div>
              )}
            </div>
          </div>

          <div className="rep-card">
            <div className="rep-card-head">
              <h3>Refunds by Status</h3>
            </div>
            {d.refundsByStatus.length ? (
              <div className="rep-table-scroll">
                <table className="admin-table rep-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.refundsByStatus.map((r) => (
                      <tr key={r.status}>
                        <td>{r.status}</td>
                        <td>{r.count}</td>
                        <td>{money(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rep-state">No refunds in this range.</div>
            )}
          </div>
        </div>
      ) : null}
    </StateBlock>
  );
}
