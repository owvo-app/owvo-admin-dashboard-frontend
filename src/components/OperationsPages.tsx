"use client";

import {
  ActivityLog,
  AdminAddon,
  AdminDataRequest,
  AdminNotification,
  AdminPayment,
  AdminPayout,
  AdminProviderDetail,
  AdminReport,
  AdminService,
  AdminServicesPricing,
  AdminUser,
  createAdminAddon,
  createAdminCatalogService,
  createAdminPayout,
  createStaffAccount,
  deleteAdminAddon,
  deleteAdminCatalogService,
  deleteStaffAccount,
  getActivityLogs,
  getAdminAddons,
  getAdminDataRequests,
  getAdminEarnings,
  getAdminNotifications,
  getAdminPayments,
  getAdminPayouts,
  getAdminTransactions,
  getAdminTransactionDetail,
  getAdminReconciliation,
  createAdminTransactionNote,
  getAdminReportPhotoBlob,
  getAdminReports,
  getAdminServicesPricing,
  getCustomers,
  getAdminCustomerDetail,
  createAdminCustomer,
  updateAdminCustomerProfile,
  updateCustomerEnforcement,
  deleteAdminCustomer,
  getCustomerNotes,
  addCustomerNote,
  deleteCustomerNote,
  sendCustomerMessage,
  sendCustomerResetPassword,
  AdminCustomerDetail,
  AdminCustomerDetailBooking,
  AdminCustomerMapLocation,
  CustomerNoteItem,
  getDashboardSettings,
  getStaffAccounts,
  getAdminProviderDetail,
  getProviderNotes,
  addProviderNote,
  deleteProviderNote,
  sendProviderMessage,
  createAdminProvider,
  updateAdminProviderProfile,
  getWashers,
  updateAdminAddon,
  updateAdminMe,
  updateAdminDataRequest,
  updateAdminReportStatus,
  updateAdminCatalogService,
  updateAdminProviderService,
  updateProviderDailyWashLimit,
  updateDashboardSettings,
  deleteAdminProvider,
  updateProviderEnforcement,
  updateProviderVerification,
  updateStaffAccount,
  updateUserAccountStatus,
} from "@/lib/admin-api";
import { SOCKET_URL } from "@/lib/api";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import { hydrateDashboardSession, storeDashboardSession } from "@/lib/auth-storage";
import { getDashboardSocketOptions } from "@/lib/socket";
import { initials, money } from "@/lib/format";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

import {
  Bell,
  BadgePoundSterling,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CarFront,
  ChevronDown,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ReceiptText,
  Save,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { AdminTransactionRow } from "@/lib/admin-api";
import {
  IssueRefundModal,
  MarkPayoutFailedModal,
  PayAvatar,
  PAY_STATUS_LABELS,
  PayManuallyModal,
  ReceiptModal,
  ReconciliationModal,
  RefundReviewModal,
  RetryPayoutModal,
  TransactionNoteModal,
  payErrMsg,
  payFmtDate,
  payFmtDateTime,
} from "./payments/PaymentsModals";

const menuOptions = [
  { key: "dashboard", label: "Dashboard" },
  { key: "bookings", label: "Bookings" },
  { key: "washers", label: "Washers" },
  { key: "customers", label: "Customers" },
  { key: "provider-verification", label: "Provider Verification" },
  { key: "payouts-payments", label: "Payouts & Payments" },
  { key: "earnings", label: "Earnings" },
  { key: "reports", label: "Services & Pricing" },
  { key: "data-requests", label: "Data Requests" },
  { key: "notifications", label: "Notifications" },
  { key: "system-logs", label: "System Logs" },
];

const reportTypes = [
  { value: "all", label: "All Types" },
  { value: "general", label: "General" },
  { value: "payment", label: "Payment" },
  { value: "service_quality", label: "Service Quality" },
  { value: "safety", label: "Safety" },
  { value: "provider_conduct", label: "Provider Conduct" },
];

function formatReportType(type?: string) {
  return reportTypes.find((item) => item.value === type)?.label || (type || "general").replace(/[_-]+/g, " ");
}

function moneyWithCurrency(amount: number | undefined, currency = "GBP", digits = 2) {
  const value = Number(amount) || 0;
  const code = (currency || "GBP").toUpperCase();

  try {
    return new Intl.NumberFormat("en-GB", {
      currency: code,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
      style: "currency",
    }).format(value);
  } catch {
    return `${code} ${new Intl.NumberFormat("en-GB", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)}`;
  }
}

function getApiErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return "Something went wrong.";

  const response = (error as { response?: { data?: { message?: unknown } } }).response;
  const responseMessage = response?.data?.message;
  if (typeof responseMessage === "string" && responseMessage.trim()) {
    return responseMessage;
  }

  const directMessage = (error as { message?: unknown }).message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage;
  }

  return "Something went wrong.";
}

const statusText: Record<string, string> = {
  not_submitted: "not approved",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  open: "open",
  reviewing: "reviewing",
  resolved: "resolved",
  dismissed: "dismissed",
  success: "success",
  failed: "failed",
  paid: "paid",
  processing: "processing",
};

function relativeDate(value?: string) {
  if (!value) return "No date";
  return formatDistanceToNow(new Date(value), { addSuffix: true }).replace("about ", "");
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="table-card">{children}</div>;
}

function AvatarName({ user, fallback }: { user?: AdminUser | null; fallback: string }) {
  const photoUrl = resolveReportPhotoUrl(user?.photo?.url);
  const initial = initials(user?.name || user?.email, fallback);

  return (
    <div className="inline-person">
      {photoUrl ? (
        <span className="small-avatar person-photo-shell">
          <span>{initial}</span>
          <img
            alt={user?.name || fallback}
            src={photoUrl}
            onError={(event) => {
              event.currentTarget.remove();
            }}
          />
        </span>
      ) : (
        <span className="small-avatar">{initial}</span>
      )}
      <span>
        <strong>{user?.name || fallback}</strong>
        <small>{user?.email || "No email"}</small>
      </span>
    </div>
  );
}

function RatingSummary({ average, count }: { average?: number; count?: number }) {
  return (
    <div className="rating-summary">
      <strong>{Number(average || 0).toFixed(1)}</strong>
      <span>{count || 0} ratings</span>
    </div>
  );
}

function CompletedJobsSummary({ jobs }: { jobs?: AdminUser["completedJobs"] }) {
  const values = jobs || { today: 0, week: 0, yearly: 0, allTime: 0 };

  return (
    <div className="jobs-summary">
      <strong>{values.allTime} all time</strong>
      <span>Today {values.today}</span>
      <span>Week {values.week}</span>
      <span>Year {values.yearly}</span>
    </div>
  );
}

function CustomerReviewsSummary({ customer }: { customer: AdminUser }) {
  const reviews = customer.recentReviews || [];

  return (
    <div className="review-summary">
      <RatingSummary average={customer.customerRatingAverage} count={customer.customerRatingCount} />
      {reviews.length ? (
        <span className="review-snippet">
          {reviews[0].review || `${reviews[0].rating}/5 from ${reviews[0].provider?.name || "washer"}`}
        </span>
      ) : (
        <span className="review-snippet muted">No reviews yet</span>
      )}
    </div>
  );
}

function EmptyState({ text, icon }: { text: string; icon?: React.ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      {text}
    </div>
  );
}

function safePdfText(value?: unknown, fallback = "Not provided") {
  const text = value === undefined || value === null || value === "" ? fallback : String(value);
  return Array.from(text)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code <= 126 ? char : " ";
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveReportPhotoUrl(url?: string) {
  const value = url?.trim();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  const path = value.startsWith("/") ? value : `/${value}`;
  return `${SOCKET_URL}${path}`;
}

function escapePdfText(value: string) {
  return safePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function formatPdfDate(value?: string) {
  if (!value) return "Not provided";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not provided";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPdfMoneyValue(value?: number, currency = "GBP") {
  if (typeof value !== "number" || Number.isNaN(value)) return "Not provided";
  return `${currency} ${value.toFixed(2)}`;
}

type ExportRecord = Record<string, unknown>;

const dataRequestFilterOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const exportSectionOptions = [
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "vehicles", label: "Vehicles", icon: CarFront },
  { key: "bookings", label: "Bookings", icon: CalendarDays },
  { key: "payments", label: "Payments", icon: CreditCard },
  { key: "reports", label: "Reports", icon: TriangleAlert },
  { key: "chatMessages", label: "Messages", icon: MessageSquareText },
  { key: "providerRatings", label: "Provider Ratings", icon: Star },
  { key: "customerRatings", label: "Customer Ratings", icon: Star },
  { key: "receipts", label: "Receipts", icon: ReceiptText },
];

function isExportRecord(value: unknown): value is ExportRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asExportRecord(value: unknown): ExportRecord | null {
  return isExportRecord(value) ? value : null;
}

function getExportList(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isMongoObjectId(value: string) {
  return /^[a-fA-F0-9]{24}$/.test(value.trim());
}

function formatExportLabel(key: string) {
  const overrides: Record<string, string> = {
    preferredServices: "Offered Services",
    customerRatingAverage: "Average Rating",
    customerRatingCount: "Total Rating Count",
    userId: "Customer",
    providerId: "Provider",
    bookingId: "Booking",
    booking: "Booking",
    user: "User",
    provider: "Provider",
    customer: "Customer",
    reporter: "Reporter",
    reportedUser: "Reported User",
    sender: "Sender",
    recipient: "Recipient",
    participants: "Participants",
    assignedTo: "Assigned To",
    reviewedBy: "Reviewed By",
    updatedBy: "Updated By",
    service: "Service",
    vehicle: "Vehicle",
  };

  if (overrides[key]) return overrides[key];

  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "id") return "ID";
      if (lower === "url") return "URL";
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function isMoneyExportKey(key: string) {
  const lower = key.toLowerCase();
  return ["amount", "price", "balance", "paid", "payable", "commission", "discount", "tip"].some((part) =>
    lower.includes(part)
  );
}

function formatExportValue(key: string, value: unknown): string {
  if ((key === "reviewedBy" || key === "updatedBy") && value) return "Admin";
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return isMoneyExportKey(key) ? moneyWithCurrency(value) : value.toLocaleString("en-GB");
  if (Array.isArray(value)) {
    if (isScalarSummaryKey(key)) {
      const values = value.map((item) => formatExportValue("value", item)).filter((item) => item !== "Not provided");
      return values.length ? values.join(", ") : "Not provided";
    }
    return `${value.length} records`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || isMongoObjectId(trimmed)) return "Not provided";
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime()) && (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || trimmed.includes("T"))) {
      return formatPdfDate(trimmed);
    }
    return trimmed;
  }
  if (isExportRecord(value)) return summarizeExportRecord(value);
  return String(value);
}

function summarizeVehicle(value: unknown) {
  const record = asExportRecord(value);
  if (!record) return "Not provided";

  const parts = [
    formatExportValue("registrationNo", record.registrationNo),
    formatExportValue("make", record.make),
    formatExportValue("model", record.model),
    formatExportValue("size", record.size),
  ].filter((part) => part !== "Not provided");

  return parts.length ? parts.join(" ") : "Not provided";
}

function summarizeService(value: unknown) {
  const record = asExportRecord(value);
  if (!record) return "Not provided";

  const title = formatExportValue("title", record.title);
  if (title !== "Not provided") return title;

  const type = formatExportValue("serviceType", record.serviceType);
  const size = formatExportValue("carSize", record.carSize);
  if (type !== "Not provided" && size !== "Not provided") return `${type} - ${size}`;
  if (type !== "Not provided") return type;

  return "Not provided";
}

function summarizePerson(value: unknown) {
  const record = asExportRecord(value);
  if (!record) return "Not provided";

  for (const key of ["name", "fullName", "email"]) {
    const formatted = formatExportValue(key, record[key]);
    if (formatted !== "Not provided") return formatted;
  }

  return "Not provided";
}

function summarizeExportRecord(record: ExportRecord): string {
  const nestedBooking = asExportRecord(record.booking || record.bookingId);
  if (nestedBooking) {
    const bookingSummary = summarizeExportRecord(nestedBooking);
    if (bookingSummary !== "Not provided") return bookingSummary;
  }

  const nestedService = asExportRecord(record.service);
  if (nestedService) {
    const service = summarizeService(nestedService);
    if (service !== "Not provided") return service;
  }

  const vehicle = summarizeVehicle(record);
  if (vehicle !== "Not provided") return vehicle;

  const service = summarizeService(record);
  if (service !== "Not provided") return service;

  const person = summarizePerson(record);
  if (person !== "Not provided") return person;

  for (const key of ["status", "serviceType", "addressLine", "transactionId", "description", "review", "text"]) {
    const value = record[key];
    const formatted = formatExportValue(key, value);
    if (formatted !== "Not provided") return formatted;
  }

  return "Not provided";
}

function shouldSkipExportKey(key: string) {
  return key === "__v" || key === "_id" || key === "availability";
}

function isScalarSummaryKey(key: string) {
  return [
    "reviewedBy",
    "updatedBy",
    "booking",
    "bookingId",
    "user",
    "userId",
    "provider",
    "providerId",
    "customer",
    "reporter",
    "reportedUser",
    "sender",
    "recipient",
    "participants",
    "assignedTo",
    "service",
    "vehicle",
  ].includes(key);
}

function getExportEntries(record: ExportRecord) {
  return Object.entries(record).filter(([key]) => !shouldSkipExportKey(key));
}

function renderExportNode(value: unknown, depth = 0): React.ReactNode {
  if (Array.isArray(value)) {
    if (!value.length) return <span className="export-empty-value">No records found.</span>;
    if (depth > 1) return <span>{value.length} records</span>;

    return (
      <div className="export-record-list">
        {value.map((item, index) => {
          const heading = isExportRecord(item) ? summarizeExportRecord(item) : `Record ${index + 1}`;
          return (
            <article className="export-record-card" key={`${index}-${heading}`}>
              <strong>{heading}</strong>
              {renderExportNode(item, depth + 1)}
            </article>
          );
        })}
      </div>
    );
  }

  if (isExportRecord(value)) {
    const entries = getExportEntries(value);
    if (!entries.length) return <span className="export-empty-value">No information available.</span>;

    return (
      <dl className="export-field-grid">
        {entries.map(([key, fieldValue]) => {
          const nested = Array.isArray(fieldValue) || isExportRecord(fieldValue);
          const forceScalar = isScalarSummaryKey(key);

          return (
            <div className={nested && depth < 2 && !forceScalar ? "export-field wide" : "export-field"} key={key}>
              <dt>{formatExportLabel(key)}</dt>
              <dd>{nested && depth < 2 && !forceScalar ? renderExportNode(fieldValue, depth + 1) : formatExportValue(key, fieldValue)}</dd>
            </div>
          );
        })}
      </dl>
    );
  }

  return <span>{formatExportValue("value", value)}</span>;
}

function DataExportViewer({
  data,
  status,
}: {
  data?: Record<string, unknown> | null;
  status: AdminDataRequest["status"];
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
  });
  if (!data) {
    return (
      <div className="data-export-empty">
        Approved data exports will appear here for the requester inside the app.
      </div>
    );
  }

  const summary = [
    { label: "Vehicles", value: getExportList(data.vehicles).length, icon: CarFront },
    { label: "Bookings", value: getExportList(data.bookings).length, icon: CalendarDays },
    { label: "Payments", value: getExportList(data.payments).length, icon: BadgePoundSterling },
    { label: "Reports", value: getExportList(data.reports).length, icon: TriangleAlert },
  ];

  return (
    <div className="data-export-viewer">
      <div className="data-export-heading">
        <span className="data-export-heading-icon" aria-hidden="true">
          <ShieldCheck size={21} strokeWidth={2.2} />
        </span>
        <div>
          <h3>{status === "approved" ? "Approved Data Export" : "Requested Data Preview"}</h3>
          <p>Generated {formatExportValue("generatedAt", data.generatedAt)}</p>
        </div>
      </div>
      {typeof data.retentionPolicy === "string" && data.retentionPolicy.trim() ? (
        <p className="data-export-policy">{data.retentionPolicy}</p>
      ) : null}
      <div className="data-export-summary">
        {summary.map((item) => {
          const SummaryIcon = item.icon;
          return (
            <div className="data-export-summary-item" key={item.label}>
              <SummaryIcon aria-hidden="true" size={17} strokeWidth={2.1} />
              <span>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="data-export-sections">
        {exportSectionOptions.map((section) => {
          const sectionValue = data[section.key];
          const count = getExportList(sectionValue).length;
          const hasRecord = isExportRecord(sectionValue) && getExportEntries(sectionValue).length > 0;
          const SectionIcon = section.icon;
          const isExpanded = Boolean(expandedSections[section.key]);
          const sectionStatus = Array.isArray(sectionValue)
            ? `${count} records`
            : hasRecord
              ? "Available"
              : "No records";

          return (
            <section className={`data-export-section${isExpanded ? " is-open" : ""}`} key={section.key}>
              <button
                aria-expanded={isExpanded}
                className="data-export-section-toggle"
                onClick={() =>
                  setExpandedSections((current) => ({
                    ...current,
                    [section.key]: !current[section.key],
                  }))
                }
                type="button"
              >
                <span className="data-export-section-heading">
                  <span className="data-export-section-icon" aria-hidden="true">
                    <SectionIcon size={18} strokeWidth={2.1} />
                  </span>
                  <span>
                    <strong>{section.label}</strong>
                    <small>{sectionStatus}</small>
                  </span>
                </span>
                <ChevronDown className="data-export-chevron" aria-hidden="true" size={18} />
              </button>
              {isExpanded ? (
                <div className="data-export-section-content">{renderExportNode(sectionValue)}</div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
function wrapPdfLines(value: unknown, maxChars: number) {
  const words = safePdfText(value)
    .split(" ")
    .flatMap((word) => {
      if (word.length <= maxChars) return [word];
      const chunks: string[] = [];
      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars));
      }
      return chunks;
    })
    .filter(Boolean);
  const lines: string[] = [];
  let line = "";

  words.forEach((word) => {
    if (!line) {
      line = word;
      return;
    }
    if (`${line} ${word}`.length <= maxChars) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  });

  if (line) lines.push(line);
  return lines.length ? lines : ["Not provided"];
}

function limitPdfLines(lines: string[], maxLines: number) {
  if (lines.length <= maxLines) return lines;
  const visible = lines.slice(0, maxLines);
  const last = visible[maxLines - 1];
  visible[maxLines - 1] = last.length > 3 ? `${last.slice(0, -3)}...` : "...";
  return visible;
}

async function loadReportPhotoForPdf(url: string) {
  if (typeof window === "undefined" || !url) return null;

  try {
    let objectUrl = "";
    let imageSource = url;

    try {
      const response = await fetch(url, { mode: "cors" });
      if (response.ok && !url.startsWith("blob:")) {
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        imageSource = objectUrl;
      }
    } catch {
      imageSource = url;
    }

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load report photo"));
      img.src = imageSource;
    });

    const maxEdge = 900;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    const base64 = dataUrl.split(",")[1];
    const binary = window.atob(base64);
    let hex = "";

    for (let index = 0; index < binary.length; index += 1) {
      hex += binary.charCodeAt(index).toString(16).padStart(2, "0");
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    return {
      hex,
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    return null;
  }
}

async function loadReportPhotoBlobForPdf(blob: Blob) {
  if (typeof window === "undefined") return null;

  const objectUrl = URL.createObjectURL(blob);
  try {
    return await loadReportPhotoForPdf(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function pdfCirclePath(cx: number, cy: number, radius: number) {
  const c = radius * 0.5522847498;
  return [
    `${cx + radius} ${cy} m`,
    `${cx + radius} ${cy + c} ${cx + c} ${cy + radius} ${cx} ${cy + radius} c`,
    `${cx - c} ${cy + radius} ${cx - radius} ${cy + c} ${cx - radius} ${cy} c`,
    `${cx - radius} ${cy - c} ${cx - c} ${cy - radius} ${cx} ${cy - radius} c`,
    `${cx + c} ${cy - radius} ${cx + radius} ${cy - c} ${cx + radius} ${cy} c`,
  ].join(" ");
}

async function createReportPdfBlob(report: AdminReport) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const soft = "0.973 0.977 0.984";
  const reportType = formatReportType(report.type);
  const shortId = report._id.slice(-8).toUpperCase();
  const booking = report.booking;
  const currency = booking?.currency || "GBP";
  const reportPhotoUrl = resolveReportPhotoUrl(report.photo?.url);
  let reportPhotoImage: Awaited<ReturnType<typeof loadReportPhotoForPdf>> = null;

  if (report.photo?.url) {
    try {
      const photoBlob = await getAdminReportPhotoBlob(report._id);
      reportPhotoImage = await loadReportPhotoBlobForPdf(photoBlob);
    } catch {
      reportPhotoImage = reportPhotoUrl ? await loadReportPhotoForPdf(reportPhotoUrl) : null;
    }
  }
  const content: string[] = [];

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
    content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
  };
  const drawText = (
    value: unknown,
    x: number,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    content.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`);
  };
  const drawCenteredText = (
    value: string,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    const textWidth = safePdfText(value).length * size * 0.58;
    drawText(value, (width - textWidth) / 2, y, size, font, color);
  };
  const drawLabel = (
    label: string,
    value: unknown,
    x: number,
    y: number,
    maxChars = 38,
    maxLines = 2,
    valueSize = 10
  ) => {
    drawText(label.toUpperCase(), x, y, 8, "F2", muted);
    const lines = limitPdfLines(wrapPdfLines(value, maxChars), maxLines);
    lines.forEach((item, index) =>
      drawText(item, x, y - 14 - index * 12, valueSize, index === 0 ? "F2" : "F1", text)
    );
  };
  const drawSectionTitle = (title: string, x: number, y: number) => {
    content.push(`q ${yellow} RG 3 w ${x} ${y - 4} m ${x + 26} ${y - 4} l S Q`);
    drawText(title, x + 36, y - 8, 13, "F2", text);
  };
  const drawImageFit = (x: number, y: number, boxWidth: number, boxHeight: number) => {
    if (!reportPhotoImage) return;
    const scale = Math.min(boxWidth / reportPhotoImage.width, boxHeight / reportPhotoImage.height);
    const imageWidth = reportPhotoImage.width * scale;
    const imageHeight = reportPhotoImage.height * scale;
    const imageX = x + (boxWidth - imageWidth) / 2;
    const imageY = y + (boxHeight - imageHeight) / 2;
    rect(x, y, boxWidth, boxHeight, "1 1 1");
    strokeRect(x, y, boxWidth, boxHeight);
    content.push(`q ${imageWidth} 0 0 ${imageHeight} ${imageX} ${imageY} cm /Im1 Do Q`);
  };

  rect(0, 0, width, height, "1 1 1");
  rect(0, height - 112, width, 112, dark);
  rect(0, height - 118, width, 6, yellow);
  content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 54, 17)} S Q`);
  drawText("OWVO", 78, height - 62, 23, "F2", "1 1 1");
  drawCenteredText("Issue Report", height - 94, 18, "F2", "1 1 1");
  drawText(`Report #${shortId}`, 405, height - 51, 12, "F2", "1 1 1");
  drawText(`Generated ${formatPdfDate(new Date().toISOString())}`, 405, height - 72, 9, "F1", "0.820 0.847 0.886");

  rect(34, 642, 527, 72, soft);
  strokeRect(34, 642, 527, 72);
  drawLabel("Status", report.status, 54, 688, 22);
  drawLabel("Type", reportType, 182, 688, 28);
  drawLabel("Created", formatPdfDate(report.createdAt), 330, 688, 30);
  drawLabel("Report ID", report._id, 54, 657, 42, 1);

  drawSectionTitle("People Involved", 40, 614);
  rect(34, 450, 252, 140, "1 1 1");
  strokeRect(34, 450, 252, 140);
  drawText("Reporter", 54, 568, 12, "F2", text);
  drawLabel("Name", report.reporter?.name, 54, 545, 30, 2, 9);
  drawLabel("Email", report.reporter?.email, 54, 508, 30, 2, 9);
  drawLabel("Role", report.reporterRole || report.reporter?.role, 54, 471, 26, 1, 9);

  rect(309, 450, 252, 140, "1 1 1");
  strokeRect(309, 450, 252, 140);
  drawText("Reported User", 329, 568, 12, "F2", text);
  drawLabel("Name", report.reportedUser?.name, 329, 545, 30, 2, 9);
  drawLabel("Email", report.reportedUser?.email, 329, 508, 30, 2, 9);
  drawLabel("Role", report.reportedUser?.role, 329, 471, 26, 1, 9);

  drawSectionTitle("Booking Details", 40, 424);
  rect(34, 322, 527, 78, soft);
  strokeRect(34, 322, 527, 78);
  drawLabel("Booking ID", booking?._id, 54, 377, 36, 2, 9);
  drawLabel("Booking Status", booking?.status, 224, 377, 22, 1, 9);
  drawLabel("Final Price", formatPdfMoneyValue(booking?.finalPrice, currency), 370, 377, 24, 1, 9);
  drawLabel("Booking Date", formatPdfDate(booking?.bookingDate || booking?.createdAt), 54, 344, 38, 1, 9);

  drawSectionTitle("Report Description", 40, 286);
  rect(34, 140, 527, 120, "1 1 1");
  strokeRect(34, 140, 527, 120);
  wrapPdfLines(report.description, reportPhotoImage ? 54 : 88)
    .slice(0, 7)
    .forEach((item, index) => drawText(item, 54, 238 - index * 15, 10, "F1", text));

  if (reportPhotoImage) {
    drawText("Attached photo", 390, 238, 9, "F2", muted);
    drawImageFit(390, 153, 145, 78);
  } else if (reportPhotoUrl) {
    drawText("Attached photo", 54, 118, 9, "F2", muted);
    wrapPdfLines(reportPhotoUrl, 78)
      .slice(0, 2)
      .forEach((item, index) => drawText(item, 54, 104 - index * 12, 8, "F1", muted));
  }

  rect(34, 34, 527, 34, dark);
  drawText("OWVO ADMIN DASHBOARD", 54, 53, 10, "F2", "1 1 1");
  drawText("Professional issue report export for internal review and operations records.", 205, 53, 9, "F1", "0.820 0.847 0.886");
  rect(34, 28, 527, 4, yellow);

  const stream = content.join("\n");
  const imageResource = reportPhotoImage ? " /XObject << /Im1 7 0 R >>" : "";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${imageResource} >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];

  if (reportPhotoImage) {
    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${reportPhotoImage.width} /Height ${reportPhotoImage.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter [/ASCIIHexDecode /DCTDecode] /Length ${
        reportPhotoImage.hex.length + 1
      } >>\nstream\n${reportPhotoImage.hex}>\nendstream`
    );
  }
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ReportDownloadButton({ report }: { report: AdminReport }) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function download() {
    setIsDownloading(true);
    try {
      const blob = await createReportPdfBlob(report);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `owvo-report-${report._id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <button className="mini-text-button" disabled={isDownloading} onClick={download} type="button">
      <Download size={15} />
      {isDownloading ? "Preparing" : "Download"}
    </button>
  );
}

function createProviderPayoutPdfBlob(payout: AdminPayout) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const soft = "0.973 0.977 0.984";
  const content: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
  };
  const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
    content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
  };
  const drawText = (
    value: unknown,
    x: number,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    content.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`);
  };
  const drawCenteredText = (
    value: string,
    y: number,
    size = 10,
    font: "F1" | "F2" = "F1",
    color = text
  ) => {
    const textWidth = safePdfText(value).length * size * (font === "F2" ? 0.58 : 0.52);
    drawText(value, (width - textWidth) / 2, y, size, font, color);
  };
  const drawLabel = (label: string, value: unknown, x: number, y: number, maxChars = 44) => {
    drawText(label.toUpperCase(), x, y, 8, "F2", muted);
    wrapPdfLines(value, maxChars)
      .slice(0, 2)
      .forEach((item, index) => drawText(item, x, y - 16 - index * 13, 11, index === 0 ? "F2" : "F1", text));
  };

  rect(0, 0, width, height, "1 1 1");
  rect(0, height - 100, width, 100, dark);
  rect(0, height - 106, width, 6, yellow);
  content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 50, 17)} S Q`);
  drawText("OWVO", 78, height - 58, 23, "F2", "1 1 1");
  drawCenteredText("Manual Provider Payment Report", height - 84, 16, "F2", "1 1 1");
  drawText(`Record #${payout._id.slice(-8).toUpperCase()}`, 382, height - 46, 12, "F2", "1 1 1");
  drawText(`Generated ${formatPdfDate(new Date().toISOString())}`, 382, height - 66, 9, "F1", "0.820 0.847 0.886");

  rect(34, 610, 527, 96, soft);
  strokeRect(34, 610, 527, 96);
  drawLabel("Provider", payout.provider?.name || "Washer", 54, 676, 34);
  drawLabel("Provider email", payout.provider?.email || "Not provided", 54, 638, 38);
  drawLabel("Amount paid", moneyWithCurrency(payout.amount, payout.currency || "GBP"), 330, 676, 28);
  drawLabel("Status", payout.status, 330, 638, 20);

  rect(34, 462, 527, 112, "1 1 1");
  strokeRect(34, 462, 527, 112);
  drawLabel("Paid date", formatPdfDate(payout.paidAt || payout.createdAt), 54, 540, 34);
  drawLabel("Recorded date", formatPdfDate(payout.createdAt), 54, 502, 34);
  drawLabel("Payment mode", "Manual salary payment outside dashboard automation", 330, 540, 34);
  drawLabel("Admin note", payout.manualAdjustmentReason || "Manual provider salary marked paid by admin", 330, 502, 34);

  rect(34, 34, 527, 34, dark);
  drawText("OWVO ADMIN DASHBOARD", 54, 53, 10, "F2", "1 1 1");
  drawText("Manual payment confirmation for internal operations records.", 205, 53, 9, "F1", "0.820 0.847 0.886");
  rect(34, 28, 527, 4, yellow);

  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ProviderPayoutDownloadButton({ payout }: { payout: AdminPayout }) {
  function download() {
    const blob = createProviderPayoutPdfBlob(payout);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `owvo-provider-payment-${payout._id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button className="mini-text-button" onClick={download} type="button">
      <Download size={15} />
      Download
    </button>
  );
}

function ReportPhotoPreview({ report }: { report: AdminReport }) {
  const [photoUrl, setPhotoUrl] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const storedUrl = resolveReportPhotoUrl(report.photo?.url);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    if (!report.photo?.url) {
      setPhotoUrl("");
      setState("error");
      return;
    }

    setPhotoUrl("");
    setState("loading");

    getAdminReportPhotoBlob(report._id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPhotoUrl(objectUrl);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setPhotoUrl("");
        setState("error");
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [report._id, report.photo?.url]);

  if (!report.photo?.url) return null;

  if (state === "loading") {
    return (
      <div className="report-photo-preview">
        <div className="report-photo-state">
          <Loader2 size={18} />
          Loading attached photo...
        </div>
      </div>
    );
  }

  if (state === "error" || !photoUrl) {
    return (
      <div className="report-photo-preview report-photo-preview-error">
        <div className="report-photo-state">
          <FileText size={18} />
          <div>
            <strong>Attached photo unavailable</strong>
            <p>The report has a saved photo reference, but the image file could not be loaded from storage.</p>
          </div>
        </div>
        {storedUrl ? (
          <div className="report-photo-tools">
            <a className="mini-text-button" href={storedUrl} rel="noreferrer" target="_blank">
              Open stored URL
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="report-photo-preview">
      <a href={photoUrl} rel="noreferrer" target="_blank">
        <img alt="Attached report evidence" src={photoUrl} />
        <span>Attached report photo</span>
      </a>
      <div className="report-photo-tools">
        <a className="mini-text-button" href={photoUrl} rel="noreferrer" target="_blank">
          Open photo
        </a>
      </div>
    </div>
  );
}

function humanizeLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\./g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(formatMetadataValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nestedValue]) => {
        const formatted = formatMetadataValue(nestedValue);
        return formatted ? `${humanizeLabel(key)}: ${formatted}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return String(value);
}

function getLogTitle(action: string) {
  const titles: Record<string, string> = {
    "dashboard.login": "Dashboard login",
    "dashboard.logout": "Dashboard logout",
    "dashboard_account.updated": "Dashboard account updated",
    "booking.status_updated": "Booking status updated",
    "provider.verification_updated": "Provider verification updated",
    "provider.enforcement_updated": "Provider access updated",
    "report.status_updated": "Report status updated",
    "staff.created": "Staff account created",
    "staff.updated": "Staff account updated",
    "staff.disabled": "Staff access disabled",
    "staff.deleted": "Staff account deleted",
    "settings.updated": "Dashboard settings updated",
    "payout.created": "Provider payout created",
    "payout.status_updated": "Payout status updated",
    "admin.withdrawal_created": "Admin withdrawal created",
    "admin.withdrawal_status_updated": "Admin withdrawal updated",
    "service.catalog_updated": "Service catalog updated",
    "service.provider_updated": "Provider service updated",
    "user.status_updated": "User status updated",
    "user.role_updated": "User role updated",
    "user.deleted": "User deleted",
  };

  return titles[action] || humanizeLabel(action);
}

function getLogMetadataPairs(metadata?: Record<string, unknown>) {
  return Object.entries(metadata || {})
    .map(([key, value]) => ({
      label: humanizeLabel(key),
      value: formatMetadataValue(value),
    }))
    .filter((entry) => entry.value);
}

function getLogSummary(log: ActivityLog) {
  const pairs = getLogMetadataPairs(log.metadata);
  if (!pairs.length) return "No extra details recorded.";
  return pairs.map((entry) => `${entry.label}: ${entry.value}`).join(" | ");
}

function createActivityLogsPdfBlob(logs: ActivityLog[], rangeLabel: string) {
  const width = 595.28;
  const height = 841.89;
  const yellow = "1 0.745 0.071";
  const dark = "0.043 0.078 0.125";
  const text = "0.067 0.094 0.153";
  const muted = "0.396 0.439 0.522";
  const line = "0.898 0.914 0.941";
  const rowsPerPage = 18;
  const chunks: ActivityLog[][] = [];

  for (let index = 0; index < logs.length; index += rowsPerPage) {
    chunks.push(logs.slice(index, index + rowsPerPage));
  }

  if (!chunks.length) chunks.push([]);

  const makePage = (pageLogs: ActivityLog[], pageIndex: number) => {
    const content: string[] = [];
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      content.push(`q ${color} rg ${x} ${y} ${w} ${h} re f Q`);
    };
    const strokeRect = (x: number, y: number, w: number, h: number, color = line) => {
      content.push(`q ${color} RG 1 w ${x} ${y} ${w} ${h} re S Q`);
    };
    const drawText = (
      value: unknown,
      x: number,
      y: number,
      size = 10,
      font: "F1" | "F2" = "F1",
      color = text
    ) => {
      content.push(
        `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${escapePdfText(String(value ?? ""))}) Tj ET`
      );
    };
    const drawCenteredText = (
      value: string,
      centerX: number,
      y: number,
      size = 10,
      font: "F1" | "F2" = "F1",
      color = text
    ) => {
      const approxWidth = value.length * size * (font === "F2" ? 0.58 : 0.52);
      drawText(value, centerX - approxWidth / 2, y, size, font, color);
    };

    rect(0, 0, width, height, "1 1 1");
    rect(0, height - 94, width, 94, dark);
    rect(0, height - 100, width, 6, yellow);
    content.push(`q ${yellow} RG 5 w ${pdfCirclePath(48, height - 48, 17)} S Q`);
    drawText("OWVO", 78, height - 56, 23, "F2", "1 1 1");
    drawCenteredText("System Logs Report", width / 2, height - 81, 15, "F2", "1 1 1");
    drawText(rangeLabel, 405, height - 45, 11, "F2", "1 1 1");
    drawText(`Page ${pageIndex + 1} of ${chunks.length}`, 405, height - 64, 9, "F1", "0.820 0.847 0.886");

    let y = height - 130;
    rect(34, y - 12, 527, 24, "0.973 0.977 0.984");
    strokeRect(34, y - 12, 527, 24);
    drawText("ACTIVITY", 48, y - 2, 8, "F2", muted);
    drawText("ACTOR", 330, y - 2, 8, "F2", muted);
    drawText("TIME", 455, y - 2, 8, "F2", muted);
    y -= 34;

    pageLogs.forEach((log) => {
      const summary = getLogSummary(log);
      rect(34, y - 31, 527, 43, "1 1 1");
      strokeRect(34, y - 31, 527, 43);
      drawText(getLogTitle(log.action), 48, y - 1, 9, "F2", text);
      drawText(wrapPdfLines(summary, 60)[0] || "No details", 48, y - 15, 7, "F1", muted);
      drawText(log.actor?.name || log.actorRole || "System", 330, y - 1, 8, "F1", text);
      drawText(formatPdfDate(log.createdAt), 455, y - 1, 7, "F1", muted);
      y -= 45;
    });

    rect(34, 34, 527, 30, dark);
    drawText("OWVO ADMIN DASHBOARD", 54, 52, 9, "F2", "1 1 1");
    drawText("Professional audit export for admin and staff activity.", 220, 52, 8, "F1", "0.820 0.847 0.886");
    rect(34, 28, 527, 4, yellow);
    return content.join("\n");
  };

  const streams = chunks.map(makePage);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const kids: number[] = [];

  streams.forEach((stream) => {
    const pageObjectNumber = objects.length + 1;
    const contentObjectNumber = pageObjectNumber + 1;
    kids.push(pageObjectNumber);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  objects[1] = `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${kids.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;

  return new Blob([pdf], { type: "application/pdf" });
}

function ActivityLogDownloadButton({ logs, rangeLabel }: { logs: ActivityLog[]; rangeLabel: string }) {
  function download() {
    const blob = createActivityLogsPdfBlob(logs, rangeLabel);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `owvo-system-logs-${rangeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <button className="mini-text-button" disabled={!logs.length} onClick={download} type="button">
      <Download size={15} />
      Download PDF
    </button>
  );
}

// ─── Providers redesign (Step 2 — list page) ────────────────────────────────
// Reference design: header + Add Provider, 4 stat cards, filters, table with
// display IDs / service chips / status badges, pagination + full error states.
// The detail panel arrives in Step 4; row click still opens the existing
// washer detail page. The ••• action menu arrives in Step 3.
type ProviderListItem = AdminUser & {
  accountStatus?: string;
  providerAddress?: {
    streetAddress?: string;
    city?: string;
    country?: string;
    postcode?: string;
  };
  location?: { type?: string; coordinates?: number[] };
  preferredServices?: Array<
    | string
    | { _id?: string; title?: string; price?: number; isActive?: boolean }
  >;
};

type ProviderDisplayStatus = "active" | "pending" | "inactive";

type ProviderActionKind =
  | "suspend"
  | "reactivate"
  | "deactivate"
  | "activate"
  | "delete";

// Step 5 ke tabs ko detail provider ke kuch aur fields chahiye (documents,
// insurance expiry, availability) — base type par local extension.
type PanelProviderDetail = AdminProviderDetail["provider"] & {
  identityVerification?: {
    documentNumber?: string;
    submittedAt?: string;
  };
  insurance?: { uploadedAt?: string };
  publicLiabilityInsurance?: {
    policyNumber?: string;
    insuranceCompany?: string;
    expiryDate?: string;
    status?: string;
    uploadedAt?: string;
  };
  drivewayPhoto?: { document?: { url?: string }; uploadedAt?: string };
  bankDetails?: {
    accountHolderName?: string;
    bankName?: string;
    sortCode?: string;
  };
  availability?: {
    mode?: string;
    days?: Record<
      string,
      { enabled?: boolean; startTime?: string; endTime?: string }
    >;
  };
  adminVerification?: { reviewedAt?: string };
};

function providerDisplayStatus(washer: ProviderListItem): ProviderDisplayStatus {
  const enforcement = washer.enforcement?.status || "clear";
  if (
    enforcement === "suspended" ||
    enforcement === "banned" ||
    washer.accountStatus === "disabled"
  ) {
    return "inactive";
  }
  if ((washer.adminVerification?.status || "not_submitted") !== "approved") {
    return "pending";
  }
  return "active";
}

function providerServiceTitles(washer: ProviderListItem): string[] {
  return (washer.preferredServices || [])
    .map((service) =>
      typeof service === "string"
        ? null
        : service?.isActive === false
          ? null
          : service?.title || null
    )
    .filter((title): title is string => Boolean(title));
}

// ─── Providers redesign (Step 4 — detail panel + Overview tab) ──────────────
// Right slide-in panel. Header + contact actions hamesha dikhte hain (list ke
// data se); Overview ki asal details Step 1 wale detail endpoint se ati hain.
// Baaki tabs (Documents/Services/Earnings/Bookings/Notes) apne steps me ayenge.
// ─── Providers Step 4 fix — View on Map popup ───────────────────────────────
// Saare providers ki locations ek Google Map par; jis provider se khola gaya
// hy wo bara yellow pin + name popup ke sath prominent (center) hota hy.
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { google?: { maps?: unknown } }).google?.maps
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-google-maps", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

function ProviderMapModal({
  providers,
  selectedId,
  onClose,
}: {
  providers: ProviderListItem[];
  selectedId: string;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(true);

  const pins = providers.filter(
    (item) =>
      item.location?.coordinates?.length === 2 &&
      item.location.coordinates[0] != null &&
      item.location.coordinates[1] != null
  );
  const selected = providers.find((item) => item._id === selectedId);
  const selectedCoords =
    selected?.location?.coordinates?.length === 2
      ? selected.location.coordinates
      : undefined;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapError("Google Maps API key is not configured.");
      setMapLoading(false);
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current) return;
        const g = (
          window as unknown as {
            google: {
              maps: Record<string, any>;
            };
          }
        ).google;
        const map = new g.maps.Map(mapRef.current, {
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        const info = new g.maps.InfoWindow();
        const escapeHtml = (value: string) =>
          value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        const bounds = new g.maps.LatLngBounds();
        let selectedMarker: any = null;

        pins.forEach((item) => {
          const lng = item.location!.coordinates![0];
          const lat = item.location!.coordinates![1];
          const pos = { lat, lng };
          bounds.extend(pos);
          const isSelected = item._id === selectedId;
          const color = isSelected
            ? "#f6b300"
            : item.isBusy
              ? "#2369e8"
              : item.isOnline
                ? "#22a355"
                : "#9aa0a6";
          const marker = new g.maps.Marker({
            position: pos,
            map,
            title: item.name || "Provider",
            zIndex: isSelected ? 1000 : 1,
            icon: {
              path: g.maps.SymbolPath.CIRCLE,
              scale: isSelected ? 15 : 9,
              fillColor: color,
              fillOpacity: 1,
              strokeColor: isSelected ? "#0b1f2d" : "#ffffff",
              strokeWeight: isSelected ? 3 : 2,
            },
          });
          marker.addListener("click", () => {
            info.setContent(
              `<div style="font-size:13px;line-height:1.45"><strong>${escapeHtml(item.name || "Provider")}</strong><br/>${escapeHtml(item.serviceArea || "")}<br/>${item.isOnline ? "Online" : "Offline"}${isSelected ? " • Selected provider" : ""}</div>`
            );
            info.open(map, marker);
          });
          if (isSelected) selectedMarker = marker;
        });

        if (selectedCoords) {
          const center = { lat: selectedCoords[1], lng: selectedCoords[0] };
          map.setCenter(center);
          map.setZoom(12);
          if (selected && selectedMarker) {
            info.setContent(
              `<div style="font-size:13px;line-height:1.45"><strong>${escapeHtml(selected.name || "Provider")}</strong><br/>${escapeHtml(selected.serviceArea || "")}<br/>${selected.isOnline ? "Online" : "Offline"} • Selected provider</div>`
            );
            info.open(map, selectedMarker);
          }
        } else if (pins.length > 0) {
          map.fitBounds(bounds);
        } else {
          map.setCenter({ lat: 54.5, lng: -3.5 });
          map.setZoom(5);
        }
        setMapLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError(
            "Google Maps could not be loaded. Check your connection and try again."
          );
          setMapLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // Map sirf ek dafa banta hy — providers/selected mount par fix hain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
    className="prov-map-overlay"
    onClick={(event) => {
      event.stopPropagation();
      onClose();
    }}
  >
      <div className="prov-map-card" onClick={(event) => event.stopPropagation()}>
        <div className="prov-map-head">
          <div>
            <h3>Provider Locations</h3>
            <p>
              {selected
                ? `"${selected.name || "Provider"}" is highlighted on the map.`
                : "All providers with a location are shown."}
            </p>
          </div>
          <button
            className="prov-panel-close prov-map-close"
            type="button"
            onClick={onClose}
            aria-label="Close map"
          >
            <X size={18} />
          </button>
        </div>
        <div className="prov-map-body">
          <div ref={mapRef} className="prov-map-canvas" />
          {mapLoading ? (
            <div className="prov-map-status">
              <Loader2 className="prov-spin" size={18} /> Loading map...
            </div>
          ) : null}
          {mapError ? (
            <div className="prov-map-status prov-map-error">{mapError}</div>
          ) : null}
          {!mapLoading && !mapError && pins.length === 0 ? (
            <div className="prov-map-status">
              No provider locations available yet. Locations appear after
              providers set their service location in the app.
            </div>
          ) : null}
        </div>
        <div className="prov-map-foot">
          <span>
            <i style={{ background: "#f6b300" }} /> Selected
          </span>
          <span>
            <i style={{ background: "#22a355" }} /> Online
          </span>
          <span>
            <i style={{ background: "#2369e8" }} /> Busy
          </span>
          <span>
            <i style={{ background: "#9aa0a6" }} /> Offline
          </span>
          <span className="prov-map-count">
            {pins.length} of {providers.length} providers on the map
            {selected && !selectedCoords
              ? ` • ${selected.name || "Selected provider"} has no location set`
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
}


// ─── Step 7: Send Message modal (row menu + detail panel dono use karte) ────
function ProviderMessageModal({
  provider,
  onClose,
  onSent,
}: {
  provider: ProviderListItem;
  onClose: () => void;
  onSent: (text: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendProviderMessage(provider._id, {
        title: title.trim() || undefined,
        message: message.trim(),
      });
      onSent(`Message sent to ${provider.name || "provider"}.`);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
          "Message could not be sent. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div className="prov-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Send Message</h3>
        <p>
          To {provider.name || "provider"} — the message is saved in their app
          inbox and also sent as a push notification.
        </p>
        <label className="prov-field">
          <span>Title (optional)</span>
          <input
            className="prov-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Message from OWVO"
            maxLength={80}
          />
        </label>
        <label className="prov-field">
          <span>Message</span>
          <textarea
            className="prov-textarea"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message..."
            maxLength={1000}
          />
        </label>
        <div className="prov-char-count">{message.length}/1000</div>
        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            disabled={busy}
            onClick={send}
          >
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Send size={14} />} Send Message
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Step 7 fix: Edit Provider modal (menu + panel footer dono use karte) ───
function EditProviderModal({
  provider,
  onClose,
  onSaved,
}: {
  provider: ProviderListItem;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: provider.name || "",
    phoneNumber: provider.phoneNumber || "",
    serviceArea: provider.serviceArea || "",
    streetAddress: provider.providerAddress?.streetAddress || "",
    city: provider.providerAddress?.city || "",
    postcode: provider.providerAddress?.postcode || "",
    country: provider.providerAddress?.country || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set =
    (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const submit = async () => {
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!form.phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateAdminProviderProfile(provider._id, {
        name: form.name.trim(),
        phoneNumber: form.phoneNumber.trim(),
        serviceArea: form.serviceArea.trim(),
        providerAddress: {
          streetAddress: form.streetAddress.trim(),
          city: form.city.trim(),
          postcode: form.postcode.trim(),
          country: form.country.trim(),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["washers"] });
      await queryClient.invalidateQueries({
        queryKey: ["provider-detail", provider._id],
      });
      onSaved(`Provider ${form.name.trim()} updated.`);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
          "Changes could not be saved. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div className="prov-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Edit Provider</h3>
        <p>Basic profile details for {provider.name || "this provider"}.</p>
        <label className="prov-field">
          <span>Full name</span>
          <input className="prov-input" value={form.name} onChange={set("name")} autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>Phone number</span>
          <input className="prov-input" value={form.phoneNumber} onChange={set("phoneNumber")} autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>Service area</span>
          <input className="prov-input" value={form.serviceArea} onChange={set("serviceArea")} placeholder="e.g. Birmingham" autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>Street address</span>
          <input className="prov-input" value={form.streetAddress} onChange={set("streetAddress")} autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>City</span>
          <input className="prov-input" value={form.city} onChange={set("city")} autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>Postcode</span>
          <input className="prov-input" value={form.postcode} onChange={set("postcode")} autoComplete="off" />
        </label>
        <label className="prov-field">
          <span>Country</span>
          <input className="prov-input" value={form.country} onChange={set("country")} autoComplete="off" />
        </label>
        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button className="prov-btn prov-btn-ghost" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="prov-btn prov-btn-primary" type="button" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Save size={14} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 7: Add Provider modal ─────────────────────────────────────────────
function AddProviderModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    serviceArea: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set =
    (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const submit = async () => {
    if (!form.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("A valid email address is required.");
      return;
    }
    if (!form.phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await createAdminProvider({
        name: form.name.trim(),
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
        password: form.password,
        serviceArea: form.serviceArea.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["washers"] });
      onCreated(
        `Provider ${form.name.trim()} created. They can log in to the provider app now and will show as Pending until their documents are verified.`
      );
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
          "Provider could not be created. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div className="prov-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Add Provider</h3>
        <p>
          Creates a provider account. The provider completes their documents
          and bank details in the app; the account shows as Pending until
          verification is approved.
        </p>
        <label className="prov-field">
          <span>Full name</span>
          <input
            className="prov-input"
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. John Smith"
            autoComplete="off"
          />
        </label>
        <label className="prov-field">
          <span>Email</span>
          <input
            className="prov-input"
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="provider@example.com"
            autoComplete="off"
          />
        </label>
        <label className="prov-field">
          <span>Phone number</span>
          <input
            className="prov-input"
            value={form.phoneNumber}
            onChange={set("phoneNumber")}
            placeholder="+44..."
            autoComplete="off"
          />
        </label>
        <label className="prov-field">
          <span>Password (min 6 characters)</span>
          <input
            className="prov-input"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="Set a starting password"
            autoComplete="new-password"
          />
        </label>
        <label className="prov-field">
          <span>Service area (optional)</span>
          <input
            className="prov-input"
            value={form.serviceArea}
            onChange={set("serviceArea")}
            placeholder="e.g. Birmingham"
            autoComplete="off"
          />
        </label>
        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            disabled={busy}
            onClick={submit}
          >
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Plus size={14} />} Create Provider
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderDetailPanel({
  provider,
  displayId,
  allProviders,
  onClose,
  onAction,
  onMessage,
  onEdit,
  tab,
  onTabChange,
}: {
  provider: ProviderListItem;
  displayId: string;
  allProviders: ProviderListItem[];
  onClose: () => void;
  onAction: (kind: ProviderActionKind, provider: ProviderListItem) => void;
  onMessage: (provider: ProviderListItem) => void;
  onEdit: (provider: ProviderListItem) => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: ["provider-detail", provider._id],
    queryFn: () => getAdminProviderDetail(provider._id),
  });
  const detail = detailQuery.data;
  const d = detail?.provider as PanelProviderDetail | undefined;
  const queryClient = useQueryClient();

  // ─── Step 5: panel snackbar (Call/Message notices, tab actions) ───
  const [panelToast, setPanelToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!panelToast) return;
    const timer = setTimeout(() => setPanelToast(null), 3600);
    return () => clearTimeout(timer);
  }, [panelToast]);
  const notify = (type: "success" | "error" | "info", text: string) =>
    setPanelToast({ type, text });
  const serverError = (error: unknown) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || "Something went wrong. Check your connection and try again.";
  const refreshDetail = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["provider-detail", provider._id],
    });
    await queryClient.invalidateQueries({ queryKey: ["washers"] });
  };

  // ─── Step 5: Documents tab — verification approve / reject ───
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const handleApprove = async () => {
    setVerifyBusy(true);
    try {
      await updateProviderVerification(provider._id, { status: "approved" });
      notify("success", "Provider verification approved.");
      setRejectOpen(false);
      await refreshDetail();
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setVerifyBusy(false);
    }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      notify("error", "Rejection reason is required.");
      return;
    }
    setVerifyBusy(true);
    try {
      await updateProviderVerification(provider._id, {
        status: "rejected",
        rejectionReason: rejectReason.trim(),
      });
      notify("success", "Provider verification rejected.");
      setRejectOpen(false);
      setRejectReason("");
      await refreshDetail();
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setVerifyBusy(false);
    }
  };

  // ─── Step 5: Services tab — daily wash limit ───
  useEffect(() => {
    setRejectOpen(false);
    setRejectReason("");
  }, [provider._id]);

  // ─── Step 7: Notes tab ───
  const notesQuery = useQuery({
    queryKey: ["provider-notes", provider._id],
    queryFn: () => getProviderNotes(provider._id),
    enabled: tab === "notes",
  });
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteDeleteBusy, setNoteDeleteBusy] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );
  const submitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    setNoteBusy(true);
    try {
      await addProviderNote(provider._id, noteText.trim());
      setNoteText("");
      await queryClient.invalidateQueries({
        queryKey: ["provider-notes", provider._id],
      });
      notify("success", "Note added.");
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setNoteBusy(false);
    }
  };
  const removeNote = async (noteId: string) => {
    setNoteDeleteBusy(true);
    try {
      await deleteProviderNote(provider._id, noteId);
      setConfirmDeleteNoteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["provider-notes", provider._id],
      });
      notify("success", "Note deleted.");
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setNoteDeleteBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const status = providerDisplayStatus(provider);
  const photoUrl = resolveReportPhotoUrl(provider.photo?.url);
  const fmtDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "—";
  const fmtDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} • ${date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };
  const joinParts = (parts: Array<string | undefined>) =>
    parts
      .map((part) => (part || "").trim())
      .filter(Boolean)
      .join(", ") || "Not provided";

  const ratingAverage = detail
    ? detail.stats.ratingAverage
    : provider.customerRatingAverage || 0;
  const ratingCount = detail
    ? detail.stats.ratingCount
    : provider.customerRatingCount || 0;
  const totalJobs = detail
    ? detail.stats.totalJobs
    : provider.completedJobs?.allTime || 0;
  // Services tab + Overview me sirf provider ki ACTIVE services dikhti hain
  // (user directive) — admin yahan se provider ki services change nahi karta.
  const activeServices = (detail?.services || []).filter(
    (service) => service.isActive
  );
  // Step 6 — Earnings/Bookings tabs ka data (detail endpoint ke naye fields;
  // purane backend par ye arrays undefined hongay, is liye safe defaults).
  const earn = detail?.earnings;
  const payouts = (
    detail as
      | (AdminProviderDetail & {
          payouts?: Array<{
            _id: string;
            amount: number;
            status: string;
            payoutDate?: string | null;
            paidAt?: string | null;
            failureReason?: string;
            createdAt: string;
          }>;
        })
      | undefined
  )?.payouts || [];
  const completedJobs = (
    detail as
      | (AdminProviderDetail & {
          completedJobs?: Array<{
            _id: string;
            ref: string;
            serviceTitle: string;
            customerName: string;
            finalPrice: number;
            bookingDate?: string;
            completedAt?: string;
            createdAt: string;
          }>;
        })
      | undefined
  )?.completedJobs || [];
  const dailyLimit = (
    detail as
      | (AdminProviderDetail & {
          dailyLimit?: {
            max: number;
            remaining: number;
            completedToday?: number | null;
          };
        })
      | undefined
  )?.dailyLimit;
  const bookingStatusLabel: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    arrived: "Arrived",
    ongoing: "Ongoing",
    completed: "Completed",
    cancelled: "Cancelled",
    declined: "Declined",
  };

  const verificationStatus = d?.adminVerification?.status || "not_submitted";
  const docState = (present: boolean): "verified" | "uploaded" | "missing" =>
    !present ? "missing" : verificationStatus === "approved" ? "verified" : "uploaded";
  const identityPresent = Boolean(
    d?.identityVerification?.idFile?.url ||
      d?.identityVerification?.passportOrDrivingLicenseFile?.url
  );
  const docRows: Array<{ label: string; state: "verified" | "uploaded" | "missing" }> = [
    { label: "Identity Document", state: docState(identityPresent) },
    { label: "Insurance Document", state: docState(Boolean(d?.insurance?.document?.url)) },
    {
      label: "Public Liability Insurance",
      state: docState(Boolean(d?.publicLiabilityInsurance?.document?.url)),
    },
    {
      label: "Bank Details",
      state: docState(Boolean(d?.isBankCompleted || d?.bankDetails?.accountNumber)),
    },
  ];

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "documents", label: "Documents", step: "Step 5" },
    { key: "services", label: "Services", step: "Step 5" },
    { key: "earnings", label: "Earnings", step: "Step 6" },
    { key: "bookings", label: "Bookings", step: "Step 6" },
    { key: "notes", label: "Notes", step: "Step 7" },
  ];

  return (
    <div className="prov-panel-overlay" onClick={onClose}>
      <aside className="prov-panel" onClick={(event) => event.stopPropagation()}>
        <button className="prov-panel-close" type="button" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>

        <div className="prov-panel-head">
          {photoUrl ? (
            <span className="prov-panel-avatar person-photo-shell">
              <span>{initials(provider.name || provider.email, "P")}</span>
              <img
                alt={provider.name || "Provider"}
                src={photoUrl}
                onError={(event) => {
                  event.currentTarget.remove();
                }}
              />
            </span>
          ) : (
            <span className="prov-panel-avatar">
              {initials(provider.name || provider.email, "P")}
            </span>
          )}
          <div className="prov-panel-title">
            <h2>{provider.name || "Provider"}</h2>
            <div className="prov-panel-meta">
              <span className={`prov-badge prov-badge-${status}`}>
                {status === "active" ? "Active" : status === "pending" ? "Pending" : "Inactive"}
              </span>
              <span className={provider.isOnline ? "prov-online" : "prov-offline"}>
                {provider.isOnline ? "Online now" : "Offline"}
              </span>
            </div>
            <p>
              #{displayId} • Joined {fmtDate(provider.createdAt)}
            </p>
            <p className="prov-panel-rating">
              <Star size={14} /> {ratingAverage ? Number(ratingAverage).toFixed(1) : "—"} ({ratingCount} reviews) • {totalJobs} jobs completed
            </p>
          </div>
        </div>

        <div className="prov-panel-actions">
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => notify("info", "Calling is coming in the next phase.")}
          >
            <Phone size={15} /> Call
          </button>
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => onMessage(provider)}
          >
            <MessageSquareText size={15} /> Message
          </button>
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => setMapOpen(true)}
          >
            <MapPin size={15} /> View on Map
          </button>
        </div>

        <div className="prov-panel-contact">
          <span>
            <Phone size={14} /> {provider.phoneNumber || "No phone"}
          </span>
          <span>
            <Mail size={14} /> {provider.email || "No email"}
          </span>
          <span>
            <MapPin size={14} /> {provider.serviceArea || "Area not set"}
          </span>
        </div>

        <div className="prov-tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "active" : ""}
              type="button"
              onClick={() => onTabChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="prov-panel-body">
          {tab === "notes" ? (
            <>
              <form className="prov-note-form" onSubmit={submitNote}>
                <label className="prov-field">
                  <span>Add a note about this provider</span>
                  <textarea
                    className="prov-textarea"
                    placeholder="e.g. Called about the insurance renewal — provider will re-upload this week."
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    maxLength={2000}
                  />
                </label>
                <div className="prov-note-form-foot">
                  <small>{noteText.length}/2000</small>
                  <button
                    className="prov-btn prov-btn-primary"
                    type="submit"
                    disabled={noteBusy || !noteText.trim()}
                  >
                    {noteBusy ? <Loader2 className="prov-spin" size={14} /> : <Plus size={14} />} Add Note
                  </button>
                </div>
              </form>

              {notesQuery.isLoading ? (
                <div className="prov-state">
                  <Loader2 className="prov-spin" size={18} /> Loading notes...
                </div>
              ) : notesQuery.isError ? (
                <div className="prov-error">
                  <TriangleAlert size={20} />
                  <div>
                    <strong>Connection error</strong>
                    <p>Notes could not be loaded. Check your connection and try again.</p>
                  </div>
                  <button className="prov-retry" type="button" onClick={() => notesQuery.refetch()}>
                    <RefreshCw size={14} /> Retry
                  </button>
                </div>
              ) : (notesQuery.data || []).length === 0 ? (
                <p className="prov-muted">
                  No notes yet. Notes are only visible to the admin team — the
                  provider cannot see them.
                </p>
              ) : (
                <ul className="prov-notes-list">
                  {(notesQuery.data || []).map((note) => (
                    <li key={note._id} className="prov-note-card">
                      <div className="prov-note-head">
                        <strong>{note.authorName}</strong>
                        {note.authorRole ? <span className="prov-note-role">{note.authorRole}</span> : null}
                        <span className="prov-note-time">{relativeDate(note.createdAt)}</span>
                        {confirmDeleteNoteId === note._id ? (
                          <span className="prov-note-confirm">
                            Delete?
                            <button type="button" className="prov-note-yes" disabled={noteDeleteBusy} onClick={() => removeNote(note._id)}>
                              Yes
                            </button>
                            <button type="button" className="prov-note-no" onClick={() => setConfirmDeleteNoteId(null)}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="prov-note-del"
                            aria-label="Delete note"
                            onClick={() => setConfirmDeleteNoteId(note._id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p>{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : detailQuery.isLoading ? (
            <div className="prov-state">
              <Loader2 className="prov-spin" size={18} /> Loading provider details...
            </div>
          ) : detailQuery.isError || !detail ? (
            <div className="prov-error">
              <TriangleAlert size={20} />
              <div>
                <strong>Connection error</strong>
                <p>Provider details could not be loaded. Check your connection and try again.</p>
              </div>
              <button className="prov-retry" type="button" onClick={() => detailQuery.refetch()}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : tab === "overview" ? (
            <>
              <div className="prov-mini-cards">
                <article>
                  <strong>{detail.stats.totalJobs}</strong>
                  <span>Total Jobs</span>
                </article>
                <article>
                  <strong>
                    {detail.stats.completionRate === null ? "—" : `${detail.stats.completionRate}%`}
                  </strong>
                  <span>Completion Rate</span>
                </article>
                <article>
                  <strong>{detail.stats.ratingAverage ? detail.stats.ratingAverage.toFixed(1) : "—"}</strong>
                  <span>Rating ({detail.stats.ratingCount})</span>
                </article>
                <article>
                  <strong>{money(detail.earnings.totalEarnings)}</strong>
                  <span>Total Earnings</span>
                </article>
              </div>

              <h4 className="prov-section-title">Basic Information</h4>
              <dl className="prov-info">
                <div>
                  <dt>Full Name</dt>
                  <dd>{d?.name || provider.name || "—"}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{d?.email || provider.email || "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{d?.phoneNumber || provider.phoneNumber || "—"}</dd>
                </div>
                <div>
                  <dt>Service Area</dt>
                  <dd>{d?.serviceArea || provider.serviceArea || "—"}</dd>
                </div>
                <div>
                  <dt>Home Address</dt>
                  <dd>
                    {joinParts([
                      d?.providerAddress?.streetAddress,
                      d?.providerAddress?.city,
                      d?.providerAddress?.postcode,
                      d?.providerAddress?.country,
                    ])}
                  </dd>
                </div>
                <div>
                  <dt>Service Location</dt>
                  <dd>
                    {joinParts([
                      d?.serviceLocationAddress?.streetAddress,
                      d?.serviceLocationAddress?.city,
                      d?.serviceLocationAddress?.postcode,
                    ])}
                  </dd>
                </div>
                <div>
                  <dt>Joined</dt>
                  <dd>{fmtDate(d?.createdAt || provider.createdAt)}</dd>
                </div>
                <div>
                  <dt>Daily Booking Limit</dt>
                  <dd>
                    {dailyLimit
                      ? `${dailyLimit.remaining} of ${dailyLimit.max} remaining today`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Account</dt>
                  <dd>{provider.accountStatus === "disabled" ? "Deactivated" : "Enabled"}</dd>
                </div>
              </dl>

              <h4 className="prov-section-title">
                Verification
                <span className={`prov-verify-chip prov-verify-${verificationStatus}`}>
                  {verificationStatus === "approved"
                    ? "Verified"
                    : verificationStatus === "pending"
                      ? "Under review"
                      : verificationStatus === "rejected"
                        ? "Rejected"
                        : "Not submitted"}
                </span>
              </h4>
              {d?.adminVerification?.rejectionReason ? (
                <p className="prov-reject-reason">
                  Rejection reason: {d.adminVerification.rejectionReason}
                </p>
              ) : null}
              <ul className="prov-doc-list">
                {docRows.map((row) => (
                  <li key={row.label}>
                    <span>{row.label}</span>
                    <span className={`prov-doc-state prov-doc-${row.state}`}>
                      {row.state === "verified" ? (
                        <>
                          <ShieldCheck size={14} /> Verified
                        </>
                      ) : row.state === "uploaded" ? (
                        <>
                          <Clock size={14} /> Uploaded
                        </>
                      ) : (
                        <>
                          <TriangleAlert size={14} /> Missing
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <h4 className="prov-section-title">
                Services Offered
                <button
                  className="prov-link-button"
                  type="button"
                  onClick={() => onTabChange("services")}
                >
                  View Services
                </button>
              </h4>
              {activeServices.length === 0 ? (
                <p className="prov-muted">No active services yet.</p>
              ) : (
                <ul className="prov-service-list">
                  {activeServices.map((service) => (
                    <li key={service._id}>
                      <span>
                        <span
                          className={`prov-dot ${service.isActive ? "prov-dot-on" : "prov-dot-off"}`}
                        />
                        {service.title}
                      </span>
                      <strong>{money(service.price)}</strong>
                    </li>
                  ))}
                </ul>
              )}

              <h4 className="prov-section-title">Recent Activity</h4>
              {detail.recentActivity.length === 0 ? (
                <p className="prov-muted">No recent activity.</p>
              ) : (
                <ul className="prov-activity-list">
                  {detail.recentActivity.map((item, index) => (
                    <li key={`${item.type}-${index}`}>
                      <span className="prov-activity-icon">
                        {item.type === "booking_completed" ? (
                          <CarFront size={15} />
                        ) : item.type === "payout" ? (
                          <BadgePoundSterling size={15} />
                        ) : item.type === "review" ? (
                          <Star size={15} />
                        ) : (
                          <ShieldCheck size={15} />
                        )}
                      </span>
                      <span className="prov-activity-text">
                        <strong>{item.title}</strong>
                        <small>
                          {[item.ref, item.amount != null ? money(item.amount) : null, item.stars ? `Rated ${item.stars} stars` : null]
                            .filter(Boolean)
                            .join(" • ")}
                        </small>
                      </span>
                      <span className="prov-activity-time">
                        {item.createdAt ? relativeDate(item.createdAt) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : tab === "documents" ? (
            <>
              <div className="prov-verify-bar">
                <div>
                  <strong>Verification status: </strong>
                  <span className={`prov-verify-chip prov-verify-${verificationStatus}`}>
                    {verificationStatus === "approved"
                      ? "Verified"
                      : verificationStatus === "pending"
                        ? "Under review"
                        : verificationStatus === "rejected"
                          ? "Rejected"
                          : "Not submitted"}
                  </span>
                  {d?.adminVerification?.reviewedAt ? (
                    <small> • Reviewed {fmtDate(d.adminVerification.reviewedAt)}</small>
                  ) : null}
                </div>
                <div className="prov-verify-actions">
                  {verificationStatus !== "approved" ? (
                    <button
                      className="prov-btn prov-btn-primary"
                      type="button"
                      disabled={verifyBusy}
                      onClick={handleApprove}
                    >
                      {verifyBusy ? <Loader2 className="prov-spin" size={14} /> : <ShieldCheck size={14} />} Approve
                    </button>
                  ) : null}
                  {verificationStatus !== "rejected" ? (
                    <button
                      className="prov-btn prov-btn-ghost prov-btn-outline-danger"
                      type="button"
                      disabled={verifyBusy}
                      onClick={() => setRejectOpen((value) => !value)}
                    >
                      <Ban size={14} /> Reject
                    </button>
                  ) : null}
                </div>
              </div>

              {d?.adminVerification?.rejectionReason ? (
                <p className="prov-reject-reason">
                  Rejection reason: {d.adminVerification.rejectionReason}
                </p>
              ) : null}

              {rejectOpen ? (
                <div className="prov-reject-box">
                  <label className="prov-field">
                    <span>Rejection reason (required)</span>
                    <textarea
                      className="prov-textarea"
                      placeholder="e.g. Insurance document is expired, please re-upload"
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                  </label>
                  <div className="prov-reject-actions">
                    <button
                      className="prov-btn prov-btn-ghost"
                      type="button"
                      disabled={verifyBusy}
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="prov-btn prov-btn-danger"
                      type="button"
                      disabled={verifyBusy}
                      onClick={handleReject}
                    >
                      {verifyBusy ? <Loader2 className="prov-spin" size={14} /> : null} Reject Provider
                    </button>
                  </div>
                </div>
              ) : null}

              {(() => {
                const overallApproved = verificationStatus === "approved";
                const stateFrom = (
                  present: boolean,
                  own?: string
                ): { label: string; cls: string } => {
                  if (!present) return { label: "Missing", cls: "missing" };
                  if (own === "approved" || own === "verified")
                    return { label: "Verified", cls: "verified" };
                  if (own === "rejected") return { label: "Rejected", cls: "missing" };
                  if (overallApproved) return { label: "Verified", cls: "verified" };
                  return { label: "Pending", cls: "uploaded" };
                };
                const identityUrl =
                  d?.identityVerification?.passportOrDrivingLicenseFile?.url ||
                  d?.identityVerification?.idFile?.url ||
                  "";
                const docType = d?.identityVerification?.documentType || "";
                const expiry = d?.publicLiabilityInsurance?.expiryDate
                  ? new Date(d.publicLiabilityInsurance.expiryDate)
                  : null;
                const daysToExpiry = expiry
                  ? Math.ceil((expiry.getTime() - Date.now()) / 86400000)
                  : null;
                const cards: Array<{
                  title: string;
                  sub: string;
                  url?: string;
                  state: { label: string; cls: string };
                  warn?: string;
                }> = [
                  {
                    title: "Identity Document",
                    sub: [
                      docType === "passport"
                        ? "Passport"
                        : docType === "driving_license"
                          ? "Driving License"
                          : null,
                      d?.identityVerification?.documentNumber
                        ? `No: ${d.identityVerification.documentNumber}`
                        : null,
                      d?.identityVerification?.submittedAt
                        ? `Submitted ${fmtDate(d.identityVerification.submittedAt)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Not submitted yet",
                    url: identityUrl,
                    state: stateFrom(Boolean(identityUrl), d?.identityVerification?.status),
                  },
                  {
                    title: "Driving License",
                    sub:
                      docType === "driving_license"
                        ? "Same document as identity (driving license used)"
                        : docType === "passport"
                          ? "Passport was used as the identity document"
                          : "Not uploaded",
                    url: docType === "driving_license" ? identityUrl : "",
                    state:
                      docType === "driving_license"
                        ? stateFrom(Boolean(identityUrl), d?.identityVerification?.status)
                        : { label: "Missing", cls: "missing" },
                  },
                  {
                    title: "Insurance Document",
                    sub: d?.insurance?.uploadedAt
                      ? `Uploaded ${fmtDate(d.insurance.uploadedAt)}`
                      : "Not uploaded",
                    url: d?.insurance?.document?.url || "",
                    state: stateFrom(Boolean(d?.insurance?.document?.url)),
                  },
                  {
                    title: "Public Liability Insurance",
                    sub: [
                      d?.publicLiabilityInsurance?.insuranceCompany || null,
                      d?.publicLiabilityInsurance?.policyNumber
                        ? `Policy: ${d.publicLiabilityInsurance.policyNumber}`
                        : null,
                      expiry ? `Expires ${fmtDate(d?.publicLiabilityInsurance?.expiryDate)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ") || "Not uploaded",
                    url: d?.publicLiabilityInsurance?.document?.url || "",
                    state: stateFrom(
                      Boolean(d?.publicLiabilityInsurance?.document?.url),
                      d?.publicLiabilityInsurance?.status
                    ),
                    warn:
                      daysToExpiry !== null && daysToExpiry < 0
                        ? "Expired"
                        : daysToExpiry !== null && daysToExpiry <= 30
                          ? `Expiring in ${daysToExpiry} days`
                          : undefined,
                  },
                  {
                    title: "Driveway Photo",
                    sub: d?.drivewayPhoto?.uploadedAt
                      ? `Uploaded ${fmtDate(d.drivewayPhoto.uploadedAt)}`
                      : "Not uploaded",
                    url: d?.drivewayPhoto?.document?.url || "",
                    state: stateFrom(Boolean(d?.drivewayPhoto?.document?.url)),
                  },
                  {
                    title: "Vehicle Document",
                    sub: "Vehicle documents are not collected during provider onboarding",
                    url: "",
                    state: { label: "Not collected", cls: "uploaded" },
                  },
                ];
                return (
                  <div className="prov-doc-cards">
                    {cards.map((card) => (
                      <article key={card.title} className="prov-doc-card">
                        {card.url && /\.(png|jpe?g|webp)(\?|$)/i.test(card.url) ? (
                          <img
                            className="prov-doc-thumb"
                            src={resolveReportPhotoUrl(card.url)}
                            alt={card.title}
                          />
                        ) : (
                          <span className="prov-doc-icon">
                            <FileText size={20} />
                          </span>
                        )}
                        <div className="prov-doc-main">
                          <strong>{card.title}</strong>
                          <small>{card.sub}</small>
                          {card.warn ? (
                            <small className="prov-doc-warn">
                              <TriangleAlert size={12} /> {card.warn}
                            </small>
                          ) : null}
                        </div>
                        <span className={`prov-doc-state prov-doc-${card.state.cls}`}>
                          {card.state.label}
                        </span>
                        {card.url ? (
                          <a
                            className="prov-doc-view"
                            href={resolveReportPhotoUrl(card.url)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Eye size={14} /> View
                          </a>
                        ) : null}
                      </article>
                    ))}

                    <article className="prov-doc-card">
                      <span className="prov-doc-icon">
                        <CreditCard size={20} />
                      </span>
                      <div className="prov-doc-main">
                        <strong>Bank Details</strong>
                        <small>
                          {[
                            d?.bankDetails?.accountHolderName || null,
                            d?.bankDetails?.bankName || null,
                            d?.bankDetails?.accountNumber
                              ? `Acc: ${d.bankDetails.accountNumber}`
                              : null,
                            d?.bankDetails?.sortCode
                              ? `Sort: ${d.bankDetails.sortCode}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" • ") || "Not provided"}
                        </small>
                      </div>
                      <span
                        className={`prov-doc-state prov-doc-${
                          d?.isBankCompleted || d?.bankDetails?.accountNumber
                            ? overallApproved
                              ? "verified"
                              : "uploaded"
                            : "missing"
                        }`}
                      >
                        {d?.isBankCompleted || d?.bankDetails?.accountNumber
                          ? overallApproved
                            ? "Verified"
                            : "Provided"
                          : "Missing"}
                      </span>
                    </article>
                  </div>
                );
              })()}
            </>
          ) : tab === "earnings" ? (
            <>
              <div className="prov-mini-cards">
                <article>
                  <strong>{money(earn?.totalEarnings ?? 0)}</strong>
                  <span>Total Earnings (net)</span>
                </article>
                <article>
                  <strong>{money(earn?.walletBalance ?? 0)}</strong>
                  <span>Wallet Balance</span>
                </article>
                <article>
                  <strong>{money(earn?.paidOut ?? 0)}</strong>
                  <span>Paid Out</span>
                </article>
                <article>
                  <strong>{money(earn?.pendingPayouts ?? 0)}</strong>
                  <span>Pending Payouts</span>
                </article>
              </div>

              <div className="prov-earn-stats">
                <div>
                  <span>Today</span>
                  <strong>{money(earn?.todayNet ?? 0)}</strong>
                </div>
                <div>
                  <span>This week</span>
                  <strong>{money(earn?.weekNet ?? 0)}</strong>
                </div>
                <div>
                  <span>Tips (paid in full)</span>
                  <strong>{money(earn?.tipsTotal ?? 0)}</strong>
                </div>
                <div>
                  <span>Gross (before commission)</span>
                  <strong>{money(earn?.totalGross ?? 0)}</strong>
                </div>
              </div>
              <p className="prov-muted prov-services-note">
                Platform commission is {Math.round((earn?.commissionRate ?? 0.25) * 100)}%.
                Net amounts are after commission; tips are paid to the provider
                in full.
              </p>

              <h4 className="prov-section-title">Earnings by Booking</h4>
              {completedJobs.length === 0 ? (
                <p className="prov-muted">No completed jobs yet.</p>
              ) : (
                <div className="prov-earn-table-wrap">
                  <table className="prov-earn-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Service</th>
                        <th>Gross</th>
                        <th>Commission</th>
                        <th>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {completedJobs.map((job) => {
                        const gross = Number(job.finalPrice) || 0;
                        const commission =
                          Math.round(gross * (earn?.commissionRate ?? 0.25) * 100) / 100;
                        const net = Math.round((gross - commission) * 100) / 100;
                        return (
                          <tr key={job._id}>
                            <td>
                              <strong>{job.ref}</strong>
                              <small>{fmtDate(job.completedAt || job.bookingDate)}</small>
                            </td>
                            <td>
                              {job.serviceTitle}
                              <small>{job.customerName}</small>
                            </td>
                            <td>{money(gross)}</td>
                            <td className="prov-earn-neg">−{money(commission)}</td>
                            <td>
                              <strong>{money(net)}</strong>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {completedJobs.length > 0 ? (
                <p className="prov-muted prov-services-note">
                  Latest {completedJobs.length} completed jobs.
                </p>
              ) : null}

              <h4 className="prov-section-title">Payout History</h4>
              {payouts.length === 0 ? (
                <p className="prov-muted">No payouts yet.</p>
              ) : (
                <ul className="prov-payout-list">
                  {payouts.map((payout) => (
                    <li key={payout._id}>
                      <span className="prov-doc-icon">
                        <CreditCard size={18} />
                      </span>
                      <span className="prov-payout-main">
                        <strong>{money(payout.amount)}</strong>
                        <small>
                          {fmtDate(payout.paidAt || payout.payoutDate || payout.createdAt)}
                          {payout.status === "failed" && payout.failureReason
                            ? ` • ${payout.failureReason}`
                            : ""}
                        </small>
                      </span>
                      <span className={`prov-payout-status prov-payout-${payout.status}`}>
                        {payout.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : tab === "bookings" ? (
            <>
              <div className="prov-bk-counts">
                <span>
                  Completed <strong>{detail.stats.counts.completed}</strong>
                </span>
                <span>
                  Active <strong>{detail.stats.counts.active}</strong>
                </span>
                <span>
                  Cancelled <strong>{detail.stats.counts.cancelled}</strong>
                </span>
                <span>
                  Declined <strong>{detail.stats.counts.declined}</strong>
                </span>
              </div>

              {detail.recentBookings.length === 0 ? (
                <p className="prov-muted">No bookings yet.</p>
              ) : (
                <ul className="prov-bk-list">
                  {detail.recentBookings.map((booking) => (
                    <li key={booking._id}>
                      <button
                        className="prov-bk-row"
                        type="button"
                        onClick={() =>
                          (window.location.href = `/bookings/${booking._id}`)
                        }
                      >
                        {booking.customerPhoto ? (
                          <img
                            className="prov-bk-avatar"
                            src={resolveReportPhotoUrl(booking.customerPhoto)}
                            alt={booking.customerName}
                          />
                        ) : (
                          <span className="prov-bk-initials">
                            {initials(booking.customerName)}
                          </span>
                        )}
                        <span className="prov-bk-main">
                          <strong>{booking.customerName}</strong>
                          <small>
                            {booking.serviceTitle} •{" "}
                            {fmtDateTime(booking.bookingDate || booking.createdAt)}
                          </small>
                        </span>
                        <span className="prov-bk-side">
                          <strong>{money(booking.finalPrice)}</strong>
                          <span
                            className={`prov-bk-status prov-bk-${booking.status}`}
                          >
                            {bookingStatusLabel[booking.status] || booking.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {detail.recentBookings.length > 0 ? (
                <p className="prov-muted prov-services-note">
                  Latest {detail.recentBookings.length} bookings. Click a booking
                  to open its full detail page.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h4 className="prov-section-title">Provider Services</h4>
              <p className="prov-muted prov-services-note">
                These are the services this provider has activated in their
                app. Only the provider can switch their services on or off —
                this list is for viewing only.
              </p>
              {activeServices.length === 0 ? (
                <p className="prov-muted">
                  This provider has not activated any services yet. Services
                  appear here when the provider switches them on in their app.
                </p>
              ) : (
                <ul className="prov-toggle-list">
                  {activeServices.map((service) => (
                    <li key={service._id}>
                      <span className="prov-toggle-text">
                        <strong>{service.title}</strong>
                        <small>
                          {[service.serviceType, service.carSize]
                            .filter(Boolean)
                            .join(" • ") || "Standard"}
                        </small>
                      </span>
                      <strong className="prov-toggle-price">
                        {money(service.price)}
                      </strong>
                      <span className="prov-doc-state prov-doc-verified">
                        <ShieldCheck size={14} /> Active
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h4 className="prov-section-title">Daily Booking Limit</h4>
              <div className="prov-limit-row">
                <div>
                  <strong>
                    {dailyLimit
                      ? `${dailyLimit.remaining} washes remaining today`
                      : "—"}
                  </strong>
                  <small>
                    Maximum{" "}
                    {dailyLimit ? dailyLimit.max : "—"} bookings per day —
                    set by admin for all providers.
                  </small>
                </div>
                {dailyLimit ? (
                  <span className="prov-doc-state prov-doc-uploaded">
                    {Math.max(dailyLimit.max - dailyLimit.remaining, 0)} of{" "}
                    {dailyLimit.max} used
                  </span>
                ) : null}
              </div>

              <h4 className="prov-section-title">Working Hours</h4>
              {!d?.availability || d.availability.mode === "always" ? (
                <p className="prov-muted">
                  Always available — the provider has not set a weekly schedule.
                </p>
              ) : (
                <ul className="prov-hours-list">
                  {(
                    [
                      ["monday", "Monday"],
                      ["tuesday", "Tuesday"],
                      ["wednesday", "Wednesday"],
                      ["thursday", "Thursday"],
                      ["friday", "Friday"],
                      ["saturday", "Saturday"],
                      ["sunday", "Sunday"],
                    ] as Array<[string, string]>
                  ).map(([key, label]) => {
                    const day = d.availability?.days?.[key];
                    return (
                      <li key={key}>
                        <span>{label}</span>
                        <strong>
                          {day?.enabled
                            ? `${day.startTime || "08:00"} – ${day.endTime || "17:30"}`
                            : "Closed"}
                        </strong>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="prov-muted prov-services-note">
                Working hours are set by the provider in the app.
              </p>
            </>
          )}
        </div>

      {panelToast ? (
        <div className={`prov-toast prov-toast-${panelToast.type}`}>
          {panelToast.type === "success" ? (
            <UserCheck size={16} />
          ) : panelToast.type === "error" ? (
            <TriangleAlert size={16} />
          ) : (
            <Clock size={16} />
          )}
          {panelToast.text}
        </div>
      ) : null}

        <div className="prov-panel-footer">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            onClick={() => onEdit(provider)}
          >
            <Pencil size={14} /> Edit Profile
          </button>
          {provider.enforcement?.status === "suspended" ||
          provider.enforcement?.status === "banned" ? (
            <button
              className="prov-btn prov-btn-primary"
              type="button"
              onClick={() => onAction("reactivate", provider)}
            >
              <UserCheck size={14} /> Reactivate
            </button>
          ) : (
            <button
              className="prov-btn prov-btn-danger"
              type="button"
              onClick={() => onAction("suspend", provider)}
            >
              <Ban size={14} /> Suspend
            </button>
          )}
          {provider.accountStatus === "disabled" ? (
            <button
              className="prov-btn prov-btn-primary"
              type="button"
              onClick={() => onAction("activate", provider)}
            >
              <Power size={14} /> Activate
            </button>
          ) : (
            <button
              className="prov-btn prov-btn-dark"
              type="button"
              onClick={() => onAction("deactivate", provider)}
            >
              <Power size={14} /> Deactivate
            </button>
          )}
        </div>
      </aside>
      {mapOpen ? (
        <ProviderMapModal
          providers={allProviders}
          selectedId={provider._id}
          onClose={() => setMapOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function WashersPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  // Directory page: the Topbar date range does NOT narrow this list — the
  // backend treats it as a management list ("all" by default). This also
  // removes the old "empty page because the range defaulted to a week" trap.
  const washersQuery = useQuery({
    queryKey: ["washers", "all"],
    queryFn: () => getWashers({ range: "all" }),
    refetchInterval: 30000,
  });
  const washers = (washersQuery.data || []) as ProviderListItem[];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ProviderDisplayStatus>("all");
  const [areaFilter, setAreaFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [onlineFilter, setOnlineFilter] = useState("all");
  const [verifyFilter, setVerifyFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("overview");
  const [editProvider, setEditProvider] = useState<ProviderListItem | null>(
    null
  );
  const openPanel = (provider: ProviderListItem, tab: string = "overview") => {
    setPanelTab(tab);
    setPanelId(provider._id);
  };
  const [messageProvider, setMessageProvider] =
    useState<ProviderListItem | null>(null);

  // ─── Step 3: ••• action menu, confirm modals, toast ───
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [action, setAction] = useState<{
    kind: ProviderActionKind;
    provider: ProviderListItem;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuFor]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const openMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    event.stopPropagation();
    if (menuFor === id) {
      setMenuFor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 380;
    const menuWidth = 228;
    const openUp = rect.bottom + menuHeight + 8 > window.innerHeight;
    setMenuPos({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(8, rect.right - menuWidth),
    });
    setMenuFor(id);
  };

  const menuProvider = menuFor
    ? washers.find((washer) => washer._id === menuFor)
    : undefined;

  const panelProvider = panelId
    ? washers.find((washer) => washer._id === panelId)
    : undefined;

  const openAction = (kind: ProviderActionKind, provider: ProviderListItem) => {
    setMenuFor(null);
    setReason("");
    setActionError("");
    setAction({ kind, provider });
  };

  const runAction = async () => {
    if (!action) return;
    const { kind, provider } = action;
    if (kind === "suspend" && !reason.trim()) {
      setActionError("Reason is required to suspend a provider.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      if (kind === "suspend") {
        await updateProviderEnforcement(provider._id, {
          status: "suspended",
          reason: reason.trim(),
        });
      } else if (kind === "reactivate") {
        await updateProviderEnforcement(provider._id, { status: "clear" });
      } else if (kind === "deactivate") {
        await updateUserAccountStatus(provider._id, "disabled");
      } else if (kind === "activate") {
        await updateUserAccountStatus(provider._id, "active");
      } else if (kind === "delete") {
        await deleteAdminProvider(provider._id);
        setSelected((current) =>
          current.filter((item) => item !== provider._id)
        );
      }
      const messages: Record<ProviderActionKind, string> = {
        suspend: "Provider suspended.",
        reactivate: "Provider reactivated.",
        deactivate: "Provider account deactivated.",
        activate: "Provider account activated.",
        delete: "Provider deleted.",
      };
      setAction(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["washers"] });
      setToast({ type: "success", text: messages[kind] });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "Something went wrong. Check your connection and try again.";
      setActionError(message);
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refreshWashers = () => queryClient.invalidateQueries({ queryKey: ["washers"] });
    socket.on("admin_booking_created", refreshWashers);
    socket.on("admin_booking_status_updated", refreshWashers);
    return () => {
      socket.off("admin_booking_created", refreshWashers);
      socket.off("admin_booking_status_updated", refreshWashers);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  // Display ID (#P001) — a stable number from join order (oldest first), so a
  // provider keeps the same ID no matter how the list is filtered or sorted.
  const idNumbers = useMemo(() => {
    const sorted = [...washers].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    const map = new Map<string, string>();
    sorted.forEach((washer, index) => {
      map.set(washer._id, `P${String(index + 1).padStart(3, "0")}`);
    });
    return map;
  }, [washers]);

  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          washers
            .map((washer) => washer.serviceArea?.trim())
            .filter(Boolean) as string[]
        )
      ).sort(),
    [washers]
  );

  const serviceOptions = useMemo(
    () =>
      Array.from(
        new Set(washers.flatMap((washer) => providerServiceTitles(washer)))
      ).sort(),
    [washers]
  );

  const counts = useMemo(() => {
    const result = {
      total: washers.length,
      active: 0,
      pending: 0,
      inactive: 0,
      joinedThisMonth: 0,
    };
    const now = new Date();
    washers.forEach((washer) => {
      result[providerDisplayStatus(washer)] += 1;
      const joined = washer.createdAt ? new Date(washer.createdAt) : null;
      if (
        joined &&
        joined.getMonth() === now.getMonth() &&
        joined.getFullYear() === now.getFullYear()
      ) {
        result.joinedThisMonth += 1;
      }
    });
    return result;
  }, [washers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return washers.filter((washer) => {
      if (statusFilter !== "all" && providerDisplayStatus(washer) !== statusFilter)
        return false;
      if (areaFilter !== "all" && (washer.serviceArea || "") !== areaFilter)
        return false;
      if (
        serviceFilter !== "all" &&
        !providerServiceTitles(washer).includes(serviceFilter)
      )
        return false;
      if (onlineFilter === "online" && !washer.isOnline) return false;
      if (onlineFilter === "offline" && washer.isOnline) return false;
      if (
        verifyFilter !== "all" &&
        (washer.adminVerification?.status || "not_submitted") !== verifyFilter
      )
        return false;
      if (term) {
        const displayId = idNumbers.get(washer._id) || "";
        const haystack = [
          washer.name || "",
          washer.email || "",
          washer.phoneNumber || "",
          `#${displayId}`,
          displayId,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [
    washers,
    search,
    statusFilter,
    areaFilter,
    serviceFilter,
    onlineFilter,
    verifyFilter,
    idNumbers,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageItems.map((washer) => washer._id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const pageButtons = useMemo(() => {
    const buttons: Array<number | "gap"> = [];
    for (let i = 1; i <= totalPages; i += 1) {
      if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
        buttons.push(i);
      } else if (buttons[buttons.length - 1] !== "gap") {
        buttons.push("gap");
      }
    }
    return buttons;
  }, [totalPages, safePage]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setAreaFilter("all");
    setServiceFilter("all");
    setOnlineFilter("all");
    setVerifyFilter("all");
    setPage(1);
  };

  const toggleSelected = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

  const togglePageSelected = () =>
    setSelected((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds]))
    );

  const pctOfTotal = (value: number) =>
    counts.total > 0 ? `${Math.round((value / counts.total) * 100)}% of total` : "—";

  const joinedLabel = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "—";

  return (
    <section className="data-page">
      <div className="data-page-header prov-header">
        <div>
          <h1>Providers</h1>
          <p>
            Manage service providers, verify documents, track performance and
            control access.
          </p>
        </div>
        <button
          className="primary-button prov-add-button"
          type="button"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} /> Add Provider
        </button>
      </div>

      <div className="prov-stats">
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-blue">
            <Users size={20} />
          </span>
          <div>
            <strong>{counts.total}</strong>
            <span>Total Providers</span>
            <small>
              {counts.joinedThisMonth > 0
                ? `+${counts.joinedThisMonth} joined this month`
                : "Registered providers"}
            </small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-green">
            <UserCheck size={20} />
          </span>
          <div>
            <strong>{counts.active}</strong>
            <span>Active</span>
            <small>{pctOfTotal(counts.active)}</small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-amber">
            <Clock size={20} />
          </span>
          <div>
            <strong>{counts.pending}</strong>
            <span>Pending Approval</span>
            <small>{pctOfTotal(counts.pending)}</small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-red">
            <UserRound size={20} />
          </span>
          <div>
            <strong>{counts.inactive}</strong>
            <span>Inactive</span>
            <small>{pctOfTotal(counts.inactive)}</small>
          </div>
        </article>
      </div>

      <div className="prov-filters">
        <label className="prov-search">
          <Search size={16} />
          <input
            placeholder="Search providers..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="prov-select prov-w-status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "all" | ProviderDisplayStatus);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending Approval</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="prov-select prov-w-area"
          value={areaFilter}
          onChange={(event) => {
            setAreaFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Service Areas</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
        <select
          className="prov-select prov-w-service"
          value={serviceFilter}
          onChange={(event) => {
            setServiceFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Services</option>
          {serviceOptions.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
      <select
        className="prov-select prov-w-availability"
        value={onlineFilter}
        onChange={(event) => {
          setOnlineFilter(event.target.value);
          setPage(1);
        }}
      >
        <option value="all">All Availability</option>
        <option value="online">Online now</option>
        <option value="offline">Offline</option>
      </select>
      <select
        className="prov-select prov-w-verification"
        value={verifyFilter}
        onChange={(event) => {
          setVerifyFilter(event.target.value);
          setPage(1);
        }}
      >
        <option value="all">All Verification</option>
        <option value="approved">Verified</option>
        <option value="pending">Verification pending</option>
        <option value="not_submitted">Not submitted</option>
        <option value="rejected">Rejected</option>
      </select>
        <button className="prov-filter-button" type="button" onClick={resetFilters}>
          <RotateCcw size={15} /> Reset
        </button>
      </div>


      <div className="prov-table-card">
        {selected.length > 0 ? (
          <div className="prov-selected-bar">
            {selected.length} provider{selected.length === 1 ? "" : "s"} selected
          </div>
        ) : null}
        <table className="prov-table">
          <thead>
            <tr>
              <th className="prov-check-cell">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelected}
                />
              </th>
              <th>ID</th>
              <th>Provider</th>
              <th>Service Area</th>
              <th>Services</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="prov-actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((washer) => {
              const status = providerDisplayStatus(washer);
              const titles = providerServiceTitles(washer);
              const photoUrl = resolveReportPhotoUrl(washer.photo?.url);
              return (
                <tr
                  key={washer._id}
                  className={`clickable-row${
                    selected.includes(washer._id) ? " prov-row-selected" : ""
                  }`}
                  onClick={() => openPanel(washer)}
                >
                  <td
                    className="prov-check-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(washer._id)}
                      onChange={() => toggleSelected(washer._id)}
                    />
                  </td>
                  <td className="prov-id">#{idNumbers.get(washer._id)}</td>
                  <td>
                    <div className="inline-person">
                      {photoUrl ? (
                        <span className="small-avatar person-photo-shell">
                          <span>{initials(washer.name || washer.email, "P")}</span>
                          <img
                            alt={washer.name || "Provider"}
                            src={photoUrl}
                            onError={(event) => {
                              event.currentTarget.remove();
                            }}
                          />
                        </span>
                      ) : (
                        <span className="small-avatar">
                          {initials(washer.name || washer.email, "P")}
                        </span>
                      )}
                      <span>
                        <strong>{washer.name || "Provider"}</strong>
                        <small>{washer.phoneNumber || "No phone"}</small>
                      </span>
                    </div>
                  </td>
                  <td>{washer.serviceArea || "Not set"}</td>
                  <td>
                    <div className="prov-chips">
                      {titles.slice(0, 3).map((title, index) => (
                        <span key={title} className={`prov-chip prov-chip-${index % 4}`}>
                          {title}
                        </span>
                      ))}
                      {titles.length > 3 ? (
                        <span className="prov-chip prov-chip-more">
                          +{titles.length - 3} more
                        </span>
                      ) : null}
                      {titles.length === 0 ? (
                        <span className="prov-muted">No services</span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <span className="prov-rating">
                      <Star size={14} />
                      {washer.customerRatingAverage
                        ? Number(washer.customerRatingAverage).toFixed(1)
                        : "—"}
                      {washer.customerRatingCount
                        ? ` (${washer.customerRatingCount})`
                        : ""}
                    </span>
                  </td>
                  <td>
                    <span className={`prov-badge prov-badge-${status}`}>
                      {status === "active"
                        ? "Active"
                        : status === "pending"
                          ? "Pending"
                          : "Inactive"}
                    </span>
                  </td>
                  <td>{joinedLabel(washer.createdAt)}</td>
                  <td
                    className="prov-actions-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="prov-menu-button"
                      type="button"
                      aria-label="Provider actions"
                      onClick={(event) => openMenu(event, washer._id)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {washersQuery.isLoading ? (
          <div className="prov-state">
            <Loader2 className="prov-spin" size={18} /> Loading providers...
          </div>
        ) : null}

        {washersQuery.isError ? (
          <div className="prov-error">
            <TriangleAlert size={20} />
            <div>
              <strong>Connection error</strong>
              <p>Providers could not be loaded. Check your internet connection and try again.</p>
            </div>
            <button
              className="prov-retry"
              type="button"
              onClick={() => washersQuery.refetch()}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : null}

        {!washersQuery.isLoading && !washersQuery.isError && washers.length === 0 ? (
          <EmptyState text="No providers yet. New providers will appear here after they sign up." />
        ) : null}

        {!washersQuery.isLoading &&
        !washersQuery.isError &&
        washers.length > 0 &&
        filtered.length === 0 ? (
          <div className="prov-state">
            <p>No providers match your filters.</p>
            <button className="prov-retry" type="button" onClick={resetFilters}>
              <RotateCcw size={14} /> Reset filters
            </button>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div className="prov-pagination">
            <span>
              Showing {(safePage - 1) * pageSize + 1} to{" "}
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}{" "}
              providers
            </span>
            <div className="prov-pages">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
              {pageButtons.map((button, index) =>
                button === "gap" ? (
                  <span key={`gap-${index}`} className="prov-page-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={button}
                    className={button === safePage ? "active" : ""}
                    onClick={() => setPage(button)}
                    type="button"
                  >
                    {button}
                  </button>
                )
              )}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                type="button"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <select
              className="prov-select prov-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        ) : null}
      </div>

      {menuProvider && menuPos ? (
        <div
          className="prov-menu"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuProvider);
            }}
          >
            <Eye size={15} /> View Details
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              setEditProvider(menuProvider);
            }}
          >
            <Pencil size={15} /> Edit Provider
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuProvider, "documents");
            }}
          >
            <ShieldCheck size={15} /> Verify Documents
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuProvider, "services");
            }}
          >
            <Settings size={15} /> Manage Services
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuProvider, "earnings");
            }}
          >
            <BadgePoundSterling size={15} /> View Earnings
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              setMessageProvider(menuProvider);
            }}
          >
            <MessageSquareText size={15} /> Send Message
          </button>
          <div className="prov-menu-divider" />
          {menuProvider.enforcement?.status === "suspended" ||
          menuProvider.enforcement?.status === "banned" ? (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("reactivate", menuProvider)}
            >
              <UserCheck size={15} /> Reactivate Provider
            </button>
          ) : (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("suspend", menuProvider)}
            >
              <Ban size={15} /> Suspend Provider
            </button>
          )}
          {menuProvider.accountStatus === "disabled" ? (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("activate", menuProvider)}
            >
              <Power size={15} /> Activate Account
            </button>
          ) : (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("deactivate", menuProvider)}
            >
              <Power size={15} /> Deactivate Account
            </button>
          )}
          <button
            className="prov-menu-item prov-menu-danger"
            type="button"
            onClick={() => openAction("delete", menuProvider)}
          >
            <Trash2 size={15} /> Delete Provider
          </button>
        </div>
      ) : null}

      {action ? (
        <div
          className="prov-modal-overlay"
          onClick={() => {
            if (!actionBusy) setAction(null);
          }}
        >
          <div
            className="prov-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {action.kind === "suspend"
                ? "Suspend Provider"
                : action.kind === "reactivate"
                  ? "Reactivate Provider"
                  : action.kind === "deactivate"
                    ? "Deactivate Account"
                    : action.kind === "activate"
                      ? "Activate Account"
                      : "Delete Provider"}
            </h3>
            <p>
              {action.kind === "suspend" ? (
                <>
                  Suspend <strong>{action.provider.name || "this provider"}</strong>?
                  They will go offline immediately and will not receive new
                  bookings. Existing bookings are not affected.
                </>
              ) : action.kind === "reactivate" ? (
                <>
                  Reactivate <strong>{action.provider.name || "this provider"}</strong>?
                  The suspension will be lifted and they can go online and
                  receive bookings again.
                </>
              ) : action.kind === "deactivate" ? (
                <>
                  Deactivate <strong>{action.provider.name || "this provider"}</strong>?
                  They will not be able to log in or receive bookings. Their
                  data stays safe and the account can be activated again at any
                  time.
                </>
              ) : action.kind === "activate" ? (
                <>
                  Activate <strong>{action.provider.name || "this provider"}</strong>?
                  They will be able to log in and use the app again.
                </>
              ) : (
                <>
                  Delete <strong>{action.provider.name || "this provider"}</strong>?
                  They will be removed from the providers list and will no
                  longer be able to use the app.
                </>
              )}
            </p>

            {action.kind === "delete" ? (
              <div className="prov-modal-warn">
                Booking, payment and earnings records are kept safe — only the
                provider account is removed from view. If this provider has
                active bookings, deletion will be stopped. This cannot be
                undone from the panel.
              </div>
            ) : null}

            {action.kind === "suspend" ? (
              <label className="prov-field">
                <span>Reason (required)</span>
                <textarea
                  className="prov-textarea"
                  placeholder="e.g. Repeated no-shows reported by customers"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            ) : null}

            {actionError ? (
              <div className="prov-modal-error">{actionError}</div>
            ) : null}

            <div className="prov-modal-actions">
              <button
                className="prov-btn prov-btn-ghost"
                type="button"
                disabled={actionBusy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button
                className={`prov-btn ${
                  action.kind === "delete" || action.kind === "suspend"
                    ? "prov-btn-danger"
                    : action.kind === "deactivate"
                      ? "prov-btn-dark"
                      : "prov-btn-primary"
                }`}
                type="button"
                disabled={actionBusy}
                onClick={runAction}
              >
                {actionBusy ? (
                  <>
                    <Loader2 className="prov-spin" size={15} /> Working...
                  </>
                ) : action.kind === "suspend" ? (
                  "Suspend"
                ) : action.kind === "reactivate" ? (
                  "Reactivate"
                ) : action.kind === "deactivate" ? (
                  "Deactivate"
                ) : action.kind === "activate" ? (
                  "Activate"
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`prov-toast prov-toast-${toast.type}`}>
          {toast.type === "success" ? (
            <UserCheck size={16} />
          ) : (
            <TriangleAlert size={16} />
          )}
          {toast.text}
        </div>
      ) : null}
      {panelProvider ? (
        <ProviderDetailPanel
          provider={panelProvider}
          displayId={idNumbers.get(panelProvider._id) || ""}
          allProviders={washers}
          onClose={() => setPanelId(null)}
          onAction={openAction}
          onMessage={(p) => setMessageProvider(p)}
          onEdit={(p) => setEditProvider(p)}
          tab={panelTab}
          onTabChange={setPanelTab}
        />
      ) : null}

      {editProvider ? (
        <EditProviderModal
          provider={editProvider}
          onClose={() => setEditProvider(null)}
          onSaved={(text) => {
            setEditProvider(null);
            setToast({ type: "success", text });
          }}
        />
      ) : null}

      {messageProvider ? (
        <ProviderMessageModal
          provider={messageProvider}
          onClose={() => setMessageProvider(null)}
          onSent={(text) => {
            setMessageProvider(null);
            setToast({ type: "success", text });
          }}
        />
      ) : null}

      {addOpen ? (
        <AddProviderModal
          onClose={() => setAddOpen(false)}
          onCreated={(text) => {
            setAddOpen(false);
            setToast({ type: "success", text });
          }}
        />
      ) : null}
    </section>
  );
}

// ─── Customers redesign — types, helpers, modals, detail panel, page ────────
// Providers redesign wala hi architecture: list + stat cards + filters +
// pagination, right slide-in detail panel (5 tabs), ••• menu actions, modals,
// har jagah asal data + honest empty/error states (dummy data NAHI).
type CustomerListItem = AdminUser & {
  accountStatus?: string;
  totalBookings?: number;
  totalSpent?: number;
  residentialAddress?: string;
  latestAddress?: string;
  dateOfBirth?: string;
  location?: { type?: string; coordinates?: number[] };
  verificationInfo?: { verified?: boolean };
};

type CustomerDisplayStatus = "active" | "suspended" | "inactive";

type CustomerActionKind =
  | "suspend"
  | "reactivate"
  | "deactivate"
  | "activate"
  | "delete"
  | "reset";

function customerDisplayStatus(
  customer: CustomerListItem
): CustomerDisplayStatus {
  const enforcement = customer.enforcement?.status || "clear";
  if (enforcement === "suspended" || enforcement === "banned") {
    return "suspended";
  }
  if (customer.accountStatus === "disabled") {
    return "inactive";
  }
  return "active";
}

const CUSTOMER_BOOKING_LABELS: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  arrived: "Arrived",
  ongoing: "Ongoing",
  completed: "Completed",
  cancelled: "Cancelled",
  declined: "Declined",
};

function CustomerMessageModal({
  customer,
  onClose,
  onSent,
}: {
  customer: CustomerListItem;
  onClose: () => void;
  onSent: (text: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendCustomerMessage(customer._id, {
        title: title.trim() || undefined,
        message: message.trim(),
      });
      onSent(`Message sent to ${customer.name || "customer"}.`);
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
          "Message could not be sent. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div className="prov-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Send Message</h3>
        <p>
          To {customer.name || "customer"} — the message is saved in their app
          inbox and also sent as a push notification.
        </p>
        <label className="prov-field">
          <span>Title (optional)</span>
          <input
            className="prov-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Message from OWVO"
            maxLength={80}
          />
        </label>
        <label className="prov-field">
          <span>Message</span>
          <textarea
            className="prov-textarea"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write your message..."
            maxLength={1000}
          />
        </label>
        <div className="prov-char-count">{message.length}/1000</div>
        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            disabled={busy}
            onClick={send}
          >
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Send size={14} />} Send Message
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customers fix: address autocomplete (Google Places) ────────────────────
// Postcode/address likhne par suggestions; kisi par click karne se pura
// address box me bhar jata hai AUR us ki location (lat/lng) bhi milti hai —
// location backend me customer ki profile par save hoti hai.
let customerPlacesPromise: Promise<void> | null = null;
function loadCustomerPlacesScript(apiKey: string): Promise<void> {
  if (customerPlacesPromise) return customerPlacesPromise;
  customerPlacesPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    const w = window as unknown as {
      google?: { maps?: { places?: unknown } };
    };
    if (w.google?.maps?.places) return resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&region=GB`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Places"));
    document.head.appendChild(script);
  });
  return customerPlacesPromise;
}

function CustomerAddressAutocomplete({
  value,
  onChange,
  onCoords,
}: {
  value: string;
  onChange: (value: string) => void;
  onCoords: (coords: { lat: number; lng: number } | null) => void;
}) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [suggestions, setSuggestions] = useState<
    Array<{ description: string; placeId: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const suppressNextFetch = useRef(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setLoadError("Address suggestions are not configured.");
      return;
    }
    let cancelled = false;
    loadCustomerPlacesScript(apiKey)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Address suggestions could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (suppressNextFetch.current) {
      suppressNextFetch.current = false;
      return;
    }
    if (!ready || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      const g = (window as unknown as { google?: any }).google;
      if (!g?.maps?.places) return;
      setSearching(true);
      const service = new g.maps.places.AutocompleteService();
      service.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: "gb" },
          types: ["geocode"],
        },
        (
          predictions: Array<{ description: string; place_id: string }> | null
        ) => {
          setSearching(false);
          setSuggestions(
            (predictions || []).map((p) => ({
              description: p.description,
              placeId: p.place_id,
            }))
          );
          setShowSuggestions(true);
        }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [value, ready]);

  const pick = (suggestion: { description: string; placeId: string }) => {
    suppressNextFetch.current = true;
    setShowSuggestions(false);
    setSuggestions([]);
    onChange(suggestion.description);
    const g = (window as unknown as { google?: any }).google;
    if (!g?.maps?.places) {
      onCoords(null);
      return;
    }
    const detailsService = new g.maps.places.PlacesService(
      document.createElement("div")
    );
    detailsService.getDetails(
      { placeId: suggestion.placeId, fields: ["formatted_address", "geometry"] },
      (place: any, status: string) => {
        if (status === "OK" && place?.geometry?.location) {
          suppressNextFetch.current = true;
          onChange(place.formatted_address || suggestion.description);
          onCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
        } else {
          onCoords(null);
        }
      }
    );
  };

  return (
    <div className="cust-addr-wrap">
      <input
        className="prov-input"
        value={value}
        placeholder="Start typing a postcode or address..."
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          onCoords(null);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
      />
      {showSuggestions && suggestions.length > 0 ? (
        <div className="cust-places-dropdown">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                pick(s);
              }}
            >
              <MapPin size={13} /> {s.description}
            </button>
          ))}
        </div>
      ) : null}
      {searching ? (
        <small className="cust-field-hint">Searching addresses...</small>
      ) : null}
      {loadError ? <small className="cust-field-hint">{loadError}</small> : null}
    </div>
  );
}

function AddCustomerModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("A valid email address is required.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        password,
        residentialAddress: address.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      } as Parameters<typeof createAdminCustomer>[0] & {
        latitude?: number;
        longitude?: number;
      };
      await createAdminCustomer(payload);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      onCreated("Customer created. They can log in to the app right away.");
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ||
          "Customer could not be created. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div className="prov-modal" onClick={(event) => event.stopPropagation()}>
        <h3>Add Customer</h3>
        <p>
          Creates a normal customer account — the customer can log in to the
          app with this email and password.
        </p>
        <div className="cust-form-grid">
          <label className="prov-field">
            <span>First Name *</span>
            <input
              className="prov-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="e.g. Sarah"
            />
          </label>
          <label className="prov-field">
            <span>Last Name</span>
            <input
              className="prov-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="e.g. Johnson"
            />
          </label>
        </div>
        <label className="prov-field">
          <span>Email *</span>
          <input
            className="prov-input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="customer@example.com"
          />
        </label>
        <label className="prov-field">
          <span>Phone *</span>
          <input
            className="prov-input"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+44..."
          />
        </label>
        <label className="prov-field">
          <span>Password *</span>
          <input
            className="prov-input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 6 characters"
          />
        </label>
        <div className="cust-form-grid">
          <label className="prov-field">
            <span>Date of Birth</span>
            <input
              className="prov-input"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </label>
          <label className="prov-field">
            <span>Address</span>
            <CustomerAddressAutocomplete
              value={address}
              onChange={setAddress}
              onCoords={setCoords}
            />
            <small className="cust-field-hint">
              Pick an address from the suggestions — its location is saved too.
            </small>
          </label>
        </div>
        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            disabled={busy}
            onClick={submit}
          >
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Plus size={14} />} Create Customer
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCustomerModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerListItem;
  onClose: () => void;
  onSaved: (text: string) => void;
}) {
  const queryClient = useQueryClient();
  const nameParts = (customer.name || "").trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [email, setEmail] = useState(customer.email || "");
  const [phoneNumber, setPhoneNumber] = useState(customer.phoneNumber || "");
  const [dateOfBirth, setDateOfBirth] = useState(
    customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : ""
  );
  const [address, setAddress] = useState(customer.residentialAddress || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const status = customerDisplayStatus(customer);
  const save = async () => {
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("A valid email address is required.");
      return;
    }
    if (!phoneNumber.trim()) {
      setError("Phone number is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
        dateOfBirth: dateOfBirth || "",
        residentialAddress: address.trim(),
        ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
      } as Parameters<typeof updateAdminCustomerProfile>[1] & {
        latitude?: number;
        longitude?: number;
      };
      await updateAdminCustomerProfile(customer._id, payload);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({
        queryKey: ["customer-detail", customer._id],
      });
      onSaved("Customer details updated.");
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Changes could not be saved. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prov-modal-overlay" onClick={onClose}>
      <div
        className="prov-modal cust-modal-wide"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Edit Customer</h3>
        <p>{customer.name || "Customer"} — changes apply immediately.</p>

        <h4 className="cust-form-section">Basic Information</h4>
        <div className="cust-form-grid">
          <label className="prov-field">
            <span>First Name *</span>
            <input
              className="prov-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label className="prov-field">
            <span>Last Name</span>
            <input
              className="prov-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
        </div>
        <label className="prov-field">
          <span>Date of Birth</span>
          <input
            className="prov-input"
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </label>

        <h4 className="cust-form-section">Contact Details</h4>
        <div className="cust-form-grid">
          <label className="prov-field">
            <span>Email *</span>
            <input
              className="prov-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="prov-field">
            <span>Phone *</span>
            <input
              className="prov-input"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </label>
        </div>

        <h4 className="cust-form-section">Address</h4>
        <label className="prov-field">
          <span>Residential Address</span>
          <CustomerAddressAutocomplete
            value={address}
            onChange={setAddress}
            onCoords={setCoords}
          />
          <small className="cust-field-hint">
            Pick an address from the suggestions — its location is saved too.
          </small>
        </label>

        <h4 className="cust-form-section">Account Settings</h4>
        <div className="cust-info-list">
          <div className="cust-info-row">
            <span>Account status</span>
            <strong>
              {status === "active"
                ? "Active"
                : status === "suspended"
                  ? "Suspended"
                  : "Inactive"}
            </strong>
          </div>
          <div className="cust-info-row">
            <span>Email verified</span>
            <strong>{customer.verificationInfo?.verified ? "Yes" : "No"}</strong>
          </div>
          <div className="cust-info-row">
            <span>Password</span>
            <strong>Use “Reset Password” from the actions menu</strong>
          </div>
        </div>

        {error ? <div className="prov-modal-error">{error}</div> : null}
        <div className="prov-modal-actions">
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            disabled={busy}
            onClick={save}
          >
            {busy ? <Loader2 className="prov-spin" size={14} /> : <Save size={14} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Customers: View on Map popup ───────────────────────────────────────────
// Pin ki tarteeb backend detail endpoint tay karta hai: (1) active booking ki
// LIVE location, (2) profile par saved address location, (3) latest booking
// ke address ki location. Har pin ke sath saaf label ata hai.
function CustomerMapModal({
  customer,
  mapLocation,
  bookingAddress,
  onClose,
}: {
  customer: CustomerListItem;
  mapLocation?: AdminCustomerMapLocation | null;
  bookingAddress?: string;
  onClose: () => void;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapError, setMapError] = useState("");
  const fallbackCoords = customer.location?.coordinates;
  const effective: AdminCustomerMapLocation | null = mapLocation
    ? mapLocation
    : Array.isArray(fallbackCoords) &&
        fallbackCoords.length === 2 &&
        (fallbackCoords[0] !== 0 || fallbackCoords[1] !== 0)
      ? {
          lat: fallbackCoords[1],
          lng: fallbackCoords[0],
          source: "profile",
          updatedAt: null,
        }
      : null;
  const hasCoords = Boolean(effective);
  const sourceLabel =
    effective?.source === "live"
      ? "Live location"
      : effective?.source === "profile"
        ? "Saved address location"
        : "Latest booking location";
  const pinColor = effective?.source === "live" ? "#22a355" : "#f6b300";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!effective) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMapError("Google Maps is not configured for this dashboard.");
      return;
    }
    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !effective) return;
        const googleMaps = (window as unknown as { google: { maps: any } })
          .google.maps;
        const position = { lat: effective.lat, lng: effective.lng };
        const map = new googleMaps.Map(mapRef.current, {
          center: position,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
        });
        const pinSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='38' height='48' viewBox='0 0 38 48'><path d='M19 1C9.6 1 2 8.6 2 18c0 11.5 15.4 28.2 15.9 28.7a1.6 1.6 0 0 0 2.2 0C20.6 46.2 36 29.5 36 18 36 8.6 28.4 1 19 1z' fill='${pinColor}' stroke='#ffffff' stroke-width='2.5'/><circle cx='19' cy='18' r='7' fill='#ffffff'/></svg>`;
        const marker = new googleMaps.Marker({
          position,
          map,
          title: customer.name || "Customer",
          icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg)}`,
            scaledSize: new googleMaps.Size(46, 58),
            anchor: new googleMaps.Point(23, 56),
          },
        });
        const info = new googleMaps.InfoWindow({
          content: `<strong>${customer.name || "Customer"}</strong><br/>${sourceLabel}`,
        });
        // InfoWindow khud nahi khulta — wo pin ko chhupa deta tha. Pin par
        // click karne se khulta hai; pin har waqt pura nazar ata hai.
        marker.addListener("click", () => info.open(map, marker));
        // Modal khulne ke baad map ko refresh karna zaroori hai — warna
        // Google ki tiles aadhi/grey reh jati hain.
        window.setTimeout(() => {
          googleMaps.event.trigger(map, "resize");
          map.setCenter(position);
        }, 300);
      })
      .catch(() => {
        if (!cancelled) {
          setMapError(
            "The map could not be loaded. Check your connection and try again."
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="prov-map-overlay"
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
    >
      <div className="prov-map-card" onClick={(event) => event.stopPropagation()}>
        <div className="prov-map-head">
          <div>
            <h3>{customer.name || "Customer"}</h3>
            <p>
              {customer.residentialAddress ||
                bookingAddress ||
                "Address not provided"}
            </p>
          </div>
          <button
            className="prov-map-close"
            type="button"
            onClick={onClose}
            aria-label="Close map"
          >
            <X size={18} />
          </button>
        </div>
        {hasCoords ? (
          mapError ? (
            <div className="prov-map-error">{mapError}</div>
          ) : (
            <div ref={mapRef} className="cust-map-canvas" />
          )
        ) : (
          <div className="prov-map-error">
            No location available for this customer yet. A location appears
            here once their address is saved or they make a booking.
          </div>
        )}
        {hasCoords ? (
          <div className="prov-map-foot">
            <span className="cust-map-status">
              <span className="cust-map-dot" style={{ background: pinColor }} />
              {sourceLabel}
              {effective?.source === "live" && effective?.updatedAt
                ? ` • updated ${relativeDate(effective.updatedAt)}`
                : ""}
            </span>
            <button
              className="prov-btn prov-btn-dark cust-map-back"
              type="button"
              onClick={onClose}
            >
              <ChevronLeft size={14} /> Back to Customer
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomerDetailPanel({
  customer,
  displayId,
  onClose,
  onAction,
  onMessage,
  onEdit,
  tab,
  onTabChange,
}: {
  customer: CustomerListItem;
  displayId: string;
  onClose: () => void;
  onAction: (kind: CustomerActionKind, customer: CustomerListItem) => void;
  onMessage: (customer: CustomerListItem) => void;
  onEdit: (customer: CustomerListItem) => void;
  tab: string;
  onTabChange: (tab: string) => void;
}) {
  const queryClient = useQueryClient();
  const [mapOpen, setMapOpen] = useState(false);
  const [headMenuOpen, setHeadMenuOpen] = useState(false);
  const [bookingFilter, setBookingFilter] = useState<
    "all" | "completed" | "upcoming" | "cancelled"
  >("all");
  const detailQuery = useQuery({
    queryKey: ["customer-detail", customer._id],
    queryFn: () => getAdminCustomerDetail(customer._id),
  });
  const detail = detailQuery.data;
  const d = detail?.customer;

  const [panelToast, setPanelToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  useEffect(() => {
    if (!panelToast) return;
    const timer = setTimeout(() => setPanelToast(null), 3600);
    return () => clearTimeout(timer);
  }, [panelToast]);
  const notify = (type: "success" | "error" | "info", text: string) =>
    setPanelToast({ type, text });
  const serverError = (error: unknown) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || "Something went wrong. Check your connection and try again.";

  // ─── Notes tab ───
  const notesQuery = useQuery({
    queryKey: ["customer-notes", customer._id],
    queryFn: () => getCustomerNotes(customer._id),
    enabled: tab === "notes",
  });
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteDeleteBusy, setNoteDeleteBusy] = useState(false);
  const [confirmDeleteNoteId, setConfirmDeleteNoteId] = useState<string | null>(
    null
  );
  const submitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    setNoteBusy(true);
    try {
      await addCustomerNote(customer._id, noteText.trim());
      setNoteText("");
      await queryClient.invalidateQueries({
        queryKey: ["customer-notes", customer._id],
      });
      notify("success", "Note added.");
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setNoteBusy(false);
    }
  };
  const removeNote = async (noteId: string) => {
    setNoteDeleteBusy(true);
    try {
      await deleteCustomerNote(customer._id, noteId);
      setConfirmDeleteNoteId(null);
      await queryClient.invalidateQueries({
        queryKey: ["customer-notes", customer._id],
      });
      notify("success", "Note deleted.");
    } catch (error) {
      notify("error", serverError(error));
    } finally {
      setNoteDeleteBusy(false);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !mapOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, mapOpen]);

  const status = customerDisplayStatus(customer);
  const photoUrl = resolveReportPhotoUrl(customer.photo?.url);
  const fmtDate = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "—";
  const fmtDateTime = (value?: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return `${date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })} • ${date.toLocaleTimeString("en-GB", {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  };
  const ratingReceived = detail
    ? detail.stats.ratingReceived
    : {
        average: customer.customerRatingAverage || 0,
        count: customer.customerRatingCount || 0,
      };
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "bookings", label: "Bookings" },
    { key: "vehicles", label: "Vehicles" },
    { key: "payments", label: "Payments" },
    { key: "reviews", label: "Reviews" },
    { key: "notes", label: "Notes" },
  ];
  const stars = (rating: number) => (
    <span className="cust-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={13}
          className={i <= Math.round(rating) ? "cust-star-on" : "cust-star-off"}
          fill={i <= Math.round(rating) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
  const bookingRow = (booking: AdminCustomerDetailBooking) => (
    <div
      key={booking._id}
      className="prov-bk-row cust-bk-row"
      onClick={() => {
        window.location.href = `/bookings/${booking._id}`;
      }}
    >
      {booking.vehicle?.image ? (
        <img
          className="cust-bk-photo"
          alt={booking.vehicle.registrationNo || "Vehicle"}
          src={resolveReportPhotoUrl(booking.vehicle.image)}
        />
      ) : (
        <span className="prov-bk-avatar">
          <CarFront size={16} />
        </span>
      )}
      <div className="prov-bk-main">
        <strong>
          {booking.ref} • {booking.serviceTitle}
        </strong>
        <small>
          {booking.vehicle?.registrationNo || "No vehicle"}
          {booking.vehicle?.make
            ? ` • ${booking.vehicle.make} ${booking.vehicle.model || ""}`
            : ""}{" "}
          • with {booking.providerName}
        </small>
        <small>{fmtDateTime(booking.bookingDate || booking.createdAt)}</small>
      </div>
      <div className="prov-bk-side">
        <strong>{money(booking.finalPrice ?? booking.price ?? 0)}</strong>
        <span className={`prov-bk-status prov-bk-${booking.status}`}>
          {CUSTOMER_BOOKING_LABELS[booking.status] || booking.status}
        </span>
      </div>
    </div>
  );

  return (
    <div className="prov-panel-overlay" onClick={onClose}>
      <aside className="prov-panel" onClick={(event) => event.stopPropagation()}>
        <button className="prov-panel-close" type="button" onClick={onClose} aria-label="Close panel">
          <X size={18} />
        </button>

        <div className="prov-panel-head">
          {photoUrl ? (
            <span className="prov-panel-avatar person-photo-shell">
              <span>{initials(customer.name || customer.email, "C")}</span>
              <img
                alt={customer.name || "Customer"}
                src={photoUrl}
                onError={(event) => {
                  event.currentTarget.remove();
                }}
              />
            </span>
          ) : (
            <span className="prov-panel-avatar">
              {initials(customer.name || customer.email, "C")}
            </span>
          )}
          <div className="prov-panel-title">
            <h2>{customer.name || "Customer"}</h2>
            <div className="prov-panel-meta">
              <span className={`prov-badge prov-badge-${status}`}>
                {status === "active"
                  ? "Active"
                  : status === "suspended"
                    ? "Suspended"
                    : "Inactive"}
              </span>
              {customer.enforcement?.status === "suspended" &&
              customer.enforcement?.reason ? (
                <span className="prov-offline">{customer.enforcement.reason}</span>
              ) : null}
            </div>
            <p>
              #{displayId} • Joined {fmtDate(customer.createdAt)}
            </p>
            <p className="prov-panel-rating">
              <Star size={14} />{" "}
              {ratingReceived.average
                ? Number(ratingReceived.average).toFixed(1)
                : "—"}{" "}
              ({ratingReceived.count} reviews)
              {detail ? ` • ${detail.stats.totalBookings} bookings` : ""}
            </p>
          </div>
        </div>

        <div className="prov-panel-actions cust-panel-actions">
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => notify("info", "Calling is coming in the next phase.")}
          >
            <Phone size={15} /> Call
          </button>
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => onMessage(customer)}
          >
            <MessageSquareText size={15} /> Message
          </button>
          <button
            className="prov-panel-action"
            type="button"
            onClick={() => onEdit(customer)}
          >
            <Pencil size={15} /> Edit
          </button>
          <div className="cust-head-menu-wrap">
            <button
              className="prov-panel-action"
              type="button"
              aria-label="More customer actions"
              onClick={() => setHeadMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={15} />
            </button>
            {headMenuOpen ? (
              <div className="cust-head-menu">
                <button
                  className="prov-menu-item"
                  type="button"
                  onClick={() => {
                    setHeadMenuOpen(false);
                    onAction("reset", customer);
                  }}
                >
                  <RefreshCw size={15} /> Reset Password
                </button>
                <button
                  className="prov-menu-item prov-menu-danger"
                  type="button"
                  onClick={() => {
                    setHeadMenuOpen(false);
                    onAction("delete", customer);
                  }}
                >
                  <Trash2 size={15} /> Delete Account
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="prov-tabs">
          {tabs.map((item) => (
            <button
              key={item.key}
              className={tab === item.key ? "active" : ""}
              type="button"
              onClick={() => onTabChange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="prov-panel-body">
          {tab === "notes" ? (
            <>
              <form className="prov-note-form" onSubmit={submitNote}>
                <label className="prov-field">
                  <span>Add a note about this customer</span>
                  <textarea
                    className="prov-textarea"
                    placeholder="e.g. Customer asked for a callback about a refund."
                    value={noteText}
                    onChange={(event) => setNoteText(event.target.value)}
                    maxLength={2000}
                  />
                </label>
                <div className="prov-note-form-foot">
                  <small>{noteText.length}/2000</small>
                  <button
                    className="prov-btn prov-btn-primary"
                    type="submit"
                    disabled={noteBusy || !noteText.trim()}
                  >
                    {noteBusy ? <Loader2 className="prov-spin" size={14} /> : <Plus size={14} />} Add Note
                  </button>
                </div>
              </form>

              {notesQuery.isLoading ? (
                <div className="prov-state">
                  <Loader2 className="prov-spin" size={18} /> Loading notes...
                </div>
              ) : notesQuery.isError ? (
                <div className="prov-error">
                  <TriangleAlert size={20} />
                  <div>
                    <strong>Connection error</strong>
                    <p>Notes could not be loaded. Check your connection and try again.</p>
                  </div>
                  <button className="prov-retry" type="button" onClick={() => notesQuery.refetch()}>
                    <RefreshCw size={14} /> Retry
                  </button>
                </div>
              ) : (notesQuery.data || []).length === 0 ? (
                <p className="prov-muted">
                  No notes yet. Notes are only visible to the admin team — the
                  customer cannot see them.
                </p>
              ) : (
                <ul className="prov-notes-list">
                  {(notesQuery.data || []).map((note) => (
                    <li key={note._id} className="prov-note-card">
                      <div className="prov-note-head">
                        <strong>{note.authorName}</strong>
                        {note.authorRole ? <span className="prov-note-role">{note.authorRole}</span> : null}
                        <span className="prov-note-time">{relativeDate(note.createdAt)}</span>
                        {confirmDeleteNoteId === note._id ? (
                          <span className="prov-note-confirm">
                            Delete?
                            <button type="button" className="prov-note-yes" disabled={noteDeleteBusy} onClick={() => removeNote(note._id)}>
                              Yes
                            </button>
                            <button type="button" className="prov-note-no" onClick={() => setConfirmDeleteNoteId(null)}>
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="prov-note-del"
                            aria-label="Delete note"
                            onClick={() => setConfirmDeleteNoteId(note._id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p>{note.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : detailQuery.isLoading ? (
            <div className="prov-state">
              <Loader2 className="prov-spin" size={18} /> Loading customer details...
            </div>
          ) : detailQuery.isError || !detail ? (
            <div className="prov-error">
              <TriangleAlert size={20} />
              <div>
                <strong>Connection error</strong>
                <p>Customer details could not be loaded. Check your connection and try again.</p>
              </div>
              <button className="prov-retry" type="button" onClick={() => detailQuery.refetch()}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : tab === "overview" ? (
            <>
              <h3 className="prov-section-title">Contact Information</h3>
              <div className="cust-info-list">
                <div className="cust-info-row">
                  <span>
                    <Mail size={14} /> Email
                  </span>
                  <strong>{d?.email || customer.email || "Not provided"}</strong>
                </div>
                <div className="cust-info-row">
                  <span>
                    <Phone size={14} /> Phone
                  </span>
                  <strong>{d?.phoneNumber || customer.phoneNumber || "Not provided"}</strong>
                </div>
                <div className="cust-info-row">
                  <span>
                    <MapPin size={14} /> Address
                  </span>
                  <strong>
                    {d?.residentialAddress ||
                      customer.residentialAddress ||
                      (detail.latestBookingAddress
                        ? `${detail.latestBookingAddress} (latest booking)`
                        : "Not provided")}
                  </strong>
                </div>
              </div>
              <button
                className="prov-btn prov-btn-dark cust-map-btn"
                type="button"
                onClick={() => setMapOpen(true)}
              >
                <MapPin size={14} /> View on Map
              </button>

              <div className="prov-mini-cards cust-mini-3">
                <article>
                  <strong>{detail.stats.totalBookings}</strong>
                  <span>Total Bookings</span>
                </article>
                <article>
                  <strong>{money(detail.stats.totalSpent)}</strong>
                  <span>Total Spent</span>
                </article>
                <article>
                  <strong>
                    {detail.stats.ratingReceived.average
                      ? detail.stats.ratingReceived.average.toFixed(1)
                      : "—"}
                  </strong>
                  <span>Avg Rating ({detail.stats.ratingReceived.count})</span>
                </article>
              </div>

              <div className="cust-section-head">
                <h3 className="prov-section-title">Recent Bookings</h3>
                {detail.bookings.length > 0 ? (
                  <button type="button" onClick={() => onTabChange("bookings")}>
                    View All
                  </button>
                ) : null}
              </div>
              {detail.bookings.length === 0 ? (
                <p className="prov-muted">No bookings yet.</p>
              ) : (
                <div className="prov-bk-list">
                  {detail.bookings.slice(0, 5).map(bookingRow)}
                </div>
              )}

              <h3 className="prov-section-title">Payment Methods</h3>
              <p className="prov-muted">
                No saved cards on file. This customer pays per booking in the
                app — card details are handled securely by Stripe and are
                never stored in the admin panel. See the Payments tab for
                their payment history.
              </p>
            </>
          ) : tab === "bookings" ? (
            <>
              <div className="prov-bk-counts">
                <button
                  type="button"
                  className={bookingFilter === "all" ? "active" : ""}
                  onClick={() => setBookingFilter("all")}
                >
                  All ({detail.bookings.length})
                </button>
                <button
                  type="button"
                  className={bookingFilter === "completed" ? "active" : ""}
                  onClick={() => setBookingFilter("completed")}
                >
                  Completed ({detail.stats.counts.completed})
                </button>
                <button
                  type="button"
                  className={bookingFilter === "upcoming" ? "active" : ""}
                  onClick={() => setBookingFilter("upcoming")}
                >
                  Upcoming ({detail.stats.counts.active})
                </button>
                <button
                  type="button"
                  className={bookingFilter === "cancelled" ? "active" : ""}
                  onClick={() => setBookingFilter("cancelled")}
                >
                  Cancelled ({detail.stats.counts.cancelled})
                </button>
              </div>
              {(() => {
                const rows = detail.bookings.filter((booking) => {
                  if (bookingFilter === "all") return true;
                  if (bookingFilter === "completed")
                    return booking.status === "completed";
                  if (bookingFilter === "cancelled")
                    return booking.status === "cancelled";
                  return ["pending", "accepted", "arrived", "ongoing"].includes(
                    booking.status
                  );
                });
                return rows.length === 0 ? (
                  <p className="prov-muted">No bookings in this group yet.</p>
                ) : (
                  <div className="prov-bk-list">{rows.map(bookingRow)}</div>
                );
              })()}
            </>
          ) : tab === "vehicles" ? (
            <>
              <div className="cust-section-head">
                <h3 className="prov-section-title">
                  Vehicles ({detail.vehicles.length})
                </h3>
              </div>
              {detail.vehicles.length === 0 ? (
                <p className="prov-muted">
                  No vehicles saved yet. Vehicles the customer adds in the
                  app will appear here.
                </p>
              ) : (
                <div className="cust-veh-grid">
                  {detail.vehicles.map((vehicle) => (
                    <div key={vehicle._id} className="cust-veh-card">
                      {vehicle.image ? (
                        <img
                          className="cust-veh-photo"
                          alt={vehicle.registrationNo || "Vehicle"}
                          src={resolveReportPhotoUrl(vehicle.image)}
                        />
                      ) : (
                        <div className="cust-veh-photo cust-veh-photo-empty">
                          <CarFront size={30} />
                        </div>
                      )}
                      <div className="cust-veh-body">
                        <strong className="cust-veh-plate">
                          {vehicle.registrationNo || "No plate"}
                          {vehicle.isDefault ? (
                            <span className="cust-veh-default">Default</span>
                          ) : null}
                        </strong>
                        <div className="cust-veh-rows">
                          <div>
                            <span>Make</span>
                            <strong>{vehicle.make || "—"}</strong>
                          </div>
                          <div>
                            <span>Model</span>
                            <strong>{vehicle.model || "—"}</strong>
                          </div>
                          <div>
                            <span>Year</span>
                            <strong>{vehicle.year || "—"}</strong>
                          </div>
                          <div>
                            <span>Size</span>
                            <strong>{vehicle.size || "—"}</strong>
                          </div>
                          <div>
                            <span>Colour</span>
                            <strong>{vehicle.colour || "—"}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === "payments" ? (
            <>
              <div className="prov-mini-cards cust-mini-3">
                <article>
                  <strong>{money(detail.stats.totalSpent)}</strong>
                  <span>Total Spent</span>
                </article>
                <article>
                  <strong>{money(detail.stats.tipsGiven)}</strong>
                  <span>Tips Given</span>
                </article>
                <article>
                  <strong>{detail.payments.length}</strong>
                  <span>Payments</span>
                </article>
              </div>
              {detail.payments.length === 0 ? (
                <p className="prov-muted">No payments recorded yet.</p>
              ) : (
                <div className="prov-payout-list">
                  {detail.payments.map((payment) => (
                    <div key={payment._id} className="prov-payout-row cust-pay-row">
                      <div className="prov-payout-main">
                        <strong>
                          {payment.ref}
                          {payment.type === "tips" ? " • Tip" : ""}
                        </strong>
                        <small>
                          {payment.method || "Card"} • {fmtDateTime(payment.createdAt)}
                        </small>
                      </div>
                      <div className="prov-bk-side">
                        <strong>{money(payment.amount)}</strong>
                        <span
                          className={`prov-payout-status ${
                            payment.status === "complete"
                              ? "prov-payout-paid"
                              : payment.status === "failed"
                                ? "prov-payout-failed"
                                : "prov-payout-pending"
                          }`}
                        >
                          {payment.status === "complete"
                            ? "Paid"
                            : payment.status === "failed"
                              ? "Failed"
                              : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="prov-section-title">
                Reviews from Providers ({detail.stats.ratingReceived.count}
                {detail.stats.ratingReceived.average
                  ? ` • avg ${detail.stats.ratingReceived.average.toFixed(1)}`
                  : ""}
                )
              </h3>
              {detail.reviewsReceived.length === 0 ? (
                <p className="prov-muted">No provider has reviewed this customer yet.</p>
              ) : (
                <div className="cust-review-list">
                  {detail.reviewsReceived.map((review) => (
                    <div key={review._id} className="cust-review-card">
                      <div className="cust-review-head">
                        <strong>{review.providerName}</strong>
                        {stars(review.rating)}
                        <span className="prov-note-time">
                          {review.createdAt ? relativeDate(review.createdAt) : ""}
                        </span>
                      </div>
                      {review.review ? <p>{review.review}</p> : null}
                      {review.bookingRef ? (
                        <small className="prov-muted">Booking {review.bookingRef}</small>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <h3 className="prov-section-title">
                Reviews Given to Providers ({detail.stats.ratingGiven.count}
                {detail.stats.ratingGiven.average
                  ? ` • avg ${detail.stats.ratingGiven.average.toFixed(1)}`
                  : ""}
                )
              </h3>
              {detail.reviewsGiven.length === 0 ? (
                <p className="prov-muted">This customer has not reviewed any provider yet.</p>
              ) : (
                <div className="cust-review-list">
                  {detail.reviewsGiven.map((review) => (
                    <div key={review._id} className="cust-review-card">
                      <div className="cust-review-head">
                        <strong>{review.providerName}</strong>
                        {stars(review.rating)}
                        <span className="prov-note-time">
                          {review.createdAt ? relativeDate(review.createdAt) : ""}
                        </span>
                      </div>
                      {review.review ? <p>{review.review}</p> : null}
                      <small className="prov-muted">
                        {[review.serviceTitle, review.bookingRef ? `Booking ${review.bookingRef}` : ""]
                          .filter(Boolean)
                          .join(" • ")}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="prov-panel-footer">
          <button
            className="prov-btn prov-btn-primary"
            type="button"
            onClick={() => onMessage(customer)}
          >
            <MessageSquareText size={14} /> Send Message
          </button>
          <button
            className="prov-btn prov-btn-ghost"
            type="button"
            onClick={() => onTabChange("notes")}
          >
            <FileText size={14} /> Add Note
          </button>
          {status === "suspended" ? (
            <button
              className="prov-btn prov-btn-primary"
              type="button"
              onClick={() => onAction("reactivate", customer)}
            >
              <UserCheck size={14} /> Reactivate
            </button>
          ) : (
            <button
              className="prov-btn prov-btn-outline-danger"
              type="button"
              onClick={() => onAction("suspend", customer)}
            >
              <Ban size={14} /> Suspend
            </button>
          )}
          {customer.accountStatus === "disabled" ? (
            <button
              className="prov-btn prov-btn-dark"
              type="button"
              onClick={() => onAction("activate", customer)}
            >
              <Power size={14} /> Activate
            </button>
          ) : (
            <button
              className="prov-btn prov-btn-danger"
              type="button"
              onClick={() => onAction("deactivate", customer)}
            >
              <Power size={14} /> Deactivate
            </button>
          )}
        </div>

        {panelToast ? (
          <div className={`prov-toast prov-toast-${panelToast.type}`}>
            {panelToast.type === "success" ? (
              <UserCheck size={16} />
            ) : panelToast.type === "error" ? (
              <TriangleAlert size={16} />
            ) : (
              <Clock size={16} />
            )}
            {panelToast.text}
          </div>
        ) : null}
      </aside>
      {mapOpen ? (
        <CustomerMapModal
          customer={customer}
          mapLocation={detail?.mapLocation}
          bookingAddress={detail?.latestBookingAddress}
          onClose={() => setMapOpen(false)}
        />
      ) : null}
    </div>
  );
}

export function CustomersPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  // Directory page: Topbar date range is list ko narrow NAHI karta (Providers
  // wala hi pattern) — poori list "all" se ati hai, stats asal counts hain.
  const customersQuery = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => getCustomers({ range: "all" }),
    refetchInterval: 30000,
  });
  const customers = (customersQuery.data || []) as CustomerListItem[];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerDisplayStatus>("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [joinedFilter, setJoinedFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [panelTab, setPanelTab] = useState("overview");
  const [editCustomer, setEditCustomer] = useState<CustomerListItem | null>(null);
  const openPanel = (customer: CustomerListItem, tab: string = "overview") => {
    setPanelTab(tab);
    setPanelId(customer._id);
  };
  const [messageCustomer, setMessageCustomer] = useState<CustomerListItem | null>(null);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [action, setAction] = useState<{
    kind: CustomerActionKind;
    customer: CustomerListItem;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener("click", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuFor]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  const openMenu = (event: ReactMouseEvent<HTMLButtonElement>, id: string) => {
    event.stopPropagation();
    if (menuFor === id) {
      setMenuFor(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 452;
    const menuWidth = 228;
    const openUp = rect.bottom + menuHeight + 8 > window.innerHeight;
    setMenuPos({
      top: openUp ? Math.max(8, rect.top - menuHeight - 6) : rect.bottom + 6,
      left: Math.max(8, rect.right - menuWidth),
    });
    setMenuFor(id);
  };

  const menuCustomer = menuFor
    ? customers.find((customer) => customer._id === menuFor)
    : undefined;
  const panelCustomer = panelId
    ? customers.find((customer) => customer._id === panelId)
    : undefined;

  const openAction = (kind: CustomerActionKind, customer: CustomerListItem) => {
    setMenuFor(null);
    setReason("");
    setDeleteConfirmText("");
    setActionError("");
    setAction({ kind, customer });
  };

  const runAction = async () => {
    if (!action) return;
    const { kind, customer } = action;
    if (kind === "suspend" && !reason.trim()) {
      setActionError("Reason is required to suspend a customer.");
      return;
    }
    if (
      kind === "delete" &&
      deleteConfirmText.trim() !== (customer.name || customer.email || "")
    ) {
      setActionError("Type the customer's name exactly to confirm deletion.");
      return;
    }
    setActionBusy(true);
    setActionError("");
    try {
      if (kind === "suspend") {
        await updateCustomerEnforcement(customer._id, {
          status: "suspended",
          reason: reason.trim(),
        });
      } else if (kind === "reactivate") {
        await updateCustomerEnforcement(customer._id, { status: "clear" });
      } else if (kind === "deactivate") {
        await updateUserAccountStatus(customer._id, "disabled");
      } else if (kind === "activate") {
        await updateUserAccountStatus(customer._id, "active");
      } else if (kind === "delete") {
        await deleteAdminCustomer(customer._id);
        setSelected((current) => current.filter((item) => item !== customer._id));
        if (panelId === customer._id) setPanelId(null);
      } else if (kind === "reset") {
        await sendCustomerResetPassword(customer._id);
      }
      const messages: Record<CustomerActionKind, string> = {
        suspend: "Customer suspended.",
        reactivate: "Customer reactivated.",
        deactivate: "Customer account deactivated.",
        activate: "Customer account activated.",
        delete: "Customer deleted.",
        reset: "Password reset email sent to the customer.",
      };
      setAction(null);
      setReason("");
      setDeleteConfirmText("");
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await queryClient.invalidateQueries({
        queryKey: ["customer-detail", customer._id],
      });
      setToast({ type: "success", text: messages[kind] });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ||
        "Something went wrong. Check your connection and try again.";
      setActionError(message);
    } finally {
      setActionBusy(false);
    }
  };

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refreshCustomers = () =>
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    socket.on("admin_booking_created", refreshCustomers);
    socket.on("admin_booking_status_updated", refreshCustomers);
    return () => {
      socket.off("admin_booking_created", refreshCustomers);
      socket.off("admin_booking_status_updated", refreshCustomers);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  // Display ID (#C001) — join order (oldest first) se stable number.
  const idNumbers = useMemo(() => {
    const sorted = [...customers].sort(
      (a, b) =>
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
    );
    const map = new Map<string, string>();
    sorted.forEach((customer, index) => {
      map.set(customer._id, `C${String(index + 1).padStart(3, "0")}`);
    });
    return map;
  }, [customers]);

  const locations = useMemo(
    () =>
      Array.from(
        new Set(
          customers
            .map((customer) =>
              (customer.residentialAddress?.trim() ||
                customer.latestAddress?.trim()) as string
            )
            .filter(Boolean)
        )
      ).sort(),
    [customers]
  );

  const counts = useMemo(() => {
    const result = { total: customers.length, active: 0, inactive: 0, joinedThisMonth: 0 };
    const now = new Date();
    customers.forEach((customer) => {
      const status = customerDisplayStatus(customer);
      if (status === "active") result.active += 1;
      if (status === "inactive") result.inactive += 1;
      const joined = customer.createdAt ? new Date(customer.createdAt) : null;
      if (
        joined &&
        joined.getMonth() === now.getMonth() &&
        joined.getFullYear() === now.getFullYear()
      ) {
        result.joinedThisMonth += 1;
      }
    });
    return result;
  }, [customers]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();
    return customers.filter((customer) => {
      if (statusFilter !== "all" && customerDisplayStatus(customer) !== statusFilter)
        return false;
      if (
        locationFilter !== "all" &&
        (customer.residentialAddress?.trim() ||
          customer.latestAddress?.trim() ||
          "") !== locationFilter
      )
        return false;
      if (joinedFilter !== "all" && customer.createdAt) {
        const joined = new Date(customer.createdAt);
        const monthsBack =
          (now.getFullYear() - joined.getFullYear()) * 12 +
          (now.getMonth() - joined.getMonth());
        if (joinedFilter === "month" && monthsBack > 0) return false;
        if (joinedFilter === "quarter" && monthsBack > 2) return false;
        if (joinedFilter === "year" && monthsBack > 11) return false;
      }
      if (term) {
        const displayId = idNumbers.get(customer._id) || "";
        const haystack = [
          customer.name || "",
          customer.email || "",
          customer.phoneNumber || "",
          `#${displayId}`,
          displayId,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [customers, search, statusFilter, locationFilter, joinedFilter, idNumbers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageIds = pageItems.map((customer) => customer._id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  const pageButtons = useMemo(() => {
    const buttons: Array<number | "gap"> = [];
    for (let i = 1; i <= totalPages; i += 1) {
      if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
        buttons.push(i);
      } else if (buttons[buttons.length - 1] !== "gap") {
        buttons.push("gap");
      }
    }
    return buttons;
  }, [totalPages, safePage]);

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setLocationFilter("all");
    setJoinedFilter("all");
    setPage(1);
  };

  const toggleSelected = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );

  const togglePageSelected = () =>
    setSelected((current) =>
      allPageSelected
        ? current.filter((id) => !pageIds.includes(id))
        : Array.from(new Set([...current, ...pageIds]))
    );

  const pctOfTotal = (value: number) =>
    counts.total > 0 ? `${Math.round((value / counts.total) * 100)}% of total` : "—";

  const joinedLabel = (value?: string) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(value))
      : "—";

  return (
    <section className="data-page">
      <div className="data-page-header prov-header">
        <div>
          <h1>Customers</h1>
          <p>Manage customer accounts, view booking history and provide support.</p>
        </div>
        <button
          className="primary-button prov-add-button"
          type="button"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      <div className="prov-stats">
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-blue">
            <Users size={20} />
          </span>
          <div>
            <strong>{counts.total}</strong>
            <span>Total Customers</span>
            <small>
              {counts.joinedThisMonth > 0
                ? `+${counts.joinedThisMonth} joined this month`
                : "Registered customers"}
            </small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-green">
            <UserCheck size={20} />
          </span>
          <div>
            <strong>{counts.active}</strong>
            <span>Active Customers</span>
            <small>{pctOfTotal(counts.active)}</small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-amber">
            <CalendarDays size={20} />
          </span>
          <div>
            <strong>{counts.joinedThisMonth}</strong>
            <span>New Customers</span>
            <small>This month</small>
          </div>
        </article>
        <article className="prov-stat-card">
          <span className="prov-stat-icon prov-icon-red">
            <UserRound size={20} />
          </span>
          <div>
            <strong>{counts.inactive}</strong>
            <span>Inactive Customers</span>
            <small>{pctOfTotal(counts.inactive)}</small>
          </div>
        </article>
      </div>

      <div className="prov-filters">
        <label className="prov-search">
          <Search size={16} />
          <input
            placeholder="Search by name, email, phone or ID..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="prov-select prov-w-status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as "all" | CustomerDisplayStatus);
            setPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="prov-select cust-w-location"
          value={locationFilter}
          onChange={(event) => {
            setLocationFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All Locations</option>
          {locations.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
        <select
          className="prov-select cust-w-joined"
          value={joinedFilter}
          onChange={(event) => {
            setJoinedFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">Join Date: All</option>
          <option value="month">Joined this month</option>
          <option value="quarter">Last 3 months</option>
          <option value="year">Last 12 months</option>
        </select>
        <button className="prov-filter-button" type="button" onClick={resetFilters}>
          <RotateCcw size={15} /> Reset
        </button>
      </div>

      <div className="prov-table-card">
        {selected.length > 0 ? (
          <div className="prov-selected-bar">
            {selected.length} customer{selected.length === 1 ? "" : "s"} selected
          </div>
        ) : null}
        <table className="prov-table">
          <thead>
            <tr>
              <th className="prov-check-cell">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelected}
                />
              </th>
              <th>ID</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Total Bookings</th>
              <th>Total Spent</th>
              <th>Status</th>
              <th>Joined</th>
              <th className="prov-actions-head">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((customer) => {
              const status = customerDisplayStatus(customer);
              const photoUrl = resolveReportPhotoUrl(customer.photo?.url);
              return (
                <tr
                  key={customer._id}
                  className={`clickable-row${
                    selected.includes(customer._id) ? " prov-row-selected" : ""
                  }`}
                  onClick={() => openPanel(customer)}
                >
                  <td
                    className="prov-check-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(customer._id)}
                      onChange={() => toggleSelected(customer._id)}
                    />
                  </td>
                  <td className="prov-id">#{idNumbers.get(customer._id)}</td>
                  <td>
                    <div className="inline-person">
                      {photoUrl ? (
                        <span className="small-avatar person-photo-shell">
                          <span>{initials(customer.name || customer.email, "C")}</span>
                          <img
                            alt={customer.name || "Customer"}
                            src={photoUrl}
                            onError={(event) => {
                              event.currentTarget.remove();
                            }}
                          />
                        </span>
                      ) : (
                        <span className="small-avatar">
                          {initials(customer.name || customer.email, "C")}
                        </span>
                      )}
                      <span>
                        <strong>{customer.name || "Customer"}</strong>
                        <small>{customer.email || "No email"}</small>
                      </span>
                    </div>
                  </td>
                  <td>{customer.phoneNumber || "No phone"}</td>
                  <td>{customer.totalBookings ?? 0}</td>
                  <td>{money(customer.totalSpent ?? 0)}</td>
                  <td>
                    <span className={`prov-badge prov-badge-${status}`}>
                      {status === "active"
                        ? "Active"
                        : status === "suspended"
                          ? "Suspended"
                          : "Inactive"}
                    </span>
                  </td>
                  <td>{joinedLabel(customer.createdAt)}</td>
                  <td
                    className="prov-actions-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      className="prov-menu-button"
                      type="button"
                      aria-label="Customer actions"
                      onClick={(event) => openMenu(event, customer._id)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {customersQuery.isLoading ? (
          <div className="prov-state">
            <Loader2 className="prov-spin" size={18} /> Loading customers...
          </div>
        ) : null}

        {customersQuery.isError ? (
          <div className="prov-error">
            <TriangleAlert size={20} />
            <div>
              <strong>Connection error</strong>
              <p>Customers could not be loaded. Check your internet connection and try again.</p>
            </div>
            <button
              className="prov-retry"
              type="button"
              onClick={() => customersQuery.refetch()}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : null}

        {!customersQuery.isLoading && !customersQuery.isError && customers.length === 0 ? (
          <EmptyState text="No customers yet. New customers will appear here after they sign up." />
        ) : null}

        {!customersQuery.isLoading &&
        !customersQuery.isError &&
        customers.length > 0 &&
        filtered.length === 0 ? (
          <div className="prov-state">
            <p>No customers match your filters.</p>
            <button className="prov-retry" type="button" onClick={resetFilters}>
              <RotateCcw size={14} /> Reset filters
            </button>
          </div>
        ) : null}

        {filtered.length > 0 ? (
          <div className="prov-pagination">
            <span>
              Showing {(safePage - 1) * pageSize + 1} to{" "}
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}{" "}
              customers
            </span>
            <div className="prov-pages">
              <button
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
                type="button"
              >
                <ChevronLeft size={14} />
              </button>
              {pageButtons.map((button, index) =>
                button === "gap" ? (
                  <span key={`gap-${index}`} className="prov-page-gap">
                    …
                  </span>
                ) : (
                  <button
                    key={button}
                    className={button === safePage ? "active" : ""}
                    onClick={() => setPage(button)}
                    type="button"
                  >
                    {button}
                  </button>
                )
              )}
              <button
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
                type="button"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <select
              className="prov-select prov-page-size"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>
        ) : null}
      </div>

      {menuCustomer && menuPos ? (
        <div
          className="prov-menu"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuCustomer);
            }}
          >
            <Eye size={15} /> View Details
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              setEditCustomer(menuCustomer);
            }}
          >
            <Pencil size={15} /> Edit Customer
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              setMessageCustomer(menuCustomer);
            }}
          >
            <MessageSquareText size={15} /> Send Message
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuCustomer, "bookings");
            }}
          >
            <CalendarDays size={15} /> View Bookings
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuCustomer, "vehicles");
            }}
          >
            <CarFront size={15} /> View Vehicles
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuCustomer, "payments");
            }}
          >
            <CreditCard size={15} /> View Payments
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => {
              setMenuFor(null);
              openPanel(menuCustomer, "notes");
            }}
          >
            <FileText size={15} /> Add Note
          </button>
          <button
            className="prov-menu-item"
            type="button"
            onClick={() => openAction("reset", menuCustomer)}
          >
            <RefreshCw size={15} /> Reset Password
          </button>
          <div className="prov-menu-divider" />
          {menuCustomer.enforcement?.status === "suspended" ||
          menuCustomer.enforcement?.status === "banned" ? (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("reactivate", menuCustomer)}
            >
              <UserCheck size={15} /> Reactivate Account
            </button>
          ) : (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("suspend", menuCustomer)}
            >
              <Ban size={15} /> Suspend Account
            </button>
          )}
          {menuCustomer.accountStatus === "disabled" ? (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("activate", menuCustomer)}
            >
              <Power size={15} /> Activate Account
            </button>
          ) : (
            <button
              className="prov-menu-item"
              type="button"
              onClick={() => openAction("deactivate", menuCustomer)}
            >
              <Power size={15} /> Deactivate Account
            </button>
          )}
          <button
            className="prov-menu-item prov-menu-danger"
            type="button"
            onClick={() => openAction("delete", menuCustomer)}
          >
            <Trash2 size={15} /> Delete Account
          </button>
        </div>
      ) : null}

      {action ? (
        <div
          className="prov-modal-overlay"
          onClick={() => {
            if (!actionBusy) setAction(null);
          }}
        >
          <div
            className="prov-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>
              {action.kind === "suspend"
                ? "Suspend Account"
                : action.kind === "reactivate"
                  ? "Reactivate Account"
                  : action.kind === "deactivate"
                    ? "Deactivate Account"
                    : action.kind === "activate"
                      ? "Activate Account"
                      : action.kind === "reset"
                        ? "Reset Password"
                        : "Delete Account"}
            </h3>
            <p>
              {action.kind === "suspend" ? (
                <>
                  Suspend <strong>{action.customer.name || "this customer"}</strong>?
                  They will not be able to log in or make new bookings until
                  reactivated. Existing bookings are not affected.
                </>
              ) : action.kind === "reactivate" ? (
                <>
                  Reactivate <strong>{action.customer.name || "this customer"}</strong>?
                  The suspension will be lifted and they can log in and book
                  again.
                </>
              ) : action.kind === "deactivate" ? (
                <>
                  Deactivate <strong>{action.customer.name || "this customer"}</strong>?
                  They will not be able to log in. Their data stays safe and
                  the account can be activated again at any time.
                </>
              ) : action.kind === "activate" ? (
                <>
                  Activate <strong>{action.customer.name || "this customer"}</strong>?
                  They will be able to log in and use the app again.
                </>
              ) : action.kind === "reset" ? (
                <>
                  Send a password reset email to{" "}
                  <strong>{action.customer.email || "this customer"}</strong>?
                  They will receive a one-time code to set a new password.
                </>
              ) : (
                <>
                  Delete <strong>{action.customer.name || "this customer"}</strong>?
                  They will be removed from the customers list and will no
                  longer be able to use the app.
                </>
              )}
            </p>

            {action.kind === "delete" ? (
              <>
                <div className="prov-modal-warn">
                  Booking and payment records are kept safe — only the
                  customer account is removed from view. If this customer has
                  an active booking in progress, deletion will be stopped.
                  This cannot be undone from the panel.
                </div>
                <label className="prov-field">
                  <span>
                    Type the customer&apos;s name (
                    {action.customer.name || action.customer.email}) to confirm
                  </span>
                  <input
                    className="prov-input"
                    value={deleteConfirmText}
                    onChange={(event) => setDeleteConfirmText(event.target.value)}
                    placeholder={action.customer.name || action.customer.email || ""}
                  />
                </label>
              </>
            ) : null}

            {action.kind === "suspend" ? (
              <label className="prov-field">
                <span>Reason (required)</span>
                <textarea
                  className="prov-textarea"
                  placeholder="e.g. Abusive behaviour reported by providers"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            ) : null}

            {actionError ? (
              <div className="prov-modal-error">{actionError}</div>
            ) : null}

            <div className="prov-modal-actions">
              <button
                className="prov-btn prov-btn-ghost"
                type="button"
                disabled={actionBusy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button
                className={`prov-btn ${
                  action.kind === "delete" || action.kind === "suspend"
                    ? "prov-btn-danger"
                    : action.kind === "deactivate"
                      ? "prov-btn-dark"
                      : "prov-btn-primary"
                }`}
                type="button"
                disabled={
                  actionBusy ||
                  (action.kind === "delete" &&
                    deleteConfirmText.trim() !==
                      (action.customer.name || action.customer.email || ""))
                }
                onClick={runAction}
              >
                {actionBusy ? (
                  <>
                    <Loader2 className="prov-spin" size={15} /> Working...
                  </>
                ) : action.kind === "suspend" ? (
                  "Suspend"
                ) : action.kind === "reactivate" ? (
                  "Reactivate"
                ) : action.kind === "deactivate" ? (
                  "Deactivate"
                ) : action.kind === "activate" ? (
                  "Activate"
                ) : action.kind === "reset" ? (
                  "Send Reset Email"
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`prov-toast prov-toast-${toast.type}`}>
          {toast.type === "success" ? (
            <UserCheck size={16} />
          ) : (
            <TriangleAlert size={16} />
          )}
          {toast.text}
        </div>
      ) : null}

      {panelCustomer ? (
        <CustomerDetailPanel
          customer={panelCustomer}
          displayId={idNumbers.get(panelCustomer._id) || ""}
          onClose={() => setPanelId(null)}
          onAction={openAction}
          onMessage={(c) => setMessageCustomer(c)}
          onEdit={(c) => setEditCustomer(c)}
          tab={panelTab}
          onTabChange={setPanelTab}
        />
      ) : null}

      {editCustomer ? (
        <EditCustomerModal
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={(text) => {
            setEditCustomer(null);
            setToast({ type: "success", text });
          }}
        />
      ) : null}

      {messageCustomer ? (
        <CustomerMessageModal
          customer={messageCustomer}
          onClose={() => setMessageCustomer(null)}
          onSent={(text) => {
            setMessageCustomer(null);
            setToast({ type: "success", text });
          }}
        />
      ) : null}

      {addOpen ? (
        <AddCustomerModal
          onClose={() => setAddOpen(false)}
          onCreated={(text) => {
            setAddOpen(false);
            setToast({ type: "success", text });
          }}
        />
      ) : null}
    </section>
  );
}

export function EarningsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const earningsQuery = useQuery({
    queryKey: ["admin-earnings", dateRange.queryKey],
    queryFn: () => getAdminEarnings(dateRange.query),
    refetchInterval: 30000,
  });
  const earnings = earningsQuery.data;

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-earnings"] });
    socket.on("admin_booking_status_updated", refresh);
    socket.on("admin_payout_updated", refresh);
    return () => {
      socket.off("admin_booking_status_updated", refresh);
      socket.off("admin_payout_updated", refresh);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Earnings</h1>
          <p>Completed-booking earnings with OWVO commission and washer net income.</p>
        </div>
      </div>
      <div className="summary-grid">
        <article className="stat-card">
          <span>Today OWVO Earnings</span>
          <strong>{money(earnings?.summary.today.commissionAmount)}</strong>
        </article>
        <article className="stat-card">
          <span>This Week OWVO Earnings</span>
          <strong>{money(earnings?.summary.week.commissionAmount)}</strong>
        </article>
        <article className="stat-card">
          <span>Net Profit</span>
          <strong>{money(earnings?.summary.netProfit ?? earnings?.summary.pendingNet)}</strong>
        </article>
        <article className="stat-card">
          <span>Paid Out</span>
          <strong>{money(earnings?.summary.paidOut)}</strong>
        </article>
      </div>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Washer</th>
              <th>Service</th>
              <th className="numeric-cell">Gross</th>
              <th className="numeric-cell">
                {`OWVO ${Math.round((earnings?.commissionRate ?? 0.25) * 100)}%`}
              </th>
              <th className="numeric-cell">Washer Net</th>
            </tr>
          </thead>
          <tbody>
            {(earnings?.entries || []).map((entry) => (
              <tr key={entry.bookingId}>
                <td>
                  <strong>#{entry.bookingId.toString().slice(-6).toUpperCase()}</strong>
                  <span>{relativeDate(entry.date)}</span>
                </td>
                <td>{entry.provider?.name || "Washer"}</td>
                <td>{entry.service?.title || entry.service?.serviceType || "Wash Service"}</td>
                <td className="numeric-cell">{money(entry.grossAmount)}</td>
                <td className="numeric-cell">{money(entry.commissionAmount)}</td>
                <td className="numeric-cell">{money(entry.netAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {earningsQuery.isLoading ? <EmptyState text="Loading earnings..." /> : null}
      </TableShell>
    </section>
  );
}

export function PayoutsPaymentsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();

  const [typeFilter, setTypeFilter] = useState<
    "all" | "payment" | "payout" | "refund" | "failed"
  >("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminTransactionRow | null>(null);
  const [panelTab, setPanelTab] = useState<
    "overview" | "booking" | "details" | "notes" | "activity"
  >("overview");
  const [menu, setMenu] = useState<{
    row: AdminTransactionRow;
    x: number;
    y: number;
  } | null>(null);
  const [modal, setModal] = useState<
    | { kind: "refund"; row: AdminTransactionRow }
    | { kind: "review"; row: AdminTransactionRow }
    | { kind: "paymanually"; row: AdminTransactionRow }
    | { kind: "retry"; row: AdminTransactionRow }
    | { kind: "markfailed"; row: AdminTransactionRow }
    | { kind: "note"; row: AdminTransactionRow }
    | { kind: "receipt"; row: AdminTransactionRow }
    | { kind: "reconciliation" }
    | null
  >(null);
  const [noteText, setNoteText] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"internal" | "customer">(
    "internal"
  );
  const [noteError, setNoteError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPanelTab("overview");
    setNoteText("");
    setNoteError("");
  }, [selected?.id]);

  const effectiveType = typeFilter === "failed" ? "all" : typeFilter;
  const effectiveStatus = typeFilter === "failed" ? "failed" : statusFilter;

  const txnQuery = useQuery({
    queryKey: [
      "admin-transactions",
      effectiveType,
      effectiveStatus,
      search,
      page,
      dateRange.queryKey,
    ],
    queryFn: () =>
      getAdminTransactions({
        ...dateRange.query,
        type: effectiveType,
        status: effectiveStatus || undefined,
        search: search || undefined,
        page,
        limit: 20,
      }),
  });

  const reconQuery = useQuery({
    queryKey: ["admin-reconciliation"],
    queryFn: () => getAdminReconciliation(),
    staleTime: 60_000,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["admin-transaction-detail", selected?.sourceType, selected?.id],
    queryFn: () =>
      getAdminTransactionDetail(selected!.sourceType, selected!.id),
    enabled: !!selected,
  });

  // Live refresh — payout ya booking ki tabdeeli par list taza.
  useEffect(() => {
    if (!user?._id) return;
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user._id));
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
    };
    socket.on("admin_payout_updated", refresh);
    socket.on("admin_booking_created", refresh);
    socket.on("admin_booking_status_updated", refresh);
    return () => {
      socket.off("admin_payout_updated", refresh);
      socket.off("admin_booking_created", refresh);
      socket.off("admin_booking_status_updated", refresh);
      socket.disconnect();
    };
  }, [user?._id, queryClient]);

  const noteMutation = useMutation({
    mutationFn: () =>
      createAdminTransactionNote({
        sourceType: selected!.sourceType,
        sourceId: selected!.id,
        text: noteText.trim(),
        visibility: noteVisibility,
      }),
    onSuccess: () => {
      setNoteText("");
      setNoteError("");
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-detail"] });
    },
    onError: (err) =>
      setNoteError(payErrMsg(err, "Could not save the note.")),
  });

  const data = txnQuery.data;
  const rows = data?.transactions || [];
  const counts = data?.counts;
  const summary = data?.summary;
  const reconTotal = reconQuery.data?.counts?.total || 0;

  const statusOptions =
    typeFilter === "payment"
      ? ["paid", "pending", "failed"]
      : typeFilter === "payout"
        ? ["pending", "processing", "paid", "failed"]
        : typeFilter === "refund"
          ? [
              "requested",
              "under_review",
              "approved",
              "processing",
              "refunded",
              "rejected",
              "failed",
            ]
          : ["paid", "pending", "processing", "failed", "refunded", "requested"];

  const typePills: { key: typeof typeFilter; label: string; count?: number }[] = [
    { key: "all", label: "All", count: counts?.all },
    { key: "payment", label: "Payments", count: counts?.payment },
    { key: "payout", label: "Payouts", count: counts?.payout },
    { key: "refund", label: "Refunds", count: counts?.refund },
    { key: "failed", label: "Failed", count: counts?.failed },
  ];

  const openMenu = (
    event: ReactMouseEvent<HTMLButtonElement>,
    row: AdminTransactionRow
  ) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 300;
    const y =
      rect.bottom + menuHeight > window.innerHeight
        ? Math.max(8, rect.top - menuHeight)
        : rect.bottom + 4;
    setMenu({ row, x: Math.max(8, rect.right - 210), y });
  };

  const menuActions = (row: AdminTransactionRow) => {
    const actions: {
      label: string;
      danger?: boolean;
      run: () => void;
    }[] = [{ label: "View Details", run: () => setSelected(row) }];
    if (row.sourceType === "payment" && row.status === "paid" && row.bookingId) {
      actions.push({
        label: "Issue Refund",
        run: () => setModal({ kind: "refund", row }),
      });
    }
    if (row.sourceType === "payout" && (row.status === "pending" || row.status === "failed")) {
      actions.push({
        label: "Retry Automatic",
        run: () => setModal({ kind: "retry", row }),
      });
      actions.push({
        label: "Pay Manually",
        run: () => setModal({ kind: "paymanually", row }),
      });
      actions.push({
        label: "Mark as Failed",
        danger: true,
        run: () => setModal({ kind: "markfailed", row }),
      });
    }
    if (
      row.sourceType === "refund" &&
      ["requested", "under_review", "approved"].includes(row.status)
    ) {
      actions.push({
        label: "Review Refund",
        run: () => setModal({ kind: "review", row }),
      });
    }
    if (
      (row.sourceType !== "refund" && row.status === "paid") ||
      (row.sourceType === "refund" && row.status === "refunded")
    ) {
      actions.push({
        label: "View Receipt",
        run: () => setModal({ kind: "receipt", row }),
      });
    }
    actions.push({
      label: "Add Note",
      run: () => setModal({ kind: "note", row }),
    });
    return actions;
  };

  const detail = detailQuery.data;
  const record = (detail?.record || {}) as Record<string, unknown>;
  const booking = (detail?.booking || null) as Record<string, unknown> | null;
  const bookingService = (booking?.service || null) as
    | Record<string, unknown>
    | null;
  const bookingUser = (booking?.user || null) as Record<string, unknown> | null;
  const bookingProvider = (booking?.provider || null) as
    | Record<string, unknown>
    | null;
  const attempts = Array.isArray(record.attempts)
    ? (record.attempts as Record<string, unknown>[])
    : [];
  const detailNotes = detail?.notes || [];

  const partyName = (row: AdminTransactionRow) =>
    row.sourceType === "payout"
      ? row.provider?.name || "Provider"
      : row.customer?.name || "Customer";
  const partyEmail = (row: AdminTransactionRow) =>
    row.sourceType === "payout" ? row.provider?.email : row.customer?.email;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Payments &amp; Refunds</h1>
          <p>
            Every payment, payout and refund in one ledger — live from Stripe
            and the backend, nothing estimated.
          </p>
        </div>
        <div className="pay-header-actions">
          <button
            type="button"
            className="pay-btn pay-btn-ghost"
            onClick={() => setModal({ kind: "reconciliation" })}
          >
            <ShieldCheck size={16} /> Reconciliation
            {reconTotal > 0 ? (
              <span className="pay-badge">{reconTotal}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="pay-btn pay-btn-ghost"
            onClick={() => {
              txnQuery.refetch();
              reconQuery.refetch();
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {reconTotal > 0 ? (
        <button
          type="button"
          className="pay-attention"
          onClick={() => setModal({ kind: "reconciliation" })}
        >
          <TriangleAlert size={16} />
          {reconTotal} item{reconTotal === 1 ? "" : "s"} need reconciliation —
          a refund or payout may be stuck. Click to review.
        </button>
      ) : null}

      <div className="summary-grid">
        <article className="stat-card">
          <span>Total Payments</span>
          <strong>{money(summary?.totalPayments)}</strong>
          <small>{dateRange.label} · successful payments</small>
        </article>
        <article className="stat-card">
          <span>Pending Payouts</span>
          <strong>{money(summary?.pendingPayouts)}</strong>
          <small>Queued or processing to providers</small>
        </article>
        <article className="stat-card">
          <span>Refund Requests</span>
          <strong>{money(summary?.refundRequestsAmount)}</strong>
          <small>{summary?.refundRequestsCount || 0} awaiting a decision</small>
        </article>
        <article className="stat-card">
          <span>Failed</span>
          <strong>{money(summary?.failedAmount)}</strong>
          <small>Failed payments &amp; payouts in range</small>
        </article>
      </div>

      <div className="pay-pills">
        {typePills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            className={`pay-pill${typeFilter === pill.key ? " active" : ""}`}
            onClick={() => {
              setTypeFilter(pill.key);
              setStatusFilter("");
              setPage(1);
            }}
          >
            {pill.label}
            {typeof pill.count === "number" ? (
              <span className="pay-pill-count">{pill.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="pay-toolbar">
        <div className="pay-search">
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search TXN, name or email…"
          />
        </div>
        <select
          className="pay-select"
          value={statusFilter}
          disabled={typeFilter === "failed"}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {PAY_STATUS_LABELS[status] || status}
            </option>
          ))}
        </select>
      </div>

      {txnQuery.isError ? (
        <div className="pay-state">
          <p className="form-error">
            Could not load transactions — please check your connection.
          </p>
          <button
            type="button"
            className="pay-btn pay-btn-primary"
            onClick={() => txnQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : (
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Type</th>
                <th>Party</th>
                <th>Method</th>
                <th>Date</th>
                <th className="numeric-cell">Amount</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {txnQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="pay-state-cell">
                    Loading transactions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pay-state-cell">
                    No transactions found for this filter
                    {search ? ` and search “${search}”` : ""} in {dateRange.label}.
                    Try a wider date range or a different filter.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={`${row.sourceType}-${row.id}`}
                    className="pay-row"
                    onClick={() => setSelected(row)}
                  >
                    <td>
                      <strong>{row.txnNumber || "—"}</strong>
                      {row.bookingId ? (
                        <span className="pay-sub">
                          Booking …{String(row.bookingId).slice(-6)}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <span className={`pay-type pay-type-${row.sourceType}`}>
                        {row.sourceType === "payment"
                          ? row.kind === "tips"
                            ? "Tip"
                            : "Payment"
                          : row.sourceType === "payout"
                            ? row.kind === "bonus"
                              ? "Bonus Payout"
                              : "Payout"
                            : "Refund"}
                      </span>
                    </td>
                    <td>
                      <div className="pay-party">
                        <PayAvatar name={partyName(row)} />
                        <div>
                          <strong>{partyName(row)}</strong>
                          <span className="pay-sub">{partyEmail(row) || ""}</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.method}</td>
                    <td>{payFmtDate(row.createdAt)}</td>
                    <td
                      className={`numeric-cell pay-amount ${
                        row.direction === "out" ? "pay-amount-out" : "pay-amount-in"
                      }`}
                    >
                      {row.direction === "out" ? "−" : "+"}
                      {money(row.amount)}
                    </td>
                    <td>
                      <span className={`pay-status pay-status-${row.status}`}>
                        {PAY_STATUS_LABELS[row.status] || row.status}
                      </span>
                      {row.failureReason ? (
                        <span className="pay-sub pay-fail-reason">
                          {row.failureReason}
                        </span>
                      ) : null}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="pay-icon-btn"
                        aria-label="Transaction actions"
                        onClick={(event) => openMenu(event, row)}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableShell>
      )}

      {data && data.totalPages > 1 ? (
        <div className="pay-pagination">
          <button
            type="button"
            className="pay-btn pay-btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={15} /> Previous
          </button>
          <span>
            Page {data.page} of {data.totalPages} · {data.total} transactions
          </span>
          <button
            type="button"
            className="pay-btn pay-btn-ghost"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={15} />
          </button>
        </div>
      ) : null}

      <div className="pay-how">
        <strong>How actions work:</strong>
        <span>
          Refunds return by the original route (wallet instantly, card in 3–10
          days). Automatic payouts run through Stripe Connect; a failed one can
          be retried or paid manually — never twice. Paid records are final and
          are never deleted.
        </span>
      </div>

      {/* ── Row actions menu (fixed position — table overflow se bahar) ── */}
      {menu ? (
        <>
          <div className="pay-menu-backdrop" onClick={() => setMenu(null)} />
          <div className="pay-menu" style={{ left: menu.x, top: menu.y }}>
            {menuActions(menu.row).map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.danger ? "danger" : ""}
                onClick={() => {
                  setMenu(null);
                  action.run();
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* ── Detail panel ── */}
      {selected ? (
        <>
          <div className="pay-panel-overlay" onClick={() => setSelected(null)} />
          <aside className="pay-panel">
            <div className="pay-panel-head">
              <div>
                <h3>{selected.txnNumber || "Transaction"}</h3>
                <p>
                  <span className={`pay-status pay-status-${selected.status}`}>
                    {PAY_STATUS_LABELS[selected.status] || selected.status}
                  </span>{" "}
                  · {payFmtDateTime(selected.createdAt)}
                </p>
              </div>
              <button
                type="button"
                className="pay-icon-btn"
                onClick={() => setSelected(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="pay-panel-amount">
              <span>
                {selected.sourceType === "payout"
                  ? "Payout"
                  : selected.sourceType === "refund"
                    ? "Refund"
                    : selected.kind === "tips"
                      ? "Tip"
                      : "Payment"}
              </span>
              <strong>
                {selected.direction === "out" ? "−" : "+"}
                {money(selected.amount)}
              </strong>
              <small>{selected.method}</small>
            </div>

            <div className="pay-tabs">
              {(
                [
                  ["overview", "Overview"],
                  ["booking", "Booking"],
                  ["details", "Payment Details"],
                  ["notes", "Notes"],
                  ["activity", "Activity"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={panelTab === key ? "active" : ""}
                  onClick={() => setPanelTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="pay-panel-body">
              {detailQuery.isLoading ? (
                <p className="pay-hint">Loading details…</p>
              ) : detailQuery.isError ? (
                <p className="form-error">
                  Could not load the full details.{" "}
                  <button type="button" className="mini-text-button" onClick={() => detailQuery.refetch()}>
                    Retry
                  </button>
                </p>
              ) : null}

              {panelTab === "overview" ? (
                <div>
                  <div className="pay-kv">
                    <span>{selected.sourceType === "payout" ? "Provider" : "Customer"}</span>
                    <strong>{partyName(selected)}</strong>
                  </div>
                  <div className="pay-kv">
                    <span>Email</span>
                    <strong>{partyEmail(selected) || "—"}</strong>
                  </div>
                  {selected.sourceType !== "payout" && selected.provider ? (
                    <div className="pay-kv">
                      <span>Provider</span>
                      <strong>{selected.provider.name}</strong>
                    </div>
                  ) : null}
                  {booking ? (
                    <>
                      <div className="pay-kv">
                        <span>Booking total</span>
                        <strong>
                          {money(
                            Number(booking.finalPrice ?? booking.price ?? 0)
                          )}
                        </strong>
                      </div>
                      {booking.providerNetAmount !== null &&
                      booking.providerNetAmount !== undefined ? (
                        <>
                          <div className="pay-kv">
                            <span>
                              OWVO commission
                              {booking.commissionRate !== null &&
                              booking.commissionRate !== undefined
                                ? ` (${Math.round(Number(booking.commissionRate) * 100)}% — rate at completion)`
                                : ""}
                            </span>
                            <strong>{money(Number(booking.commissionAmount ?? 0))}</strong>
                          </div>
                          <div className="pay-kv">
                            <span>Provider net</span>
                            <strong>{money(Number(booking.providerNetAmount))}</strong>
                          </div>
                        </>
                      ) : (
                        <div className="pay-kv">
                          <span>Commission split</span>
                          <strong>Snapshot pending (runs with the one-time update)</strong>
                        </div>
                      )}
                    </>
                  ) : null}
                  {selected.sourceType === "payment" &&
                  Number(record.walletAmount || 0) > 0 ? (
                    <>
                      <div className="pay-kv">
                        <span>Paid from wallet</span>
                        <strong>{money(Number(record.walletAmount))}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Paid by card</span>
                        <strong>{money(Number(record.cardAmount || 0))}</strong>
                      </div>
                    </>
                  ) : null}
                  {selected.sourceType === "refund" ? (
                    <>
                      <div className="pay-kv">
                        <span>Back to wallet</span>
                        <strong>{money(Number(record.walletPortion || 0))}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Back to card</span>
                        <strong>{money(Number(record.cardPortion || 0))}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Reason</span>
                        <strong>{String(record.reason || "—")}</strong>
                      </div>
                    </>
                  ) : null}
                  {selected.failureReason ? (
                    <div className="pay-kv">
                      <span>Failure reason</span>
                      <strong>{selected.failureReason}</strong>
                    </div>
                  ) : null}
                  <div className="pay-panel-actions">
                    {selected.sourceType === "payment" &&
                    selected.status === "paid" &&
                    selected.bookingId ? (
                      <button
                        type="button"
                        className="pay-btn pay-btn-danger"
                        onClick={() => setModal({ kind: "refund", row: selected })}
                      >
                        <RotateCcw size={15} /> Issue Refund
                      </button>
                    ) : null}
                    {selected.sourceType === "payout" &&
                    (selected.status === "pending" || selected.status === "failed") ? (
                      <>
                        <button
                          type="button"
                          className="pay-btn pay-btn-primary"
                          onClick={() => setModal({ kind: "retry", row: selected })}
                        >
                          <RotateCcw size={15} /> Retry Automatic
                        </button>
                        <button
                          type="button"
                          className="pay-btn pay-btn-ghost"
                          onClick={() => setModal({ kind: "paymanually", row: selected })}
                        >
                          <Send size={15} /> Pay Manually
                        </button>
                      </>
                    ) : null}
                    {selected.sourceType === "refund" &&
                    ["requested", "under_review", "approved"].includes(selected.status) ? (
                      <button
                        type="button"
                        className="pay-btn pay-btn-primary"
                        onClick={() => setModal({ kind: "review", row: selected })}
                      >
                        Review Refund
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {panelTab === "booking" ? (
                <div>
                  {booking ? (
                    <>
                      <div className="pay-kv">
                        <span>Service</span>
                        <strong>{String(bookingService?.title || "—")}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Status</span>
                        <strong style={{ textTransform: "capitalize" }}>
                          {String(booking.status || "—")}
                        </strong>
                      </div>
                      <div className="pay-kv">
                        <span>Customer</span>
                        <strong>{String(bookingUser?.name || "—")}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Provider</span>
                        <strong>{String(bookingProvider?.name || "—")}</strong>
                      </div>
                      <div className="pay-kv">
                        <span>Scheduled</span>
                        <strong>
                          {payFmtDateTime(
                            (booking.date as string) || (booking.createdAt as string)
                          )}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="pay-btn pay-btn-ghost"
                        onClick={() => {
                          window.location.href = `/bookings/${selected.bookingId || booking._id}`;
                        }}
                      >
                        <Eye size={15} /> Open booking
                      </button>
                    </>
                  ) : selected.sourceType === "payout" &&
                    (detail?.bookings || []).length > 0 ? (
                    <>
                      <p className="pay-hint">
                        This payout covers these bookings:
                      </p>
                      {(detail?.bookings || []).map((item) => {
                        const b = item as Record<string, unknown>;
                        const svc = (b.service || null) as
                          | Record<string, unknown>
                          | null;
                        return (
                          <div className="pay-kv" key={String(b._id)}>
                            <span>
                              {String(svc?.title || "Booking")} ·{" "}
                              {payFmtDate(b.completedAt as string)}
                            </span>
                            <strong>{money(Number(b.finalPrice ?? b.price ?? 0))}</strong>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="pay-hint">No booking is linked to this transaction.</p>
                  )}
                </div>
              ) : null}

              {panelTab === "details" ? (
                <div>
                  {(
                    [
                      ["Transaction ID", record._id],
                      ["Stripe payment", record.transactionId],
                      ["Stripe transfer", record.stripeTransferId],
                      ["Stripe payout", record.stripePayoutId],
                      ["Stripe refund", record.stripeRefundId],
                      ["Destination account", record.stripeDestinationAccountId],
                      ["Manual record note", record.manualAdjustmentReason],
                      ["Failure reason", record.failureReason],
                      ["Created", record.createdAt ? payFmtDateTime(String(record.createdAt)) : null],
                      ["Last updated", record.updatedAt ? payFmtDateTime(String(record.updatedAt)) : null],
                      ["Paid at", record.paidAt ? payFmtDateTime(String(record.paidAt)) : null],
                      ["Refunded at", record.refundedAt ? payFmtDateTime(String(record.refundedAt)) : null],
                    ] as [string, unknown][]
                  )
                    .filter(([, value]) => value !== undefined && value !== null && value !== "")
                    .map(([label, value]) => (
                      <div className="pay-kv" key={label}>
                        <span>{label}</span>
                        <strong className="pay-mono">{String(value)}</strong>
                      </div>
                    ))}
                  {attempts.length > 0 ? (
                    <>
                      <h4 className="pay-section-title">Attempts</h4>
                      {attempts.map((attempt, index) => (
                        <div className="pay-kv" key={index}>
                          <span>
                            {payFmtDateTime(attempt.at as string)} ·{" "}
                            {String(attempt.action || "")}
                          </span>
                          <strong>
                            {String(attempt.result || "")}
                            {attempt.note ? ` — ${String(attempt.note)}` : ""}
                          </strong>
                        </div>
                      ))}
                    </>
                  ) : null}
                  {record.earningReversal ? (
                    <>
                      <h4 className="pay-section-title">Provider earning reversal</h4>
                      <div className="pay-kv">
                        <span>Status</span>
                        <strong>
                          {String(
                            (record.earningReversal as Record<string, unknown>).status || "none"
                          )}
                        </strong>
                      </div>
                      <div className="pay-kv">
                        <span>Amount</span>
                        <strong>
                          {money(
                            Number(
                              (record.earningReversal as Record<string, unknown>).amount || 0
                            )
                          )}
                        </strong>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              {panelTab === "notes" ? (
                <div>
                  {detailNotes.length === 0 ? (
                    <p className="pay-hint">No notes yet for this transaction.</p>
                  ) : (
                    detailNotes.map((note) => (
                      <div className="pay-note" key={note._id}>
                        <div className="pay-note-head">
                          <strong>{note.author?.name || "Admin"}</strong>
                          <span>
                            {note.visibility === "customer" ? "Customer can see" : "Internal"} ·{" "}
                            {payFmtDateTime(note.createdAt)}
                          </span>
                        </div>
                        <p>{note.text}</p>
                      </div>
                    ))
                  )}
                  {noteError ? <div className="pay-error">{noteError}</div> : null}
                  <div className="pay-radio-row">
                    <label>
                      <input
                        type="radio"
                        name="panel-note-visibility"
                        checked={noteVisibility === "internal"}
                        onChange={() => setNoteVisibility("internal")}
                      />
                      Internal
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="panel-note-visibility"
                        checked={noteVisibility === "customer"}
                        onChange={() => setNoteVisibility("customer")}
                      />
                      Customer can see
                    </label>
                  </div>
                  <label className="pay-field">
                    <span>Add a note</span>
                    <textarea
                      rows={3}
                      value={noteText}
                      onChange={(event) => setNoteText(event.target.value)}
                      placeholder="Write the note…"
                    />
                  </label>
                  <button
                    type="button"
                    className="pay-btn pay-btn-primary"
                    disabled={noteMutation.isPending || !noteText.trim()}
                    onClick={() => noteMutation.mutate()}
                  >
                    {noteMutation.isPending ? "Saving…" : "Save note"}
                  </button>
                </div>
              ) : null}

              {panelTab === "activity" ? (
                <div>
                  <div className="pay-kv">
                    <span>Created</span>
                    <strong>{payFmtDateTime(selected.createdAt)}</strong>
                  </div>
                  {attempts.length > 0 ? (
                    attempts.map((attempt, index) => (
                      <div className="pay-kv" key={index}>
                        <span>{payFmtDateTime(attempt.at as string)}</span>
                        <strong>
                          {String(attempt.action || "")} → {String(attempt.result || "")}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="pay-hint">
                      No separate activity entries — status changes for this
                      transaction appear in the Activity Logs.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {/* ── Modals ── */}
      {modal?.kind === "refund" ? (
        <IssueRefundModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "review" ? (
        <RefundReviewModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "paymanually" ? (
        <PayManuallyModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "retry" ? (
        <RetryPayoutModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "markfailed" ? (
        <MarkPayoutFailedModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "note" ? (
        <TransactionNoteModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "receipt" ? (
        <ReceiptModal row={modal.row} onClose={() => setModal(null)} />
      ) : null}
      {modal?.kind === "reconciliation" ? (
        <ReconciliationModal
          data={reconQuery.data}
          isLoading={reconQuery.isLoading}
          isError={reconQuery.isError}
          onRetry={() => reconQuery.refetch()}
          onClose={() => setModal(null)}
        />
      ) : null}
    </section>
  );
}

function CatalogServiceRow({
  service,
  onDelete,
  isDeleting,
}: {
  service: AdminService;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(service.title || "");
  const [price, setPrice] = useState(service.price.toString());
  const [serviceType, setServiceType] = useState(service.serviceType);
  const [carSize, setCarSize] = useState(service.carSize);
  const [description, setDescription] = useState(service.description || "");
  const [isActive, setIsActive] = useState(service.isActive);
  const mutation = useMutation({
    mutationFn: () =>
      updateAdminCatalogService(service._id, {
        title,
        price: Number(price),
        serviceType,
        carSize,
        carName: service.carName || "Any car",
        carModel: service.carModel || "Any model",
        description,
        isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] }),
  });

  useEffect(() => {
    setTitle(service.title || "");
    setPrice(service.price.toString());
    setServiceType(service.serviceType);
    setCarSize(service.carSize);
    setDescription(service.description || "");
    setIsActive(service.isActive);
  }, [service]);

  return (
    <tr>
      <td>
        <input className="table-input" onChange={(event) => setTitle(event.target.value)} value={title} />
        <span>{service.catalogKey || "catalog"}</span>
      </td>
      <td>
        <select
          className="table-select"
          onChange={(event) => setServiceType(event.target.value as AdminService["serviceType"])}
          value={serviceType}
        >
          <option value="basic">Basic</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </td>
      <td>
        <select
          className="table-select"
          onChange={(event) => setCarSize(event.target.value as AdminService["carSize"])}
          value={carSize}
        >
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </td>
      <td className="numeric-cell">
        <input
          className="table-input numeric-table-input"
          min="1"
          onChange={(event) => setPrice(event.target.value)}
          type="number"
          value={price}
        />
      </td>
      <td>
        <input
          className="table-input"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
      </td>
      <td>
        <label className="check-label compact-check">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
          Active
        </label>
      </td>
      <td>
        <button className="approve-action" disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">
          <Save size={15} />
          Save
        </button>
        <button
          aria-label={`Delete ${service.title || "service"}`}
          className="mini-text-button"
          disabled={isDeleting || mutation.isPending}
          onClick={onDelete}
          title="Delete service"
          type="button"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </td>
    </tr>
  );
}

function PlatformDailyLimitControl({
  value,
  isPending,
  onSave,
}: {
  value: number;
  isPending: boolean;
  onSave: (dailyWashLimitMax: number) => void;
}) {
  const currentValue = value || 7;
  const [draft, setDraft] = useState(String(currentValue));

  useEffect(() => {
    setDraft(String(currentValue));
  }, [currentValue]);

  const parsed = Number(draft);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;
  const isDirty = isValid && parsed !== currentValue;

  return (
    <form
      className="daily-limit-default-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (isValid) onSave(parsed);
      }}
    >
      <label>
        Platform Daily Wash Limit
        <input
          inputMode="numeric"
          max={50}
          min={1}
          name="platformDailyWashLimitMax"
          onChange={(event) => setDraft(event.target.value)}
          type="number"
          value={draft}
        />
      </label>
      <button className="approve-action" disabled={!isDirty || isPending} type="submit">
        <SlidersHorizontal size={15} />
        Save Default
      </button>
      <span>Providers without a custom limit use {currentValue} washes per day.</span>
    </form>
  );
}

function ProviderDailyLimitControl({
  item,
  isPending,
  onSave,
}: {
  item: AdminServicesPricing["providerSummaries"][number];
  isPending: boolean;
  onSave: (providerId: string, dailyWashLimitMax: number) => void;
}) {
  const limit = item.dailyWashLimit;
  const currentMax = limit.max || 7;
  const [value, setValue] = useState(String(currentMax));

  useEffect(() => {
    setValue(String(currentMax));
  }, [currentMax]);

  const parsed = Number(value);
  const isValid = Number.isInteger(parsed) && parsed >= 1 && parsed <= 50;
  const isDirty = isValid && parsed !== currentMax;

  return (
    <div className="daily-limit-control">
      <div className="daily-limit-value">
        <strong>{limit.remaining}/{currentMax}</strong>
        <span>{limit.customMax ? "Custom provider limit" : `Platform default ${limit.platformMax}`}</span>
      </div>
      <input
        aria-label={`Daily wash limit for ${item.provider.name || item.provider.email || "provider"}`}
        className="table-input numeric-table-input"
        inputMode="numeric"
        max={50}
        min={1}
        onChange={(event) => setValue(event.target.value)}
        title="Edit this provider's daily wash limit"
        type="number"
        value={value}
      />
      <button
        className="mini-text-button"
        disabled={!isValid || !isDirty || isPending}
        onClick={() => onSave(item.provider._id, parsed)}
        type="button"
      >
        <Save size={15} />
        Save
      </button>
    </div>
  );
}
function getProviderFromService(service: AdminService) {
  return typeof service.provider === "object" && service.provider !== null
    ? service.provider
    : null;
}

export function ServicesPricingPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const [showAddService, setShowAddService] = useState(false);
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [serviceMutationError, setServiceMutationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"services" | "addons">("services");
  const servicesQuery = useQuery({
    queryKey: ["admin-services-pricing"],
    queryFn: getAdminServicesPricing,
  });
  const createServiceMutation = useMutation({
    mutationFn: (
      payload: Pick<AdminService, "title" | "serviceType" | "price" | "carSize" | "carName" | "carModel" | "description" | "isActive">
    ) => createAdminCatalogService(payload),
    onSuccess: () => {
      setShowAddService(false);
      setServiceMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] });
    },
    onError: (error) => setServiceMutationError(getApiErrorMessage(error)),
  });
  const deleteServiceMutation = useMutation({
    mutationFn: (serviceId: string) => deleteAdminCatalogService(serviceId),
    onSuccess: () => {
      setServiceMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] });
    },
    onError: (error) => setServiceMutationError(getApiErrorMessage(error)),
  });
  const handleDeleteService = (service: AdminService) => {
    if (
      window.confirm(
        `Delete service "${service.title || "Service"}"? This also removes it from all providers.`
      )
    ) {
      deleteServiceMutation.mutate(service._id);
    }
  };
  const updateProviderServiceMutation = useMutation({
    mutationFn: ({
      providerId,
      serviceId,
      isActive,
    }: {
      providerId: string;
      serviceId: string;
      isActive: boolean;
    }) => updateAdminProviderService(providerId, serviceId, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] }),
  });
  const updateProviderDailyLimitMutation = useMutation({
    mutationFn: ({
      providerId,
      dailyWashLimitMax,
    }: {
      providerId: string;
      dailyWashLimitMax: number;
    }) => updateProviderDailyWashLimit(providerId, { dailyWashLimitMax }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] }),
  });
  const updatePlatformDailyLimitMutation = useMutation({
    mutationFn: (dailyWashLimitMax: number) => updateDashboardSettings({ dailyWashLimitMax }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-settings"] });
    },
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refreshServicesPricing = () => queryClient.invalidateQueries({ queryKey: ["admin-services-pricing"] });

    socket.on("admin_services_pricing_updated", refreshServicesPricing);
    socket.on("admin_settings_updated", refreshServicesPricing);
    socket.on("admin_booking_created", refreshServicesPricing);
    socket.on("admin_booking_status_updated", refreshServicesPricing);

    return () => {
      socket.off("admin_services_pricing_updated", refreshServicesPricing);
      socket.off("admin_settings_updated", refreshServicesPricing);
      socket.off("admin_booking_created", refreshServicesPricing);
      socket.off("admin_booking_status_updated", refreshServicesPricing);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  const data = servicesQuery.data;
  const activeProviderServices = data?.providerServices.filter((service) => service.isActive).length || 0;
  const averageServices =
    data?.providerSummaries.length
      ? data.providerSummaries.reduce((sum, item) => sum + item.counts.active, 0) /
        data.providerSummaries.length
      : 0;

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Services & Pricing</h1>
          <p>Platform-controlled service names, prices, provider availability, and daily wash limits.</p>
        </div>
      </div>
      {serviceMutationError ? <p className="form-error">{serviceMutationError}</p> : null}
      <div className="services-tabs">
        <button
          className={activeTab === "services" ? "filter-pill active" : "filter-pill"}
          onClick={() => setActiveTab("services")}
          type="button"
        >
          Services
        </button>
        <button
          className={activeTab === "addons" ? "filter-pill active" : "filter-pill"}
          onClick={() => setActiveTab("addons")}
          type="button"
        >
          Add-ons
        </button>
      </div>
      <div className="tab-actions-row">
        {activeTab === "services" ? (
          <button className="primary-button compact-action" onClick={() => setShowAddService(true)} type="button">
            <Plus size={16} />
            Add Service
          </button>
        ) : (
          <button className="primary-button compact-action" onClick={() => setShowAddAddon(true)} type="button">
            <Plus size={16} />
            Add Add-on
          </button>
        )}
      </div>
      {activeTab === "services" ? (
        <>
      <div className="summary-grid">
        <article className="stat-card">
          <span>Catalog Services</span>
          <strong>{data?.catalogServices.length || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Providers</span>
          <strong>{data?.providerSummaries.length || 0}</strong>
        </article>
        <article className="stat-card">
          <span>Active Provider Services</span>
          <strong>{activeProviderServices}</strong>
        </article>
        <article className="stat-card">
          <span>Avg Services / Provider</span>
          <strong>{averageServices.toFixed(1)}</strong>
        </article>
      </div>
      <PlatformDailyLimitControl
        isPending={updatePlatformDailyLimitMutation.isPending}
        onSave={(dailyWashLimitMax) => updatePlatformDailyLimitMutation.mutate(dailyWashLimitMax)}
        value={data?.platformSettings?.dailyWashLimitMax || 7}
      />
      {updatePlatformDailyLimitMutation.error ? (
        <p className="form-error">{getApiErrorMessage(updatePlatformDailyLimitMutation.error)}</p>
      ) : null}
      {updateProviderDailyLimitMutation.error ? (
        <p className="form-error">{getApiErrorMessage(updateProviderDailyLimitMutation.error)}</p>
      ) : null}
      <TableShell>
        <table className="admin-table service-pricing-table">
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Type</th>
              <th>Car Size</th>
              <th className="numeric-cell">Price</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.catalogServices || []).map((service) => (
              <CatalogServiceRow
                key={service._id}
                onDelete={() => handleDeleteService(service)}
                isDeleting={deleteServiceMutation.isPending}
                service={service}
              />
            ))}
          </tbody>
        </table>
        {servicesQuery.isLoading ? <EmptyState icon={<BadgePoundSterling size={22} />} text="Loading services..." /> : null}
      </TableShell>
      <div className="split-grid">
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Service Area</th>
                <th>Active Services</th>
                <th>Total Services</th>
                <th>Daily Wash Limit</th>
              </tr>
            </thead>
            <tbody>
              {(data?.providerSummaries || []).map((item) => (
                <tr key={item.provider._id}>
                  <td>
                    <AvatarName user={item.provider} fallback="Provider" />
                  </td>
                  <td>{item.provider.serviceArea || "Not set"}</td>
                  <td>{item.counts.active}</td>
                  <td>{item.counts.total}</td>
                  <td>
                    <ProviderDailyLimitControl
                      isPending={updateProviderDailyLimitMutation.isPending}
                      item={item}
                      onSave={(providerId, dailyWashLimitMax) =>
                        updateProviderDailyLimitMutation.mutate({ providerId, dailyWashLimitMax })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider Service</th>
                <th>Provider</th>
                <th className="numeric-cell">Price</th>
                <th>Control</th>
              </tr>
            </thead>
            <tbody>
              {(data?.providerServices || []).map((service) => {
                const provider = getProviderFromService(service);
                return (
                  <tr key={service._id}>
                    <td>
                      <strong>{service.title || "Service"}</strong>
                      <span>{service.serviceType}</span>
                    </td>
                    <td>{provider?.name || provider?.email || "Provider"}</td>
                    <td className="numeric-cell">{money(service.price)}</td>
                    <td>
                      <button
                        className="mini-text-button"
                        disabled={updateProviderServiceMutation.isPending || !provider?._id}
                        onClick={() =>
                          provider?._id
                            ? updateProviderServiceMutation.mutate({
                                providerId: provider._id,
                                serviceId: service._id,
                                isActive: !service.isActive,
                              })
                            : undefined
                        }
                        type="button"
                      >
                        {service.isActive ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableShell>
      </div>
        </>
      ) : (
        <AddonsSection onCloseAddModal={() => setShowAddAddon(false)} showAddModal={showAddAddon} />
      )}
      {showAddService ? (
        <AddServiceModal
          error={createServiceMutation.error ? getApiErrorMessage(createServiceMutation.error) : null}
          isSaving={createServiceMutation.isPending}
          onCancel={() => setShowAddService(false)}
          onSubmit={(payload) => createServiceMutation.mutate(payload)}
        />
      ) : null}
    </section>
  );
}

type AdminCatalogServicePayload = Pick<
  AdminService,
  "title" | "serviceType" | "price" | "carSize" | "carName" | "carModel" | "description" | "isActive"
>;

function ServicesModalShell({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="training-modal-overlay" onClick={onCancel} role="presentation">
      <div className="training-modal-panel" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="data-page-header">
          <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>
          <button aria-label="Close" className="mini-text-button" onClick={onCancel} type="button">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddServiceModal({
  onCancel,
  onSubmit,
  isSaving,
  error,
}: {
  onCancel: () => void;
  onSubmit: (payload: AdminCatalogServicePayload) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [title, setTitle] = useState("");
  const [serviceType, setServiceType] = useState<AdminService["serviceType"]>("basic");
  const [carSize, setCarSize] = useState<AdminService["carSize"]>("medium");
  const [price, setPrice] = useState("");
  const [carName, setCarName] = useState("Any car");
  const [carModel, setCarModel] = useState("Any model");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(price);
    if (!title.trim() || !parsedPrice || parsedPrice <= 0) return;
    onSubmit({
      title: title.trim(),
      serviceType,
      price: parsedPrice,
      carSize,
      carName: carName.trim() || "Any car",
      carModel: carModel.trim() || "Any model",
      description: description.trim(),
      isActive,
    });
  };

  return (
    <ServicesModalShell onCancel={onCancel} title="Add Service">
      <form onSubmit={handleSubmit}>
        <label className="form-field">
          Title
          <input className="table-input" onChange={(event) => setTitle(event.target.value)} required type="text" value={title} />
        </label>
        <label className="form-field">
          Service type
          <select className="table-select" onChange={(event) => setServiceType(event.target.value as AdminService["serviceType"])} value={serviceType}>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </label>
        <label className="form-field">
          Car size
          <select className="table-select" onChange={(event) => setCarSize(event.target.value as AdminService["carSize"])} value={carSize}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="form-field">
          Price (£)
          <input className="table-input" min="1" onChange={(event) => setPrice(event.target.value)} required type="number" value={price} />
        </label>
        <label className="form-field">
          Car name
          <input className="table-input" onChange={(event) => setCarName(event.target.value)} type="text" value={carName} />
        </label>
        <label className="form-field">
          Car model
          <input className="table-input" onChange={(event) => setCarModel(event.target.value)} type="text" value={carModel} />
        </label>
        <label className="form-field">
          Description
          <input className="table-input" onChange={(event) => setDescription(event.target.value)} type="text" value={description} />
        </label>
        <label className="check-label">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
          Active
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? <Loader2 className="spin" size={16} /> : null}
            Add Service
          </button>
        </div>
      </form>
    </ServicesModalShell>
  );
}

function AddonRow({
  addon,
  onDelete,
  isDeleting,
}: {
  addon: AdminAddon;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(addon.name);
  const [price, setPrice] = useState(addon.price.toString());
  const [description, setDescription] = useState(addon.description || "");
  const [isActive, setIsActive] = useState(addon.isActive);
  const mutation = useMutation({
    mutationFn: () =>
      updateAdminAddon(addon._id, {
        name,
        price: Number(price),
        description,
        isActive,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-addons"] }),
  });

  useEffect(() => {
    setName(addon.name);
    setPrice(addon.price.toString());
    setDescription(addon.description || "");
    setIsActive(addon.isActive);
  }, [addon]);

  return (
    <tr>
      <td>
        <input className="table-input" onChange={(event) => setName(event.target.value)} value={name} />
      </td>
      <td className="numeric-cell">
        <input
          className="table-input numeric-table-input"
          min="1"
          onChange={(event) => setPrice(event.target.value)}
          type="number"
          value={price}
        />
      </td>
      <td>
        <input className="table-input" onChange={(event) => setDescription(event.target.value)} value={description} />
      </td>
      <td>
        <label className="check-label compact-check">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
          Active
        </label>
      </td>
      <td>
        <button className="approve-action" disabled={mutation.isPending} onClick={() => mutation.mutate()} type="button">
          <Save size={15} />
          Save
        </button>
        <button
          aria-label={`Delete ${addon.name}`}
          className="mini-text-button"
          disabled={isDeleting || mutation.isPending}
          onClick={onDelete}
          title="Delete add-on"
          type="button"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </td>
    </tr>
  );
}

function AddAddonModal({
  onCancel,
  onSubmit,
  isSaving,
  error,
}: {
  onCancel: () => void;
  onSubmit: (payload: { name: string; price: number; description?: string; isActive: boolean }) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsedPrice = Number(price);
    if (!name.trim() || !parsedPrice || parsedPrice <= 0) return;
    onSubmit({
      name: name.trim(),
      price: parsedPrice,
      description: description.trim() || undefined,
      isActive,
    });
  };

  return (
    <ServicesModalShell onCancel={onCancel} title="Add Add-on">
      <form onSubmit={handleSubmit}>
        <label className="form-field">
          Name
          <input className="table-input" onChange={(event) => setName(event.target.value)} required type="text" value={name} />
        </label>
        <label className="form-field">
          Price (£)
          <input className="table-input" min="1" onChange={(event) => setPrice(event.target.value)} required type="number" value={price} />
        </label>
        <label className="form-field">
          Description
          <input className="table-input" onChange={(event) => setDescription(event.target.value)} type="text" value={description} />
        </label>
        <label className="check-label">
          <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
          Active
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? <Loader2 className="spin" size={16} /> : null}
            Add Add-on
          </button>
        </div>
      </form>
    </ServicesModalShell>
  );
}

export function AddonsSection({
  onCloseAddModal,
  showAddModal,
}: {
  onCloseAddModal: () => void;
  showAddModal: boolean;
}) {
  const queryClient = useQueryClient();
  const [mutationError, setMutationError] = useState<string | null>(null);
  const addonsQuery = useQuery({
    queryKey: ["admin-addons"],
    queryFn: getAdminAddons,
  });
  const createMutation = useMutation({
    mutationFn: (payload: { name: string; price: number; description?: string; isActive: boolean }) =>
      createAdminAddon(payload),
    onSuccess: () => {
      onCloseAddModal();
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-addons"] });
    },
    onError: (error) => setMutationError(getApiErrorMessage(error)),
  });
  const deleteMutation = useMutation({
    mutationFn: (addonId: string) => deleteAdminAddon(addonId),
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-addons"] });
    },
    onError: (error) => setMutationError(getApiErrorMessage(error)),
  });

  const handleDeleteAddon = (addon: AdminAddon) => {
    if (window.confirm(`Delete add-on "${addon.name}"?`)) {
      deleteMutation.mutate(addon._id);
    }
  };

  const addons = addonsQuery.data || [];

  return (
    <>
      <div className="data-page-header">
        <div>
          <h1>Add-ons</h1>
          <p>Optional extras customers can add to a booking. Prices are managed here, not in the app.</p>
        </div>
      </div>
      {mutationError ? <p className="form-error">{mutationError}</p> : null}
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Add-on Name</th>
              <th className="numeric-cell">Price</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {addons.map((addon) => (
              <AddonRow
                addon={addon}
                isDeleting={deleteMutation.isPending}
                key={addon._id}
                onDelete={() => handleDeleteAddon(addon)}
              />
            ))}
            {!addons.length && !addonsQuery.isLoading ? (
              <tr>
                <td colSpan={5}>No add-ons yet. Use &ldquo;Add Add-on&rdquo; to create the first one.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {addonsQuery.isLoading ? <EmptyState icon={<BadgePoundSterling size={22} />} text="Loading add-ons..." /> : null}
      </TableShell>
      {showAddModal ? (
        <AddAddonModal
          error={createMutation.error ? getApiErrorMessage(createMutation.error) : null}
          isSaving={createMutation.isPending}
          onCancel={onCloseAddModal}
          onSubmit={(payload) => createMutation.mutate(payload)}
        />
      ) : null}
    </>
  );
}

export function ReportsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const reportsQuery = useQuery({
    queryKey: ["admin-reports", status, type, dateRange.queryKey],
    queryFn: () => getAdminReports(status, type, dateRange.query),
  });
  const updateMutation = useMutation({
    mutationFn: ({ reportId, nextStatus }: { reportId: string; nextStatus: AdminReport["status"] }) =>
      updateAdminReportStatus(reportId, { status: nextStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] }),
  });
  const reports = reportsQuery.data?.items || [];

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Reports</h1>
          <p>Issue reports from customers and providers, viewable and downloadable.</p>
        </div>
        <div className="filter-pills">
          {["all", "open", "reviewing", "resolved", "dismissed"].map((item) => (
            <button className={status === item ? "filter-pill active" : "filter-pill"} key={item} onClick={() => setStatus(item)} type="button">
              {item}
            </button>
          ))}
          {reportTypes.map((item) => (
            <button className={type === item.value ? "filter-pill active" : "filter-pill"} key={item.value} onClick={() => setType(item.value)} type="button">
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="split-grid">
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Reporter</th>
                <th>Type</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report._id}>
                  <td>
                    <strong>#{report._id.slice(-6).toUpperCase()}</strong>
                    <span>{relativeDate(report.createdAt)}</span>
                  </td>
                  <td>{report.reporter?.name || report.reporterRole}</td>
                  <td>{formatReportType(report.type)}</td>
                  <td>
                    <span className={`table-status ${report.status}`}>{report.status}</span>
                  </td>
                  <td>
                    <button className="mini-text-button" onClick={() => setSelected(report)} type="button">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        <aside className="detail-panel">
          {selected ? (
            <>
              <h2>Report #{selected._id.slice(-6).toUpperCase()}</h2>
              <p>{selected.description}</p>
              <ReportPhotoPreview report={selected} />
              <div className="detail-actions">
                <ReportDownloadButton report={selected} />
              </div>
              <div className="row-actions">
                {(["reviewing", "resolved", "dismissed"] as const).map((nextStatus) => (
                  <button
                    className="mini-text-button"
                    key={nextStatus}
                    onClick={() => updateMutation.mutate({ reportId: selected._id, nextStatus })}
                    type="button"
                  >
                    {nextStatus}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={<FileText size={22} />} text="Select a report to view details." />
          )}
        </aside>
      </div>
    </section>
  );
}

function StaffEditPanel({
  staff,
  onClose,
}: {
  staff: AdminUser;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(staff.name || "");
  const [selectedMenus, setSelectedMenus] = useState<string[]>(
    staff.staffPermissions?.menus || []
  );
  const saveMutation = useMutation({
    mutationFn: () =>
      updateStaffAccount(staff._id, {
        name,
        staffPermissions: {
          menus: selectedMenus,
          actions: staff.staffPermissions?.actions || ["booking.status.update"],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
      onClose();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteStaffAccount(staff._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-accounts"] });
      onClose();
    },
  });

  useEffect(() => {
    setName(staff.name || "");
    setSelectedMenus(staff.staffPermissions?.menus || []);
  }, [staff]);

  return (
    <form
      className="staff-form"
      onSubmit={(event) => {
        event.preventDefault();
        saveMutation.mutate();
      }}
    >
      <label>
        Staff name
        <input onChange={(event) => setName(event.target.value)} value={name} />
      </label>
      <label>
        Staff email
        <input disabled value={staff.email || ""} />
      </label>
      <div className="permission-grid">
        {menuOptions.map((menu) => (
          <label className="check-label" key={menu.key}>
            <input
              checked={selectedMenus.includes(menu.key)}
              onChange={(event) =>
                setSelectedMenus((current) =>
                  event.target.checked
                    ? [...current, menu.key]
                    : current.filter((key) => key !== menu.key)
                )
              }
              type="checkbox"
            />
            {menu.label}
          </label>
        ))}
      </div>
      <div className="row-actions">
        <button className="approve-action" disabled={saveMutation.isPending} type="submit">
          <Save size={15} />
          Save Access
        </button>
        <button className="mini-text-button" onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="reject-action"
          disabled={deleteMutation.isPending}
          onClick={() => {
            if (window.confirm(`Delete staff account ${staff.email}?`)) {
              deleteMutation.mutate();
            }
          }}
          type="button"
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </form>
  );
}

export function DataRequestsPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const canReviewDataRequests = user?.role === "admin";
  const dateRange = useDashboardDateRange();
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<AdminDataRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const requestsQuery = useQuery({
    queryKey: ["admin-data-requests", status, dateRange.queryKey],
    queryFn: () => getAdminDataRequests(status, dateRange.query),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      requestId,
      nextStatus,
      note,
    }: {
      requestId: string;
      nextStatus: "approved" | "rejected";
      note?: string;
    }) => updateAdminDataRequest(requestId, { status: nextStatus, adminNote: note }),
    onSuccess: (request) => {
      setSelected(request);
      setAdminNote(request.adminNote || "");
      queryClient.invalidateQueries({ queryKey: ["admin-data-requests"] });
    },
  });
  const requests = requestsQuery.data || [];
  const mutationError = updateMutation.error ? getApiErrorMessage(updateMutation.error) : "";

  useEffect(() => {
    setAdminNote(selected?.adminNote || "");
  }, [selected?._id, selected?.adminNote]);

  const reviewRequest = (nextStatus: "approved" | "rejected") => {
    if (!selected) return;
    updateMutation.mutate({
      requestId: selected._id,
      nextStatus,
      note: adminNote,
    });
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Data Requests</h1>
          <p>Subject access requests from customers and providers, with approval-controlled exports.</p>
        </div>
        <div className="filter-pills">
          {dataRequestFilterOptions.map((item) => (
            <button
              className={status === item.value ? "filter-pill active" : "filter-pill"}
              key={item.value}
              onClick={() => setStatus(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="data-layout">
        <TableShell>
          <table className="admin-table data-request-table">
            <thead>
              <tr>
                <th>Request</th>
                <th>Requester</th>
                <th>Role</th>
                <th>Status</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr className={selected?._id === request._id ? "is-selected" : undefined} key={request._id}>
                  <td className="request-cell">
                    <strong>#{request._id.slice(-6).toUpperCase()}</strong>
                    <span>{relativeDate(request.createdAt)}</span>
                  </td>
                  <td>
                    <AvatarName user={request.user} fallback={request.requesterRole === "provider" ? "Provider" : "Customer"} />
                  </td>
                  <td>{request.requesterRole === "provider" ? "Provider" : "Customer"}</td>
                  <td>
                    <span className={`table-status ${request.status}`}>{statusText[request.status] || request.status}</span>
                  </td>
                  <td>
                    <button
                      aria-pressed={selected?._id === request._id}
                      className="table-action"
                      onClick={() => setSelected(request)}
                      type="button"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {!requests.length ? (
                <tr>
                  <td colSpan={5}>No data requests found.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>

        <aside className="detail-panel data-request-detail-panel">
          {selected ? (
            <>
              <h2>Request #{selected._id.slice(-6).toUpperCase()}</h2>
              <p>
                {selected.user?.name || selected.user?.email || "Deleted account"} requested a copy of their OWVO data {relativeDate(selected.createdAt)}.
              </p>
              <div className="detail-list">
                <span>Status: {statusText[selected.status] || selected.status}</span>
                <span>Role: {selected.requesterRole === "provider" ? "Provider" : "Customer"}</span>
                <span>Reviewed: {selected.reviewedAt ? relativeDate(selected.reviewedAt) : "Not reviewed"}</span>
              </div>
              <DataExportViewer key={selected._id} data={selected.exportData} status={selected.status} />
              <label className="form-field">
                Admin note
                <textarea
                  onChange={(event) => setAdminNote(event.target.value)}
                  placeholder="Optional note for the request record"
                  rows={3}
                  value={adminNote}
                />
              </label>
              {mutationError ? <p className="form-error">{mutationError}</p> : null}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  disabled={!canReviewDataRequests || updateMutation.isPending}
                  onClick={() => reviewRequest("rejected")}
                  type="button"
                >
                  Reject
                </button>
                <button
                  className="primary-button"
                  disabled={!canReviewDataRequests || updateMutation.isPending}
                  onClick={() => reviewRequest("approved")}
                  type="button"
                >
                  {updateMutation.isPending ? <Loader2 className="spin" size={16} /> : null}
                  Approve
                </button>
              </div>
              {!canReviewDataRequests ? <p>Only admins can approve or reject data requests.</p> : null}
            </>
          ) : (
            <p>Select a data request to approve, reject, or inspect its generated export.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
export function StaffManagementPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const [menus, setMenus] = useState<string[]>(["bookings"]);
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [editingStaff, setEditingStaff] = useState<AdminUser | null>(null);
  const staffQuery = useQuery({
    queryKey: ["staff-accounts", dateRange.queryKey],
    queryFn: () => getStaffAccounts(dateRange.query),
  });
  const createMutation = useMutation({
    mutationFn: (formData: FormData) =>
      createStaffAccount({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        staffPermissions: { menus, actions: ["booking.status.update"] },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ staffId, accountStatus }: { staffId: string; accountStatus: "active" | "disabled" }) =>
      updateStaffAccount(staffId, { accountStatus }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (staffId: string) => deleteStaffAccount(staffId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-accounts"] }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(new FormData(event.currentTarget));
    event.currentTarget.reset();
  }

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Staff Management</h1>
          <p>Create staff accounts and choose exactly which dashboard menus they can access.</p>
        </div>
      </div>
      <form className="staff-form" onSubmit={submit}>
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Email
          <input name="email" required type="email" />
        </label>
        <label>
          Password
          <span className="password-input-shell">
            <input name="password" required type={showStaffPassword ? "text" : "password"} />
            <button
              aria-label={showStaffPassword ? "Hide password" : "Show password"}
              onClick={() => setShowStaffPassword((value) => !value)}
              type="button"
            >
              {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>
        <div className="permission-grid">
          {menuOptions.map((menu) => (
            <label className="check-label" key={menu.key}>
              <input
                checked={menus.includes(menu.key)}
                onChange={(event) =>
                  setMenus((current) =>
                    event.target.checked
                      ? [...current, menu.key]
                      : current.filter((key) => key !== menu.key)
                  )
                }
                type="checkbox"
              />
              {menu.label}
            </label>
          ))}
        </div>
        <button className="approve-action" disabled={createMutation.isPending} type="submit">
          <ShieldCheck size={15} />
          Create Staff
        </button>
      </form>
      <TableShell>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Status</th>
              <th>Menus</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {(staffQuery.data || []).map((staff) => (
              <tr key={staff._id}>
                <td>
                  <AvatarName user={staff} fallback="Staff" />
                </td>
                <td>
                  <span className={`table-status ${staff.accountStatus}`}>{staff.accountStatus}</span>
                </td>
                <td>{(staff.staffPermissions?.menus || []).join(", ") || "No menus"}</td>
                <td>
                  <div className="row-actions">
                    <button className="mini-text-button" onClick={() => setEditingStaff(staff)} type="button">
                      Edit
                    </button>
                    <button
                      className="mini-text-button"
                      onClick={() =>
                        updateMutation.mutate({
                          staffId: staff._id,
                          accountStatus: staff.accountStatus === "disabled" ? "active" : "disabled",
                        })
                      }
                      type="button"
                    >
                      {staff.accountStatus === "disabled" ? "Enable" : "Disable"}
                    </button>
                    <button
                      className="mini-text-button"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Delete staff account ${staff.email}?`)) {
                          deleteMutation.mutate(staff._id);
                        }
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableShell>
      {editingStaff ? <StaffEditPanel onClose={() => setEditingStaff(null)} staff={editingStaff} /> : null}
    </section>
  );
}

export function NotificationsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const notificationsQuery = useQuery({
    queryKey: ["admin-notifications", dateRange.queryKey],
    queryFn: () => getAdminNotifications(dateRange.query),
    refetchInterval: 30000,
  });

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    socket.on("admin_activity_log_created", refresh);
    socket.on("admin_booking_created", refresh);
    socket.on("admin_booking_status_updated", refresh);
    socket.on("admin_payout_updated", refresh);
    return () => {
      socket.off("admin_activity_log_created", refresh);
      socket.off("admin_booking_created", refresh);
      socket.off("admin_booking_status_updated", refresh);
      socket.off("admin_payout_updated", refresh);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Notifications</h1>
          <p>Booking, payment, payout, report, and system activity updates.</p>
        </div>
      </div>
      <div className="notification-list">
        {(notificationsQuery.data || []).map((notification: AdminNotification) => (
          <article className={`notification-card ${notification.severity}`} key={notification.id}>
            <Bell size={18} />
            <div>
              <h2>{notification.title}</h2>
              <p>{notification.message}</p>
              <span>{relativeDate(notification.createdAt)}</span>
            </div>
          </article>
        ))}
      </div>
      {notificationsQuery.isLoading ? (
        <EmptyState icon={<Loader2 size={22} />} text="Loading notifications..." />
      ) : null}
      {notificationsQuery.isError ? (
        <EmptyState icon={<Bell size={22} />} text="Notifications could not load. Please refresh after the backend is running with the latest changes." />
      ) : null}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && !notificationsQuery.data?.length ? (
        <EmptyState icon={<Bell size={22} />} text="No notifications for the selected time range." />
      ) : null}
    </section>
  );
}

export function SettingsPageContent() {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const settingsQuery = useQuery({ queryKey: ["dashboard-settings"], queryFn: getDashboardSettings });
  const settings = settingsQuery.data;
  const profileMutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateAdminMe({
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
      }),
    onSuccess: (updatedUser) => {
      const session = hydrateDashboardSession();
      if (session.token) {
        storeDashboardSession({
          accessToken: session.token,
          user: updatedUser,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["dashboard-settings"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      updateDashboardSettings({
        commissionRate: Number(formData.get("commissionRate")) / 100,
        providerVerificationRequired: formData.get("providerVerificationRequired") === "on",
        dailyWashLimitMax: Number(formData.get("dailyWashLimitMax") || 7),
        autoPayoutEnabled: formData.get("autoPayoutEnabled") === "on",
        nextPayoutDay: String(formData.get("nextPayoutDay") || "Friday"),
        supportEmail: String(formData.get("supportEmail") || ""),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard-settings"] }),
  });

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Settings</h1>
          <p>Admin-controlled platform settings connected to the backend.</p>
        </div>
      </div>
      <form
        className="settings-form"
        key={user?.email || "profile"}
        onSubmit={(event) => {
          event.preventDefault();
          profileMutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          Admin name
          <input defaultValue={user?.name || ""} name="name" />
        </label>
        <label>
          Admin email
          <input defaultValue={user?.email || ""} name="email" type="email" />
        </label>
        <button className="approve-action" disabled={profileMutation.isPending} type="submit">
          <Save size={15} />
          Save Admin Profile
        </button>
      </form>
      <form
        className="settings-form"
        key={settings?._id || "platform-settings"}
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          OWVO Commission %
          <input key={settings ? "settings-loaded" : "settings-loading"} defaultValue={settings ? settings.commissionRate * 100 : ""} disabled={!settings} placeholder={settings ? "" : "Loading…"} name="commissionRate" type="number" />
        </label>
        <label>
          Provider daily wash limit
          <input defaultValue={settings?.dailyWashLimitMax || 7} min={1} max={50} name="dailyWashLimitMax" type="number" />
        </label>
        <label>
          Next payout day
          <input defaultValue={settings?.nextPayoutDay || "Friday"} name="nextPayoutDay" />
        </label>
        <label>
          Support email
          <input defaultValue={settings?.supportEmail || "support@owvo.co.uk"} name="supportEmail" type="email" />
        </label>
        <label className="check-label">
          <input defaultChecked={settings?.providerVerificationRequired ?? true} name="providerVerificationRequired" type="checkbox" />
          Require provider verification before going online
        </label>
        <label className="check-label">
          <input defaultChecked={settings?.autoPayoutEnabled ?? false} name="autoPayoutEnabled" type="checkbox" />
          Auto payout enabled
        </label>
        <button className="approve-action" disabled={updateMutation.isPending} type="submit">
          <SlidersHorizontal size={15} />
          Save Settings
        </button>
      </form>
    </section>
  );
}

export function SystemLogsPageContent() {
  const queryClient = useQueryClient();
  const dateRange = useDashboardDateRange();
  const user = useDashboardUser();
  const logsQuery = useQuery({
    queryKey: ["activity-logs", dateRange.queryKey],
    queryFn: () => getActivityLogs(dateRange.query, 200),
  });
  const logs = logsQuery.data || [];

  useEffect(() => {
    const socket = io(SOCKET_URL, getDashboardSocketOptions(user?._id));
    const refresh = () => queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
    socket.on("admin_activity_log_created", refresh);
    return () => {
      socket.off("admin_activity_log_created", refresh);
      socket.disconnect();
    };
  }, [queryClient, user?._id]);

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>System Logs</h1>
          <p>Live audit trail for admin and staff actions.</p>
        </div>
        <ActivityLogDownloadButton logs={logs} rangeLabel={dateRange.label} />
      </div>
      <TableShell>
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
            {logs.map((log: ActivityLog) => {
              const pairs = getLogMetadataPairs(log.metadata);

              return (
                <tr key={log._id}>
                  <td>
                    <div className="log-activity-cell">
                      <strong>{getLogTitle(log.action)}</strong>
                      <span>{pairs.length ? getLogSummary(log) : "No extra details recorded."}</span>
                      {pairs.length ? (
                        <div className="log-chip-row">
                          {pairs.slice(0, 4).map((entry) => (
                            <em key={`${log._id}-${entry.label}`}>
                              {entry.label}: {entry.value}
                            </em>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <strong>{log.actor?.name || log.actorRole || "System"}</strong>
                    <span>{log.actor?.email || log.actorRole || "Audit"}</span>
                  </td>
                  <td>
                    <span className="log-entity-pill">{humanizeLabel(log.entityType)}</span>
                  </td>
                  <td>
                    <strong>{relativeDate(log.createdAt)}</strong>
                    <span>{formatPdfDate(log.createdAt)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {logsQuery.isLoading ? <EmptyState icon={<Loader2 size={22} />} text="Loading system logs..." /> : null}
      </TableShell>
    </section>
  );
}