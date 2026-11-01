"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import {
  addAdminBookingNote,
  createAdminCommissionWithdrawal,
  createEarningAdjustment,
  createEarningsPayout,
  holdBookingEarning,
  payAdminPayoutManually,
  releaseBookingEarning,
  type AdminEarningEntry,
} from "@/lib/admin-api";
import { money } from "@/lib/format";
import { payErrMsg } from "../payments/PaymentsModals";

const EARN_KEYS = [
  ["admin-earnings-v2"],
  ["admin-earnings-adjustments"],
  ["admin-transactions"],
  ["dashboard-overview"],
  ["admin-commission-withdrawals"],
];

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pay-overlay" role="dialog" aria-modal="true">
      <div className="pay-modal">
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

function useInvalidateEarnings() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of EARN_KEYS) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

// ─── Send Payout ───
// Provider ke available balance se payout. Stripe (automatic) chuna
// ho to backend Connect par koshish karta hai; manual par payout
// bana kar isi waqt reference ke sath paid mark ho jata hai.
export function SendPayoutModal({
  providerId,
  providerName,
  available,
  defaultAmount,
  onClose,
}: {
  providerId: string;
  providerName: string;
  available: number;
  defaultAmount: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEarnings();
  const [amount, setAmount] = useState(
    Math.min(defaultAmount, available).toFixed(2)
  );
  const [method, setMethod] = useState<"stripe" | "manual">("stripe");
  const [reference, setReference] = useState("");
  const [done, setDone] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const payout = await createEarningsPayout({
        providerId,
        amount: Number(amount),
        autoAttempt: method === "stripe",
      });
      if (method === "manual") {
        const paid = await payAdminPayoutManually(payout._id, {
          reference: reference.trim(),
        });
        return paid.status;
      }
      return payout.status;
    },
    onSuccess: (status) => {
      invalidate();
      setDone(
        status === "paid"
          ? "Payout marked as paid."
          : status === "processing"
            ? "Sent via Stripe — it will show as Paid once Stripe confirms the payout."
            : "Payout created as pending. If the provider has not finished Stripe setup, it stays pending — you can pay it manually from Payments & Refunds."
      );
    },
  });
  const value = Number(amount);
  const invalid =
    !value || Number.isNaN(value) || value <= 0 || value > available;

  return (
    <ModalShell
      title="Send Payout"
      subtitle={`${providerName} · Available ${money(available)}`}
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Payout could not be created.")}</p>
      ) : null}
      {done ? <p className="pay-success">{done}</p> : null}
      <label className="pay-field">
        <span>Payout amount (£)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      {invalid && amount !== "" ? (
        <p className="pay-hint">
          Amount must be more than £0 and no more than the available{" "}
          {money(available)}.
        </p>
      ) : null}
      <div className="pay-radio-row">
        <label>
          <input
            type="radio"
            name="earn-payout-method"
            checked={method === "stripe"}
            onChange={() => setMethod("stripe")}
          />
          Stripe (automatic)
        </label>
        <label>
          <input
            type="radio"
            name="earn-payout-method"
            checked={method === "manual"}
            onChange={() => setMethod("manual")}
          />
          Bank transfer (manual)
        </label>
      </div>
      {method === "stripe" ? (
        <p className="pay-hint">
          Works when the provider finished Stripe setup. If not, the payout
          stays pending and can still be paid manually — nothing is lost.
        </p>
      ) : (
        <label className="pay-field">
          <span>Bank transfer reference</span>
          <input
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. bank ref / FPS id"
          />
        </label>
      )}
      <div className="pay-actions">
        <button type="button" className="pay-btn" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={invalid || mutation.isPending || Boolean(done)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Sending…" : "Send Payout"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Add Adjustment ───
export function AddAdjustmentModal({
  providers,
  fixedProviderId,
  bookingId,
  onClose,
}: {
  providers: { id: string; name: string }[];
  fixedProviderId?: string;
  bookingId?: string;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEarnings();
  const [providerId, setProviderId] = useState(fixedProviderId || "");
  const [type, setType] = useState<"bonus" | "deduction">("bonus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createEarningAdjustment({
        providerId,
        bookingId,
        type,
        amount: Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const value = Number(amount);
  const invalid =
    !providerId || !value || value <= 0 || reason.trim().length < 3;

  return (
    <ModalShell
      title="Add Adjustment"
      subtitle="A manual bonus or deduction on a provider's earnings — the reason is recorded."
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Adjustment could not be saved.")}</p>
      ) : null}
      {!fixedProviderId ? (
        <label className="pay-field">
          <span>Provider</span>
          <select
            value={providerId}
            onChange={(event) => setProviderId(event.target.value)}
          >
            <option value="">Select a provider…</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="pay-radio-row">
        <label>
          <input
            type="radio"
            name="earn-adj-type"
            checked={type === "bonus"}
            onChange={() => setType("bonus")}
          />
          Bonus (add earnings)
        </label>
        <label>
          <input
            type="radio"
            name="earn-adj-type"
            checked={type === "deduction"}
            onChange={() => setType("deduction")}
          />
          Deduction (subtract)
        </label>
      </div>
      <label className="pay-field">
        <span>Amount (£)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="pay-field">
        <span>Reason</span>
        <textarea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Referral bonus for high performance"
        />
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : "Add Adjustment"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Hold / Release ───
export function HoldEarningsModal({
  entry,
  onClose,
}: {
  entry: AdminEarningEntry;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEarnings();
  const [amount, setAmount] = useState(entry.netAmount.toFixed(2));
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      holdBookingEarning(entry.bookingId, {
        amount: Number(amount),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  const value = Number(amount);
  const invalid =
    !value || value <= 0 || value > entry.netAmount || reason.trim().length < 3;

  return (
    <ModalShell
      title="Hold Earnings"
      subtitle={`${entry.displayId} · Provider net ${money(entry.netAmount)}`}
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Hold could not be placed.")}</p>
      ) : null}
      <p className="pay-hint">
        Held earnings leave the provider&apos;s available balance until
        released. The provider is notified.
      </p>
      <label className="pay-field">
        <span>Hold amount (£)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <label className="pay-field">
        <span>Reason</span>
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Select a reason…</option>
          <option value="Dispute under review">Dispute under review</option>
          <option value="Customer complaint">Customer complaint</option>
          <option value="Suspected fraud">Suspected fraud</option>
          <option value="Other">Other</option>
        </select>
      </label>
      <div className="pay-actions">
        <button type="button" className="pay-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-danger"
          disabled={invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Holding…" : "Hold Earnings"}
        </button>
      </div>
    </ModalShell>
  );
}

export function ReleaseHoldModal({
  entry,
  onClose,
}: {
  entry: AdminEarningEntry;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEarnings();
  const mutation = useMutation({
    mutationFn: () => releaseBookingEarning(entry.bookingId),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });
  return (
    <ModalShell
      title="Release Hold"
      subtitle={`${entry.displayId} · Held ${money(entry.hold?.amount || 0)}`}
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Hold could not be released.")}</p>
      ) : null}
      <p className="pay-hint">
        This returns the held amount to the provider&apos;s available
        balance. Reason recorded: {entry.hold?.reason || "—"}.
      </p>
      <div className="pay-actions">
        <button type="button" className="pay-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Releasing…" : "Release Hold"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Withdraw commission ───
export function WithdrawCommissionModal({
  availableCommission,
  onClose,
}: {
  availableCommission: number;
  onClose: () => void;
}) {
  const invalidate = useInvalidateEarnings();
  const [amount, setAmount] = useState(availableCommission.toFixed(2));
  const [done, setDone] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      createAdminCommissionWithdrawal({ amount: Number(amount) }),
    onSuccess: () => {
      invalidate();
      setDone(
        "Withdrawal recorded — Stripe will process it to the platform bank account."
      );
    },
  });
  const value = Number(amount);
  const invalid = !value || value <= 0 || value > availableCommission;

  return (
    <ModalShell
      title="Withdraw Commission"
      subtitle={`Available commission ${money(availableCommission)}`}
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Withdrawal could not be recorded.")}</p>
      ) : null}
      {done ? <p className="pay-success">{done}</p> : null}
      <label className="pay-field">
        <span>Amount (£)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      {invalid && amount !== "" ? (
        <p className="pay-hint">
          Amount cannot exceed the available commission{" "}
          {money(availableCommission)}.
        </p>
      ) : null}
      <div className="pay-actions">
        <button type="button" className="pay-btn" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={invalid || mutation.isPending || Boolean(done)}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Recording…" : "Withdraw"}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Add Note (booking note — BKALL system) ───
export function EarnNoteModal({
  bookingId,
  displayId,
  onClose,
}: {
  bookingId: string;
  displayId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const mutation = useMutation({
    mutationFn: () => addAdminBookingNote(bookingId, text.trim()),
    onSuccess: onClose,
  });
  return (
    <ModalShell
      title="Add Note"
      subtitle={`${displayId} · Internal — the customer and provider cannot see this.`}
      onClose={onClose}
    >
      {mutation.isError ? (
        <p className="pay-error">{payErrMsg(mutation.error, "Note could not be saved.")}</p>
      ) : null}
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
        <button type="button" className="pay-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pay-btn pay-btn-primary"
          disabled={text.trim().length < 2 || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Saving…" : "Save Note"}
        </button>
      </div>
    </ModalShell>
  );
}
