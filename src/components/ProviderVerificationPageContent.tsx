"use client";

import {
  getProviderVerifications,
  sendVerificationReminder,
  updateProviderEnforcement,
  updateProviderVerification,
  updateProviderVerificationDetails,
  type ProviderVerification,
  type VerificationDetailsPayload,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  BellRing,
  CircleAlert,
  Copy,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState } from "react";

const verificationFilters = [
  { value: "all", label: "All" },
  { value: "not_approved", label: "Not Approved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function hasUrl(value?: { url?: string }) {
  return Boolean(value?.url);
}

function resolvePhotoUrl(url?: string) {
  const value = url?.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${SOCKET_URL}${path}`;
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={done ? "check-item done" : "check-item"}>
      {done ? <BadgeCheck size={14} /> : <CircleAlert size={14} />}
      {label}
    </span>
  );
}

function DocumentLink({ label, url }: { label: string; url?: string }) {
  const resolvedUrl = resolvePhotoUrl(url);
  const [copied, setCopied] = useState(false);

  return (
    <div className={resolvedUrl ? "doc-link ready" : "doc-link"}>
      <a
        className="doc-link-open"
        href={resolvedUrl || "#"}
        onClick={(event) => {
          if (!resolvedUrl) event.preventDefault();
        }}
        rel="noreferrer"
        target="_blank"
      >
        {label}
        <span>{resolvedUrl ? "Open" : "Missing"}</span>
      </a>
      {resolvedUrl ? (
        <div className="doc-link-tools">
          <a
            aria-label={`Download ${label}`}
            download
            href={resolvedUrl}
            rel="noreferrer"
            target="_blank"
            title="Download"
          >
            <Download size={13} />
          </a>
          <button
            aria-label={`Copy link to ${label}`}
            onClick={async (event) => {
              event.preventDefault();
              try {
                await navigator.clipboard.writeText(resolvedUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                // Clipboard access denied — koi bhi karwa nahi tootega,
                // bas visual feedback nahi milega.
              }
            }}
            title="Copy link"
            type="button"
          >
            {copied ? <BadgeCheck size={13} /> : <Copy size={13} />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
function formatBankDate(value?: string) {
  if (!value) return "Not added";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BankDetailsReview({ provider }: { provider: ProviderVerification }) {
  const bank = provider.bankDetails || {};
  const rows = [
    ["Account holder", bank.accountHolderName],
    ["Address", bank.address],
    ["City", bank.city],
    ["Postcode", bank.postcode],
    ["Date of birth", formatBankDate(bank.dateOfBirth)],
    ["Account number", bank.accountNumber],
    ["Sort code", bank.sortCode],
  ];

  return (
    <div className="bank-details-review">
      {rows.map(([label, value]) => (
        <p key={label}>
          <strong>{label}</strong>
          <span>{value || "Not added"}</span>
        </p>
      ))}
    </div>
  );
}

function StatusToggle({
  value,
  onChange,
  disabled,
}: {
  value: "pending" | "verified" | "rejected";
  onChange: (next: "pending" | "verified" | "rejected") => void;
  disabled: boolean;
}) {
  const options: Array<"pending" | "verified" | "rejected"> = [
    "pending",
    "verified",
    "rejected",
  ];
  return (
    <div className="status-toggle">
      {options.map((option) => (
        <button
          className={value === option ? "status-toggle-pill active" : "status-toggle-pill"}
          disabled={disabled}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const drivewayChecklistFields: Array<{
  key: keyof NonNullable<ProviderVerification["drivewayEligibility"]>;
  label: string;
}> = [
  { key: "isPrivateProperty", label: "Private property" },
  { key: "oneCarSpaceOnly", label: "Suitable for one vehicle" },
  { key: "noRoadPayment", label: "Does not block the road" },
  { key: "hasPermission", label: "Landlord permission (if applicable)" },
  { key: "isSafeWorkingArea", label: "Safe working area" },
  { key: "isResidentialAreaSuitable", label: "Residential area suitable for washing" },
];

function VerificationDetailsPanel({ provider }: { provider: ProviderVerification }) {
  const queryClient = useQueryClient();

  const [niStatus, setNiStatus] = useState(provider.nationalInsuranceStatus || "pending");
  const insurance = provider.publicLiabilityInsurance;
  const [policyNumber, setPolicyNumber] = useState(insurance?.policyNumber || "");
  const [insuranceCompany, setInsuranceCompany] = useState(insurance?.insuranceCompany || "");
  const [expiryDate, setExpiryDate] = useState(
    insurance?.expiryDate ? insurance.expiryDate.slice(0, 10) : ""
  );
  const [insuranceStatus, setInsuranceStatus] = useState(insurance?.status || "pending");
  const [driveway, setDriveway] = useState(provider.drivewayEligibility || {});
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderSent, setReminderSent] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: VerificationDetailsPayload) =>
      updateProviderVerificationDetails(provider._id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-verifications"] });
    },
  });

  const reminderMutation = useMutation({
    mutationFn: (message?: string) => sendVerificationReminder(provider._id, message),
    onSuccess: () => {
      setReminderSent(true);
      setTimeout(() => setReminderSent(false), 3000);
      setReminderMessage("");
    },
  });

  const expiringSoon =
    insurance?.expiryDate &&
    new Date(insurance.expiryDate).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 30;

  return (
    <div className="verification-details-panel">
      <div className="verification-details-row">
        <div>
          <strong>National Insurance</strong>
          <span className="verification-details-subtext">
            {provider.nationalInsuranceNumber || "Not added"}
          </span>
        </div>
        <StatusToggle
          disabled={mutation.isPending}
          onChange={(next) => {
            setNiStatus(next);
            mutation.mutate({ nationalInsuranceStatus: next });
          }}
          value={niStatus}
        />
      </div>

      <div className="verification-details-row verification-details-row-stack">
        <div className="verification-details-header">
          <strong>Public Liability Insurance</strong>
          {expiringSoon ? (
            <span className="table-status rejected">Expiring soon</span>
          ) : null}
        </div>
        <div className="verification-details-grid">
          <label>
            Policy number
            <input
              onChange={(e) => setPolicyNumber(e.target.value)}
              type="text"
              value={policyNumber}
            />
          </label>
          <label>
            Insurance company
            <input
              onChange={(e) => setInsuranceCompany(e.target.value)}
              type="text"
              value={insuranceCompany}
            />
          </label>
          <label>
            Expiry date
            <input
              onChange={(e) => setExpiryDate(e.target.value)}
              type="date"
              value={expiryDate}
            />
          </label>
        </div>
        <div className="verification-details-footer">
          <StatusToggle
            disabled={mutation.isPending}
            onChange={setInsuranceStatus}
            value={insuranceStatus}
          />
          <button
            className="table-action"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                insurance: {
                  policyNumber,
                  insuranceCompany,
                  expiryDate: expiryDate || undefined,
                  status: insuranceStatus,
                },
              })
            }
            type="button"
          >
            {mutation.isPending ? "Saving…" : "Save insurance"}
          </button>
        </div>
      </div>

      <div className="verification-details-row verification-details-row-stack">
        <strong>Driveway checklist</strong>
        <div className="driveway-checklist-grid">
          {drivewayChecklistFields.map(({ key, label }) => (
            <label className="check-label compact-check" key={key}>
              <input
                checked={Boolean(driveway[key])}
                onChange={(e) => {
                  const next = { ...driveway, [key]: e.target.checked };
                  setDriveway(next);
                  mutation.mutate({ driveway: { [key]: e.target.checked } });
                }}
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="verification-details-row verification-details-row-stack">
        <strong>Send reminder</strong>
        <p className="verification-details-subtext">
          Sends a notification to the provider about any missing documents. Leave the
          message blank to auto-generate one from what&apos;s currently missing.
        </p>
        <textarea
          onChange={(e) => setReminderMessage(e.target.value)}
          placeholder="Optional custom message…"
          rows={2}
          value={reminderMessage}
        />
        {reminderMutation.isError ? (
          <p className="form-error">
            {(reminderMutation.error as { response?: { data?: { message?: string } } })
              ?.response?.data?.message || "Could not send reminder."}
          </p>
        ) : null}
        <div className="verification-details-footer">
          {reminderSent ? (
            <span className="table-status approved">
              <BadgeCheck size={13} /> Reminder sent
            </span>
          ) : (
            <span />
          )}
          <button
            className="table-action"
            disabled={reminderMutation.isPending}
            onClick={() => reminderMutation.mutate(reminderMessage.trim() || undefined)}
            type="button"
          >
            <BellRing size={14} />
            {reminderMutation.isPending ? "Sending…" : "Send reminder"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onApprove,
  onBlock,
  onReject,
  onRestore,
  busy,
}: {
  provider: ProviderVerification;
  onApprove: (providerId: string) => void;
  onBlock: (providerId: string) => void;
  onReject: (providerId: string, reason: string) => void;
  onRestore: (providerId: string) => void;
  busy: boolean;
}) {
  const status = provider.adminVerification?.status || "not_submitted";
  const statusLabel = status === "not_submitted" ? "not approved" : status.replace("_", " ");
  const providerPhotoUrl = resolvePhotoUrl(provider.photo?.url);
  const enforcementStatus = provider.enforcement?.status || "clear";
  const isBlocked = ["suspended", "banned"].includes(enforcementStatus);
  const address = provider.providerAddress;
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showBankDetails, setShowBankDetails] = useState(false);
  const bank = provider.bankDetails || {};
  const hasBankDetails = Boolean(
    bank.accountHolderName &&
      bank.address &&
      bank.city &&
      bank.postcode &&
      bank.dateOfBirth &&
      bank.accountNumber &&
      bank.sortCode
  );
  const publicLiabilityInsuranceUrl =
    provider.publicLiabilityInsurance?.document?.url || provider.insurance?.document?.url;
  const drivewayPhotoUrl = provider.drivewayPhoto?.document?.url;
  const entrancePhotoUrl = provider.entrancePhoto?.document?.url;
  const [showDetails, setShowDetails] = useState(false);

  const missingDocuments = [
    !hasUrl(provider.photo) ? "Selfie photo" : null,
    !hasUrl(provider.identityVerification?.passportOrDrivingLicenseFile)
      ? "Passport / Licence"
      : null,
    !publicLiabilityInsuranceUrl ? "Public Liability Insurance" : null,
    !drivewayPhotoUrl ? "Driveway Photo" : null,
    !hasBankDetails ? "Bank Details" : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="verification-card">
      <div className="verification-card-top">
        {providerPhotoUrl ? (
          <span className="provider-avatar provider-avatar-image">
            <span>{(provider.name || "W").slice(0, 1).toUpperCase()}</span>
            <img
              alt={provider.name || "Provider"}
              src={providerPhotoUrl}
              onError={(event) => {
                event.currentTarget.remove();
              }}
            />
          </span>
        ) : (
          <div className="provider-avatar">{(provider.name || "W").slice(0, 1).toUpperCase()}</div>
        )}
        <div>
          <h2>{provider.name || "Unnamed washer"}</h2>
          <p>{provider.email || "No email"} · {provider.phoneNumber || "No phone"}</p>
          <div className="status-row">
            <span className={`table-status ${status}`}>{statusLabel}</span>
            {status === "approved" ? (
              <span className={`table-status ${isBlocked ? enforcementStatus : "approved"}`}>
                {isBlocked ? enforcementStatus : "active"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="verification-meta">
        <p>
          <strong>Service area</strong>
          <span>{provider.serviceArea || "Not added"}</span>
        </p>
        <p>
          <strong>Address</strong>
          <span>
            {[address?.streetAddress, address?.city, address?.postcode].filter(Boolean).join(", ") ||
              "Not added"}
          </span>
        </p>
      </div>
      <div className="verification-checklist">
        <ChecklistItem done={hasUrl(provider.photo)} label="Selfie photo" />
        <ChecklistItem
          done={hasUrl(provider.identityVerification?.passportOrDrivingLicenseFile)}
          label="Passport / licence"
        />
        <ChecklistItem done={Boolean(publicLiabilityInsuranceUrl)} label="Public liability insurance" />
        <ChecklistItem done={Boolean(drivewayPhotoUrl)} label="Driveway photo" />
        <ChecklistItem done={hasBankDetails} label="Bank details" />
        <ChecklistItem
          done={provider.nationalInsuranceStatus === "verified"}
          label="National Insurance"
        />
        <ChecklistItem
          done={drivewayChecklistFields.every(({ key }) => Boolean(provider.drivewayEligibility?.[key]))}
          label="Driveway checklist"
        />
      </div>
      <div className="document-grid">
        <DocumentLink label="Selfie" url={provider.photo?.url} />
        <DocumentLink
          label="Passport / Licence"
          url={provider.identityVerification?.passportOrDrivingLicenseFile?.url}
        />
        <DocumentLink label="Public Liability Insurance" url={publicLiabilityInsuranceUrl} />
        <DocumentLink label="Driveway Photo" url={drivewayPhotoUrl} />
        <DocumentLink label="Entrance Photo" url={entrancePhotoUrl} />
        <button
          className={hasBankDetails ? "doc-link ready doc-link-button" : "doc-link doc-link-button"}
          onClick={() => setShowBankDetails((value) => !value)}
          type="button"
        >
          Bank Details
          <span>{hasBankDetails ? (showBankDetails ? "Hide" : "View") : "Missing"}</span>
        </button>
        <button
          className="doc-link ready doc-link-button"
          onClick={() => setShowDetails((value) => !value)}
          type="button"
        >
          NI, Insurance & Driveway
          <span>{showDetails ? "Hide" : "View"}</span>
        </button>
      </div>
      {showBankDetails ? <BankDetailsReview provider={provider} /> : null}
      {showDetails ? <VerificationDetailsPanel provider={provider} /> : null}
      <div className="verification-actions">
        {status === "approved" ? (
          isBlocked ? (
            <button
              className="approve-action"
              disabled={busy}
              onClick={() => onRestore(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <Undo2 size={15} />}
              Restore Access
            </button>
          ) : (
            <button
              className="outline-action"
              disabled={busy}
              onClick={() => onBlock(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <XCircle size={15} />}
              Block Provider
            </button>
          )
        ) : (
          <>
            <button
              className="outline-action"
              disabled={busy}
              onClick={() => setRejectDialogOpen(true)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <XCircle size={15} />}
              Reject
            </button>
            <button
              className="approve-action"
              disabled={busy}
              onClick={() => onApprove(provider._id)}
              type="button"
            >
              {busy ? <Loader2 size={15} /> : <ShieldCheck size={15} />}
              Approve
            </button>
          </>
        )}
      </div>
      {rejectDialogOpen ? (
        <div
          className="training-modal-overlay"
          onClick={() => setRejectDialogOpen(false)}
          role="presentation"
        >
          <div
            className="training-modal-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2>Reject {provider.name || "provider"}?</h2>
            {missingDocuments.length > 0 ? (
              <p className="verification-details-subtext">
                Currently missing: {missingDocuments.join(", ")}. This will be included in
                the message sent to the provider automatically.
              </p>
            ) : null}
            <label className="form-field">
              Reason for rejection
              <textarea
                autoFocus
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Explain what needs to be fixed…"
                rows={3}
                value={rejectReason}
              />
            </label>
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setRejectDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="approve-action"
                disabled={!rejectReason.trim() || busy}
                onClick={() => {
                  onReject(provider._id, rejectReason.trim());
                  setRejectDialogOpen(false);
                  setRejectReason("");
                }}
                type="button"
              >
                <XCircle size={15} />
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ProviderVerificationPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");

  const providersQuery = useQuery({
    queryKey: ["provider-verifications", status, dateRange.queryKey],
    queryFn: () => getProviderVerifications(status, dateRange.query),
  });

  const verificationMutation = useMutation({
    mutationFn: ({
      providerId,
      nextStatus,
      reason,
    }: {
      providerId: string;
      nextStatus: "approved" | "rejected";
      reason?: string;
    }) =>
      updateProviderVerification(providerId, {
        status: nextStatus,
        rejectionReason: nextStatus === "rejected" ? reason || "" : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
  });

  const enforcementMutation = useMutation({
    mutationFn: ({
      providerId,
      nextStatus,
      reason,
    }: {
      providerId: string;
      nextStatus: "clear" | "suspended";
      reason?: string;
    }) =>
      updateProviderEnforcement(providerId, {
        status: nextStatus,
        reason: nextStatus === "suspended" ? reason || "Blocked by OWVO admin." : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-verifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["washers"] });
    },
  });

  const providers = providersQuery.data ?? [];
  const isMutating = verificationMutation.isPending || enforcementMutation.isPending;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Providers Verification</h1>
          <p>Review washer documents and approve or reject launch access.</p>
        </div>
        <div className="filter-pills">
          {verificationFilters.map((filter) => (
            <button
              className={status === filter.value ? "filter-pill active" : "filter-pill"}
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {providersQuery.isError ? (
        <div className="error-state">Could not load provider verification queue.</div>
      ) : null}

      <div className="verification-grid">
        {providers.map((provider) => (
          <ProviderCard
            busy={isMutating}
            key={provider._id}
            onApprove={(providerId) =>
              verificationMutation.mutate({ providerId, nextStatus: "approved" })
            }
            onBlock={(providerId) =>
              enforcementMutation.mutate({
                providerId,
                nextStatus: "suspended",
                reason: "Blocked by OWVO admin from provider verification dashboard.",
              })
            }
            onReject={(providerId, reason) =>
              verificationMutation.mutate({ providerId, nextStatus: "rejected", reason })
            }
            onRestore={(providerId) =>
              enforcementMutation.mutate({ providerId, nextStatus: "clear" })
            }
            provider={provider}
          />
        ))}
      </div>

      {providersQuery.isLoading ? (
        <div className="empty-state">
          <FileText size={22} />
          Loading verification queue...
        </div>
      ) : null}
      {!providersQuery.isLoading && providers.length === 0 ? (
        <div className="empty-state">No providers found for this filter.</div>
      ) : null}
    </section>
  );
}