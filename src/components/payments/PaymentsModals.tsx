"use client";

import {
  createAdminTransactionNote,
  decideAdminRefund,
  getAdminTransactionDetail,
  issueAdminRefund,
  payAdminPayoutManually,
  processAdminRefund,
  retryAdminPayout,
  updateAdminPayoutStatusV2,
  type AdminReconciliation,
  type AdminTransactionRow,
} from "@/lib/admin-api";
import { initials, money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TriangleAlert, X } from "lucide-react";
import { useState } from "react";

// ─── Shared payments helpers (page + modals dono use karte hain) ───

export const PAY_STATUS_LABELS: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  processing: "Processing",
  failed: "Failed",
  refunded: "Refunded",
  requested: "Requested",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

export const REFUND_CATEGORIES: { value: string; label: string }[] = [
  { value: "service_not_as_described", label: "Service not as described" },
  { value: "provider_no_show", label: "Provider no-show" },
  { value: "customer_cancelled", label: "Customer cancelled" },
  { value: "duplicate_charge", label: "Duplicate charge" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "other", label: "Other" },
];

const londonFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const londonFmtTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const payFmtDate = (value?: string | null) =>
  value ? londonFmt.format(new Date(value)) : "—";
export const payFmtDateTime = (value?: string | null) =>
  value ? londonFmtTime.format(new Date(value)) : "—";

export const payErrMsg = (error: unknown, fallback: string) => {
  const anyErr = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return anyErr?.response?.data?.message || anyErr?.message || fallback;
};

function PayModalShell({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="pay-overlay" onClick={onClose}>
      <div
        className={`pay-modal${wide ? " pay-modal-wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="pay-modal-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="pay-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="pay-modal-body">{children}</div>
      </div>
    </div>
  );
}

function PayError({ message }: { message: string }) {
  if (!message) return null;
  return <div className="pay-error">{message}</div>;
}

// ─── Issue Refund (payment row se) ───────────────────────────────

export function IssueRefundModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(row.amount || ""));
  const [reasonCategory, setReasonCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      issueAdminRefund(row.bookingId || "", {
        amount: Number(amount),
        reason: reason.trim(),
        reasonCategory,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Refund failed. Please try again.")),
  });

  return (
    <PayModalShell
      title="Issue Refund"
      subtitle={`${row.txnNumber || "Payment"} · ${row.customer?.name || "Customer"}`}
      onClose={onClose}
    >
      <PayError message={error} />
      <div className="pay-kv">
        <span>Payment amount</span>
        <strong>{money(row.amount)}</strong>
      </div>
      <div className="pay-kv">
        <span>Method</span>
        <strong>{row.method}</strong>
      </div>
      <p className="pay-hint">
        The refund goes back the way it was paid: any wallet part is credited to the
        customer&apos;s wallet instantly, the card part returns via Stripe in 3–10
        working days. If part of this payment was already refunded, the server only
        allows the remaining amount.
      </p>
      <label className="pay-field">
        <span>Refund amount (£)</span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="pay-field">
        <span>Reason category</span>
        <select value={reasonCategory} onChange={(event) => setReasonCategory(event.target.value)}>
          {REFUND_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </label>
      <label className="pay-field">
        <span>Reason (shown in the record)</span>
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Why is this being refunded?"
        />
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-danger"
          disabled={mutation.isPending || !row.bookingId || !(Number(amount) > 0)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Processing…" : `Refund ${money(Number(amount) || 0)}`}
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Refund Review (refund queue ki row se) ──────────────────────

export function RefundReviewModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(String(row.amount || ""));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["admin-transaction-detail", "refund", row.id],
    queryFn: () => getAdminTransactionDetail("refund", row.id),
  });
  const detail = detailQuery.data;
  const record = detail?.record as
    | (Record<string, unknown> & { reason?: string; walletPortion?: number; cardPortion?: number })
    | undefined;
  const booking = detail?.booking as
    | { finalPrice?: number; price?: number; commissionRate?: number | null; providerNetAmount?: number | null }
    | null;
  const payment = detail?.payment as { price?: number; walletAmount?: number; cardAmount?: number } | null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
  };

  const decideMutation = useMutation({
    mutationFn: (decision: "approve" | "reject" | "more_info") =>
      decideAdminRefund(row.id, {
        decision,
        amount: decision === "approve" ? Number(amount) : undefined,
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Could not save the decision.")),
  });

  const processMutation = useMutation({
    mutationFn: () => processAdminRefund(row.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Processing failed.")),
  });

  const busy = decideMutation.isPending || processMutation.isPending;
  const isDecidable = row.status === "requested" || row.status === "under_review";

  return (
    <PayModalShell
      title="Review Refund"
      subtitle={`${row.txnNumber || "Refund"} · ${PAY_STATUS_LABELS[row.status] || row.status}`}
      onClose={onClose}
      wide
    >
      <PayError message={error} />
      {detailQuery.isLoading ? (
        <p className="pay-hint">Loading refund details…</p>
      ) : detailQuery.isError ? (
        <p className="pay-hint">Could not load the full details — the summary below is from the list.</p>
      ) : null}

      <div className="pay-kv">
        <span>Customer</span>
        <strong>{row.customer?.name || "—"}</strong>
      </div>
      <div className="pay-kv">
        <span>Provider</span>
        <strong>{row.provider?.name || "—"}</strong>
      </div>
      <div className="pay-kv">
        <span>Booking total</span>
        <strong>{booking ? money(booking.finalPrice ?? booking.price ?? 0) : "—"}</strong>
      </div>
      <div className="pay-kv">
        <span>Paid by</span>
        <strong>
          {payment
            ? payment.walletAmount && payment.walletAmount > 0 && payment.cardAmount && payment.cardAmount > 0
              ? `Wallet ${money(payment.walletAmount)} + Card ${money(payment.cardAmount)}`
              : payment.walletAmount && payment.walletAmount > 0
                ? `Wallet ${money(payment.walletAmount)}`
                : `Card ${money(payment.cardAmount ?? payment.price ?? 0)}`
            : row.method}
        </strong>
      </div>
      <div className="pay-kv">
        <span>Customer&apos;s reason</span>
        <strong>{record?.reason ? String(record.reason) : "No reason given"}</strong>
      </div>
      {booking?.providerNetAmount !== null && booking?.providerNetAmount !== undefined ? (
        <div className="pay-kv">
          <span>Provider earning on this booking</span>
          <strong>
            {money(booking.providerNetAmount)}
            {booking.commissionRate !== null && booking.commissionRate !== undefined
              ? ` (after ${Math.round(booking.commissionRate * 100)}% commission)`
              : ""}
          </strong>
        </div>
      ) : null}

      {isDecidable ? (
        <>
          <label className="pay-field">
            <span>Approve amount (£) — full or partial</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="pay-field">
            <span>Admin note (internal)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note saved with this decision"
            />
          </label>
          {confirmReject ? (
            <div className="pay-confirm">
              <p>Reject this refund request? The customer will be notified.</p>
              <div className="pay-actions">
                <button type="button" className="pay-btn pay-btn-ghost" onClick={() => setConfirmReject(false)}>
                  Back
                </button>
                <button
                  type="button"
                  className="pay-btn pay-btn-danger"
                  disabled={busy}
                  onClick={() => decideMutation.mutate("reject")}
                >
                  {decideMutation.isPending ? "Saving…" : "Yes, reject"}
                </button>
              </div>
            </div>
          ) : (
            <div className="pay-actions pay-actions-3">
              <button
                type="button"
                className="pay-btn pay-btn-ghost"
                disabled={busy}
                onClick={() => decideMutation.mutate("more_info")}
              >
                Need more info
              </button>
              <button
                type="button"
                className="pay-btn pay-btn-danger-outline"
                disabled={busy}
                onClick={() => setConfirmReject(true)}
              >
                Reject
              </button>
              <button
                type="button"
                className="pay-btn pay-btn-primary"
                disabled={busy || !(Number(amount) > 0)}
                onClick={() => decideMutation.mutate("approve")}
              >
                {decideMutation.isPending ? "Processing…" : `Approve & refund ${money(Number(amount) || 0)}`}
              </button>
            </div>
          )}
        </>
      ) : row.status === "approved" ? (
        <>
          <p className="pay-hint">
            This refund was approved but has not completed yet (for example, Stripe
            failed earlier). You can try processing it again.
          </p>
          <div className="pay-actions">
            <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="pay-btn pay-btn-primary"
              disabled={busy}
              onClick={() => processMutation.mutate()}
            >
              {processMutation.isPending ? "Processing…" : "Process now"}
            </button>
          </div>
        </>
      ) : (
        <div className="pay-actions">
          <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      )}
    </PayModalShell>
  );
}

// ─── Payout: Pay Manually ────────────────────────────────────────

export function PayManuallyModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      payAdminPayoutManually(row.id, {
        reference: reference.trim(),
        note: note.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Could not mark the payout as paid.")),
  });

  return (
    <PayModalShell
      title="Pay Manually"
      subtitle={`${row.txnNumber || "Payout"} · ${row.provider?.name || "Provider"}`}
      onClose={onClose}
    >
      <PayError message={error} />
      <p className="pay-hint">
        Use this only after you have actually sent {money(row.amount)} to the
        provider&apos;s bank account yourself. This records the payment — it does
        not move any money.
      </p>
      <label className="pay-field">
        <span>Bank transfer reference</span>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="e.g. bank reference or Faster Payments ID"
        />
      </label>
      <label className="pay-field">
        <span>Note (optional)</span>
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : `Mark ${money(row.amount)} as paid`}
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Payout: Retry Automatic ─────────────────────────────────────

export function RetryPayoutModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const mutation = useMutation({
    mutationFn: () => retryAdminPayout(row.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
      if (data?.status === "processing") {
        setResult("Transfer sent to Stripe — it will show as Paid once the bank confirms.");
      } else if (data?.status === "failed") {
        setError("Stripe rejected the transfer again. Check the failure reason in the details, or pay manually.");
      } else {
        setResult("The provider has not finished Stripe setup, so the payout stays queued. You can pay manually instead.");
      }
    },
    onError: (err) => setError(payErrMsg(err, "Retry failed.")),
  });

  return (
    <PayModalShell
      title="Retry Automatic Payout"
      subtitle={`${row.txnNumber || "Payout"} · ${row.provider?.name || "Provider"}`}
      onClose={onClose}
    >
      <PayError message={error} />
      {result ? <div className="pay-success">{result}</div> : null}
      <p className="pay-hint">
        This tries the Stripe Connect transfer again for {money(row.amount)}. A
        payout can never be sent twice — the same payout record is reused.
      </p>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={mutation.isPending || !!result}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Trying…" : "Retry transfer"}
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Payout: Mark as Failed ──────────────────────────────────────

export function MarkPayoutFailedModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      updateAdminPayoutStatusV2(row.id, { status: "failed", failureReason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Could not update the payout.")),
  });

  return (
    <PayModalShell
      title="Mark Payout as Failed"
      subtitle={`${row.txnNumber || "Payout"} · ${row.provider?.name || "Provider"}`}
      onClose={onClose}
    >
      <PayError message={error} />
      <p className="pay-hint">
        The provider will see this payout as failed and will be notified. The money
        stays in their available balance, so it can be paid again later.
      </p>
      <label className="pay-field">
        <span>Failure reason (required)</span>
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Bank account closed, details incorrect…"
        />
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-danger"
          disabled={mutation.isPending || !reason.trim()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : "Mark as failed"}
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Add Note ────────────────────────────────────────────────────

export function TransactionNoteModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "customer">("internal");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createAdminTransactionNote({
        sourceType: row.sourceType,
        sourceId: row.id,
        text: text.trim(),
        visibility,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
      onClose();
    },
    onError: (err) => setError(payErrMsg(err, "Could not save the note.")),
  });

  return (
    <PayModalShell
      title="Add Note"
      subtitle={row.txnNumber || "Transaction"}
      onClose={onClose}
    >
      <PayError message={error} />
      <div className="pay-radio-row">
        <label>
          <input
            type="radio"
            name="note-visibility"
            checked={visibility === "internal"}
            onChange={() => setVisibility("internal")}
          />
          Internal (team only)
        </label>
        <label>
          <input
            type="radio"
            name="note-visibility"
            checked={visibility === "customer"}
            onChange={() => setVisibility("customer")}
          />
          Customer can see
        </label>
      </div>
      <label className="pay-field">
        <span>Note</span>
        <textarea
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Write the note…"
        />
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={mutation.isPending || !text.trim()}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : "Save note"}
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Receipt ─────────────────────────────────────────────────────

export function ReceiptModal({
  row,
  onClose,
}: {
  row: AdminTransactionRow;
  onClose: () => void;
}) {
  const detailQuery = useQuery({
    queryKey: ["admin-transaction-detail", row.sourceType, row.id],
    queryFn: () => getAdminTransactionDetail(row.sourceType, row.id),
  });
  const detail = detailQuery.data;
  const record = (detail?.record || {}) as Record<string, unknown>;

  const printReceipt = () => {
    const win = window.open("", "_blank", "width=720,height=900");
    if (!win) return;
    const party =
      row.sourceType === "payout"
        ? `Provider: ${row.provider?.name || "—"} (${row.provider?.email || "—"})`
        : `Customer: ${row.customer?.name || "—"} (${row.customer?.email || "—"})`;
    win.document.write(`<!doctype html><html><head><title>Receipt ${row.txnNumber || ""}</title>
      <style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:20px;margin:0 0 4px}
      .muted{color:#666;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:16px}
      td{padding:8px 0;border-bottom:1px solid #eee;font-size:14px}td:last-child{text-align:right;font-weight:600}
      .total{font-size:16px}</style></head><body>
      <h1>OWVO — ${row.sourceType === "payout" ? "Payout" : row.sourceType === "refund" ? "Refund" : "Payment"} Receipt</h1>
      <div class="muted">${row.txnNumber || ""} · ${payFmtDateTime(row.createdAt)}</div>
      <table>
      <tr><td>Type</td><td>${row.kind}</td></tr>
      <tr><td>Status</td><td>${PAY_STATUS_LABELS[row.status] || row.status}</td></tr>
      <tr><td>Method</td><td>${row.method}</td></tr>
      <tr><td>${party}</td><td></td></tr>
      ${row.bookingId ? `<tr><td>Booking</td><td>${String(row.bookingId)}</td></tr>` : ""}
      <tr class="total"><td>Amount</td><td>${row.direction === "out" ? "−" : ""}${money(row.amount)}</td></tr>
      </table>
      <p class="muted" style="margin-top:24px">Generated from the OWVO admin panel.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <PayModalShell title="Receipt" subtitle={row.txnNumber || "Transaction"} onClose={onClose}>
      {detailQuery.isLoading ? <p className="pay-hint">Loading…</p> : null}
      <div className="pay-kv">
        <span>Type</span>
        <strong style={{ textTransform: "capitalize" }}>{row.kind}</strong>
      </div>
      <div className="pay-kv">
        <span>Status</span>
        <strong>{PAY_STATUS_LABELS[row.status] || row.status}</strong>
      </div>
      <div className="pay-kv">
        <span>{row.sourceType === "payout" ? "Provider" : "Customer"}</span>
        <strong>
          {(row.sourceType === "payout" ? row.provider?.name : row.customer?.name) || "—"}
        </strong>
      </div>
      <div className="pay-kv">
        <span>Method</span>
        <strong>{row.method}</strong>
      </div>
      <div className="pay-kv">
        <span>Date</span>
        <strong>{payFmtDateTime(row.createdAt)}</strong>
      </div>
      {record.transactionId ? (
        <div className="pay-kv">
          <span>Stripe reference</span>
          <strong>{String(record.transactionId)}</strong>
        </div>
      ) : null}
      {record.stripeTransferId ? (
        <div className="pay-kv">
          <span>Stripe transfer</span>
          <strong>{String(record.stripeTransferId)}</strong>
        </div>
      ) : null}
      {record.stripeRefundId ? (
        <div className="pay-kv">
          <span>Stripe refund</span>
          <strong>{String(record.stripeRefundId)}</strong>
        </div>
      ) : null}
      <div className="pay-kv pay-kv-total">
        <span>Amount</span>
        <strong>
          {row.direction === "out" ? "−" : "+"}
          {money(row.amount)}
        </strong>
      </div>
      <div className="pay-actions">
        <button type="button" className="pay-btn pay-btn-ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="pay-btn pay-btn-primary" onClick={printReceipt}>
          Print / Save PDF
        </button>
      </div>
    </PayModalShell>
  );
}

// ─── Reconciliation ──────────────────────────────────────────────

export function ReconciliationModal({
  data,
  isLoading,
  isError,
  onRetry,
  onClose,
}: {
  data?: AdminReconciliation;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const issues = data?.issues;
  const total = data?.counts?.total || 0;
  return (
    <PayModalShell
      title="Reconciliation & Reports"
      subtitle="OWVO ledger vs Stripe — differences that need a human look"
      onClose={onClose}
      wide
    >
      {isLoading ? <p className="pay-hint">Checking with Stripe…</p> : null}
      {isError ? (
        <>
          <div className="pay-error">Could not complete the reconciliation check.</div>
          <div className="pay-actions">
            <button type="button" className="pay-btn pay-btn-primary" onClick={onRetry}>
              Try again
            </button>
          </div>
        </>
      ) : null}
      {data ? (
        <>
          {data.stripeError ? <div className="pay-error">{data.stripeError}</div> : null}
          {data.stripeBalance ? (
            <div className="pay-kv">
              <span>Stripe balance (available)</span>
              <strong>
                {data.stripeBalance.available.length
                  ? data.stripeBalance.available
                      .map((b) => `${b.currency} ${b.amount.toFixed(2)}`)
                      .join(" · ")
                  : "—"}
              </strong>
            </div>
          ) : null}
          {total === 0 && !data.stripeError ? (
            <div className="pay-success">
              Everything matches — no differences between the ledger and Stripe right now.
            </div>
          ) : null}

          {issues && issues.stripeRefundsNotRecorded.length > 0 ? (
            <div className="pay-issue">
              <h4>
                <TriangleAlert size={15} /> Refunds in Stripe but not in the ledger (
                {issues.stripeRefundsNotRecorded.length})
              </h4>
              {issues.stripeRefundsNotRecorded.map((item) => (
                <div className="pay-kv" key={item.stripeRefundId}>
                  <span>
                    {item.stripeRefundId}
                    {item.bookingId ? ` · booking ${String(item.bookingId).slice(-6)}` : ""}
                  </span>
                  <strong>{money(item.amount)}</strong>
                </div>
              ))}
              <p className="pay-hint">
                These are normally recorded automatically by the webhook within
                moments — if one stays here, the webhook may have missed it.
              </p>
            </div>
          ) : null}

          {issues && issues.stuckPayouts.length > 0 ? (
            <div className="pay-issue">
              <h4>
                <TriangleAlert size={15} /> Payouts stuck in Processing over 7 days (
                {issues.stuckPayouts.length})
              </h4>
              {issues.stuckPayouts.map((item) => (
                <div className="pay-kv" key={String(item._id)}>
                  <span>{item.txnNumber || "Payout"}</span>
                  <strong>{money(item.amount || 0)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {issues && issues.paidPaymentsBookingNotPaid.length > 0 ? (
            <div className="pay-issue">
              <h4>
                <TriangleAlert size={15} /> Payments taken but booking not marked paid (
                {issues.paidPaymentsBookingNotPaid.length})
              </h4>
              {issues.paidPaymentsBookingNotPaid.map((item) => (
                <div className="pay-kv" key={String(item._id)}>
                  <span>{item.transactionId}</span>
                  <strong>{money(item.price || 0)}</strong>
                </div>
              ))}
            </div>
          ) : null}

          {issues && issues.stuckRefunds.length > 0 ? (
            <div className="pay-issue">
              <h4>
                <TriangleAlert size={15} /> Approved refunds not completed in 24h (
                {issues.stuckRefunds.length})
              </h4>
              {issues.stuckRefunds.map((item) => (
                <div className="pay-kv" key={String(item._id)}>
                  <span>{item.txnNumber || "Refund"}</span>
                  <strong>{money(item.amount || 0)}</strong>
                </div>
              ))}
              <p className="pay-hint">
                Open the refund from the Refunds filter and use “Process now”.
              </p>
            </div>
          ) : null}

          <p className="pay-hint">Last checked: {payFmtDateTime(data.checkedAt)}</p>
        </>
      ) : null}
    </PayModalShell>
  );
}

// Avatar helper (page bhi istemal kar sakta hai)
export function PayAvatar({ name }: { name?: string }) {
  return <span className="pay-avatar">{initials(name || "?")}</span>;
}
