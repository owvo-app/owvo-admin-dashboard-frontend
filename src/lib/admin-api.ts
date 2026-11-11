import { api } from "@/lib/api";
import type { DashboardUser } from "@/lib/auth-storage";

export type AuthResponse = {
  user: Omit<DashboardUser, "role"> & { role?: string };
  accessToken: string;
  refreshToken?: string;
  role: "admin" | "staff" | "user" | "provider";
  _id: string;
};

export type DashboardOverview = {
  totalRevenue: number;
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalBookings: number;
  weekBookings: number;
  activeWashers: number;
  pendingReports: number;
  pendingPayouts: {
    amount: number;
    count: number;
  };
  platformBalance: number;
  commissionRate: number;
};

export type DashboardRevenuePoint = {
  date: string;
  label?: string;
  revenue: number;
  bookings: number;
};

export type DateRangeQuery = {
  range?: "daily" | "weekly" | "monthly" | "yearly" | "all";
  from?: string;
  to?: string;
};

export type AdminBooking = {
  _id: string;
  status: string;
  finalPrice: number;
  currency?: string;
  bookingDate?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    _id: string;
    name?: string;
    email?: string;
    photo?: { url?: string };
  };
  provider?: {
    _id: string;
    name?: string;
    email?: string;
    photo?: { url?: string };
  };
  service?: {
    _id: string;
    title?: string;
    serviceType?: string;
  };
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export type ProviderVerification = {
  _id: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  serviceArea?: string;
  nationalInsuranceNumber?: string;
  accountStatus?: "active" | "disabled";
  isOnline?: boolean;
  photo?: { url?: string };
  providerAddress?: {
    streetAddress?: string;
    city?: string;
    country?: string;
    postcode?: string;
  };
  identityVerification?: {
    documentType?: string;
    documentNumber?: string;
    status?: "pending" | "approved" | "rejected";
    idFile?: { url?: string };
    passportOrDrivingLicenseFile?: { url?: string };
  };
  bankDetails?: {
    accountHolderName?: string;
    address?: string;
    city?: string;
    postcode?: string;
    dateOfBirth?: string;
    accountNumber?: string;
    sortCode?: string;
  };
  insurance?: {
    document?: { url?: string };
  };
  publicLiabilityInsurance?: {
    document?: { url?: string };
    policyNumber?: string;
    insuranceCompany?: string;
    expiryDate?: string;
    status?: "pending" | "verified" | "rejected";
    rejectionReason?: string;
  };
  drivewayPhoto?: {
    document?: { url?: string };
  };
  entrancePhoto?: {
    document?: { url?: string };
  };
  nationalInsuranceStatus?: "pending" | "verified" | "rejected";
  drivewayEligibility?: {
    isPrivateProperty?: boolean;
    hasPermission?: boolean;
    noRoadPayment?: boolean;
    oneCarSpaceOnly?: boolean;
    notSharedOrCommunal?: boolean;
    isSafeWorkingArea?: boolean;
    isResidentialAreaSuitable?: boolean;
  };
  adminVerification?: {
    status: "not_submitted" | "pending" | "approved" | "rejected";
    rejectionReason?: string;
    notes?: string;
  };
  enforcement?: {
    status?: "clear" | "warned" | "suspended" | "banned";
    reason?: string;
  };
};

export type AdminUser = Omit<DashboardUser, "role"> & {
  role: "user" | "provider" | "admin" | "staff";
  phoneNumber?: string;
  photo?: { public_id?: string; url?: string };
  isOnline?: boolean;
  isBusy?: boolean;
  dailyWashLimit?: number;
  dailyWashLimitMax?: number;
  serviceArea?: string;
  customerRatingAverage?: number;
  customerRatingCount?: number;
  completedJobs?: {
    today: number;
    week: number;
    yearly: number;
    allTime: number;
  };
  recentReviews?: Array<{
    _id: string;
    rating: number;
    review?: string;
    createdAt?: string;
    provider?: AdminUser;
  }>;
  adminVerification?: ProviderVerification["adminVerification"];
  enforcement?: ProviderVerification["enforcement"];
  stripeConnect?: {
    accountId?: string;
    payoutsEnabled?: boolean;
    onboardingComplete?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
};

export type AdminPayment = {
  _id: string;
  userId?: AdminUser;
  providerId?: AdminUser;
  bookingId?: AdminBooking;
  price: number;
  currency?: string;
  paymentStatus?: "complete" | "pending" | "failed";
  status?: "success" | "failed" | "pending";
  paymentMethod?: string;
  transactionId?: string;
  type?: "booking" | "tips" | "donation";
  createdAt?: string;
};

export type EarningsEntry = {
  bookingId: string;
  date: string;
  customer?: AdminUser;
  provider?: AdminUser;
  service?: { title?: string; serviceType?: string };
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netAmount: number;
  currency?: string;
  status: string;
};

export type AdminEarnings = {
  commissionRate: number;
  summary: {
    today: { grossAmount: number; commissionAmount: number; netAmount: number };
    week: { grossAmount: number; commissionAmount: number; netAmount: number };
    month: { grossAmount: number; commissionAmount: number; netAmount: number };
    period?: { grossAmount: number; commissionAmount: number; netAmount: number };
    netProfit?: number;
    pendingNet: number;
    paidOut: number;
  };
  entries: EarningsEntry[];
};

export type AdminPayout = {
  _id: string;
  provider?: AdminUser;
  amount: number;
  currency?: string;
  status: "pending" | "processing" | "paid" | "failed";
  payoutDate?: string;
  paidAt?: string;
  failureReason?: string;
  stripeTransferId?: string;
  stripeDestinationAccountId?: string;
  stripeMode?: "manual" | "stripe_transfer";
  manualAdjustmentReason?: string;
  createdAt?: string;
};

export type StripeBalanceSnapshot = {
  configured: boolean;
  available: number;
  pending: number;
  currency: string;
  liveMode: boolean | null;
  error?: string;
};

export type AdminPayouts = {
  payouts: AdminPayout[];
  providerBalances: Array<{
    provider?: AdminUser | null;
    jobs: number;
    grossAmount: number;
    commissionAmount: number;
    netAmount: number;
    paidOut: number;
    pendingOut: number;
    payableAmount: number;
  }>;
  statusTotals: Record<string, number>;
  manualTotals?: {
    unpaidAmount: number;
    paidAmount: number;
    unpaidProviders: number;
    paidProviders: number;
  };
  commissionRate: number;
  stripe: {
    dashboardUrl?: string;
    accountId?: string;
    payoutsEnabled?: boolean;
    balance?: StripeBalanceSnapshot;
  };
};


export type AdminDataRequest = {
  _id: string;
  requesterRole: "user" | "provider";
  status: "pending" | "approved" | "rejected";
  requestNote?: string;
  adminNote?: string;
  exportData?: Record<string, unknown> | null;
  exportGeneratedAt?: string;
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: AdminUser;
  reviewedBy?: AdminUser;
};
export type AdminReport = {
  _id: string;
  reporter?: AdminUser;
  reporterRole: string;
  reportedUser?: AdminUser;
  booking?: AdminBooking;
  type: "general" | "payment" | "service_quality" | "safety" | "provider_conduct";
  description: string;
  photo?: { public_id?: string; url?: string };
  status: "open" | "reviewing" | "resolved" | "dismissed";
  resolutionNote?: string;
  createdAt?: string;
};

export type AdminService = {
  _id: string;
  provider?: AdminUser | string | null;
  catalogKey?: string;
  serviceType: "basic" | "standard" | "premium";
  title?: string;
  price: number;
  carSize: "small" | "medium" | "high";
  carName: string;
  carModel: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminServicesPricing = {
  catalogServices: AdminService[];
  platformSettings: {
    dailyWashLimitMax: number;
  };
  providerSummaries: Array<{
    provider: AdminUser;
    counts: {
      total: number;
      active: number;
      inactive: number;
    };
    dailyWashLimit: {
      remaining: number;
      max: number;
      customMax: number | null;
      platformMax: number;
      completedToday?: number | null;
    };
  }>;
  providerServices: AdminService[];
};

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: "info" | "success" | "warning" | "danger";
  createdAt?: string;
};

export type ActivityLog = {
  _id: string;
  actor?: AdminUser;
  actorRole?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type PlatformSettings = {
  _id: string;
  commissionRate: number;
  providerVerificationRequired: boolean;
  dailyWashLimitMax: number;
  autoPayoutEnabled: boolean;
  nextPayoutDay: string;
  supportEmail: string;
  stripeDashboardUrl?: string;
  stripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
};

export type AdminCommissionWithdrawal = {
  _id: string;
  amount: number;
  currency?: string;
  status: "requested" | "processing" | "paid" | "failed";
  stripePayoutId?: string;
  stripeAccountId?: string;
  stripeDashboardUrl?: string;
  failureReason?: string;
  requestedBy?: DashboardUser;
  createdAt?: string;
};

export type AdminCommissionWithdrawals = {
  summary: {
    commissionRate: number;
    periodCommission: number;
    periodWithdrawn: number;
    availableCommission: number;
    allCommission: number;
    allWithdrawn: number;
  };
  stripe: {
    dashboardUrl?: string;
    accountId?: string;
    payoutsEnabled?: boolean;
    balance?: StripeBalanceSnapshot;
  };
  withdrawals: AdminCommissionWithdrawal[];
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

function buildQuery(params?: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, value.toString());
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function loginDashboard(email: string, password: string) {
  const response = await api.post<ApiEnvelope<AuthResponse>>("/auth/login", {
    email,
    password,
  });
  return response.data.data;
}

export async function logoutDashboard() {
  const response = await api.post<ApiEnvelope<null>>("/auth/logout");
  return response.data;
}

export async function getAdminMe() {
  const response = await api.get<ApiEnvelope<DashboardUser>>("/admin/me");
  return response.data.data;
}

export async function updateAdminMe(payload: { name?: string; email?: string }) {
  const response = await api.patch<ApiEnvelope<DashboardUser>>("/admin/me", payload);
  return response.data.data;
}

export async function getDashboardOverview(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<DashboardOverview>>(
    `/admin/dashboard/overview${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getDashboardRevenue(range: DateRangeQuery["range"], dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<DashboardRevenuePoint[]>>(
    `/admin/dashboard/revenue${buildQuery({ ...dateRange, range })}`
  );
  return response.data.data;
}

export async function getRecentBookings(limit = 4, dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminBooking[]>>(
    `/admin/dashboard/recent-bookings${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getUpcomingBookings(limit = 3, dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminBooking[]>>(
    `/admin/dashboard/upcoming-bookings${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getAdminBookings(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<PaginatedResponse<AdminBooking>>>(
    `/admin/bookings${query}`
  );
  return response.data.data;
}

export async function updateAdminBookingStatus(bookingId: string, status: string) {
  const response = await api.patch<ApiEnvelope<AdminBooking>>(
    `/admin/bookings/${bookingId}/status`,
    { status }
  );
  return response.data.data;
}

export async function getProviderVerifications(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<ProviderVerification[]>>(
    `/admin/provider-verifications${query}`
  );
  return response.data.data;
}

export async function updateProviderVerification(
  providerId: string,
  payload: {
    status: "pending" | "approved" | "rejected";
    rejectionReason?: string;
    notes?: string;
  }
) {
  const response = await api.patch<ApiEnvelope<ProviderVerification>>(
    `/admin/providers/${providerId}/verification`,
    payload
  );
  return response.data.data;
}

export type VerificationDetailsPayload = {
  nationalInsuranceStatus?: "pending" | "verified" | "rejected";
  insurance?: {
    policyNumber?: string;
    insuranceCompany?: string;
    expiryDate?: string;
    status?: "pending" | "verified" | "rejected";
    rejectionReason?: string;
  };
  driveway?: {
    isPrivateProperty?: boolean;
    hasPermission?: boolean;
    noRoadPayment?: boolean;
    oneCarSpaceOnly?: boolean;
    notSharedOrCommunal?: boolean;
    isSafeWorkingArea?: boolean;
    isResidentialAreaSuitable?: boolean;
  };
};

export async function updateProviderVerificationDetails(
  providerId: string,
  payload: VerificationDetailsPayload
) {
  const response = await api.patch<ApiEnvelope<{
    nationalInsuranceStatus: string;
    publicLiabilityInsurance: ProviderVerification["publicLiabilityInsurance"];
    drivewayEligibility: ProviderVerification["drivewayEligibility"];
  }>>(`/admin/providers/${providerId}/verification-details`, payload);
  return response.data.data;
}

export async function getExpiringInsurance(days = 30) {
  const response = await api.get<
    ApiEnvelope<Array<{ _id: string; name?: string; email?: string; publicLiabilityInsurance?: ProviderVerification["publicLiabilityInsurance"] }>>
  >(`/admin/providers/insurance-expiring?days=${days}`);
  return response.data.data;
}

export async function sendVerificationReminder(providerId: string, message?: string) {
  const response = await api.post<ApiEnvelope<{ _id: string; message: string }>>(
    `/admin/providers/${providerId}/send-verification-reminder`,
    message ? { message } : {}
  );
  return response.data.data;
}

export async function updateProviderEnforcement(
  providerId: string,
  payload: { status: "clear" | "warned" | "suspended" | "banned"; reason?: string }
) {
  const response = await api.patch<ApiEnvelope<ProviderVerification>>(
    `/admin/providers/${providerId}/enforcement`,
    payload
  );
  return response.data.data;
}

export async function getWashers(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/providers${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getCustomers(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/customers${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getAdminPayments(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<AdminPayment[]>>(`/admin/payments${query}`);
  return response.data.data;
}

export async function getAdminEarnings(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminEarnings>>(
    `/admin/earnings${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getAdminPayouts(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminPayouts>>(
    `/admin/payouts${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createAdminPayout(payload: {
  providerId: string;
  amount: number;
  currency?: string;
  payoutDate?: string;
  status?: "pending" | "processing" | "paid" | "failed";
  manualAdjustmentReason?: string;
  stripeDestinationAccountId?: string;
  useStripe?: boolean;
}) {
  const response = await api.post<ApiEnvelope<AdminPayout>>("/admin/payouts", payload);
  return response.data.data;
}

export async function updateAdminPayoutStatus(
  payoutId: string,
  status: "pending" | "processing" | "paid" | "failed"
) {
  const response = await api.patch<ApiEnvelope<AdminPayout>>(`/admin/payouts/${payoutId}/status`, {
    status,
  });
  return response.data.data;
}

export async function getAdminReports(status = "all", type = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({
    ...dateRange,
    status: status === "all" ? undefined : status,
    type: type === "all" ? undefined : type,
  });
  const response = await api.get<ApiEnvelope<PaginatedResponse<AdminReport>>>(
    `/admin/reports${query}`
  );
  return response.data.data;
}

export async function getAdminReportPhotoBlob(reportId: string) {
  const response = await api.get<Blob>(`/admin/reports/${reportId}/photo`, {
    responseType: "blob",
  });
  return response.data;
}

export async function updateAdminReportStatus(
  reportId: string,
  payload: { status: "open" | "reviewing" | "resolved" | "dismissed"; resolutionNote?: string }
) {
  const response = await api.patch<ApiEnvelope<AdminReport>>(
    `/admin/reports/${reportId}/status`,
    payload
  );
  return response.data.data;
}


export async function getAdminDataRequests(status = "all", dateRange?: DateRangeQuery) {
  const query = buildQuery({ ...dateRange, status: status === "all" ? undefined : status });
  const response = await api.get<ApiEnvelope<AdminDataRequest[]>>(
    `/admin/data-requests${query}`
  );
  return response.data.data;
}

export async function updateAdminDataRequest(
  requestId: string,
  payload: { status: "approved" | "rejected"; adminNote?: string }
) {
  const response = await api.patch<ApiEnvelope<AdminDataRequest>>(
    `/admin/data-requests/${requestId}`,
    payload
  );
  return response.data.data;
}
export async function getAdminServicesPricing() {
  const response = await api.get<ApiEnvelope<AdminServicesPricing>>("/admin/services-pricing");
  return response.data.data;
}

export async function updateAdminCatalogService(
  serviceId: string,
  payload: Partial<Pick<AdminService, "title" | "price" | "serviceType" | "carSize" | "carName" | "carModel" | "description" | "isActive">>
) {
  const response = await api.patch<ApiEnvelope<AdminService>>(
    `/admin/services-pricing/catalog/${serviceId}`,
    payload
  );
  return response.data.data;
}

export async function createAdminCatalogService(
  payload: Pick<AdminService, "title" | "serviceType" | "price" | "carSize" | "carName" | "carModel" | "description" | "isActive">
) {
  const response = await api.post<ApiEnvelope<AdminService>>(
    "/admin/services-pricing/catalog",
    payload
  );
  return response.data.data;
}

export async function deleteAdminCatalogService(serviceId: string) {
  const response = await api.delete<ApiEnvelope<null>>(
    `/admin/services-pricing/catalog/${serviceId}`
  );
  return response.data.data;
}

export type AdminAddon = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminAddonPayload = {
  name: string;
  price: number;
  description?: string;
  isActive?: boolean;
};

export async function getAdminAddons() {
  const response = await api.get<ApiEnvelope<AdminAddon[]>>("/admin/addons");
  return response.data.data;
}

export async function createAdminAddon(payload: AdminAddonPayload) {
  const response = await api.post<ApiEnvelope<AdminAddon>>("/admin/addons", payload);
  return response.data.data;
}

export async function updateAdminAddon(addonId: string, payload: Partial<AdminAddonPayload>) {
  const response = await api.patch<ApiEnvelope<AdminAddon>>(
    `/admin/addons/${addonId}`,
    payload
  );
  return response.data.data;
}

export async function deleteAdminAddon(addonId: string) {
  const response = await api.delete<ApiEnvelope<null>>(
    `/admin/addons/${addonId}`
  );
  return response.data.data;
}

export async function updateAdminProviderService(
  providerId: string,
  serviceId: string,
  payload: Pick<AdminService, "isActive">
) {
  const response = await api.patch<ApiEnvelope<AdminService>>(
    `/admin/services-pricing/providers/${providerId}/services/${serviceId}`,
    payload
  );
  return response.data.data;
}
export async function updateProviderDailyWashLimit(
  providerId: string,
  payload: { dailyWashLimitMax: number }
) {
  const response = await api.patch<ApiEnvelope<{ provider: AdminUser; dailyWashLimit: AdminServicesPricing["providerSummaries"][number]["dailyWashLimit"] }>>(
    `/admin/services-pricing/providers/${providerId}/daily-wash-limit`,
    payload
  );
  return response.data.data;
}

export async function getStaffAccounts(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminUser[]>>(
    `/admin/staff${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createStaffAccount(payload: {
  name: string;
  email: string;
  password: string;
  staffPermissions: { menus: string[]; actions: string[] };
}) {
  const response = await api.post<ApiEnvelope<AdminUser>>("/admin/staff", payload);
  return response.data.data;
}

export async function updateStaffAccount(
  staffId: string,
  payload: Partial<Pick<AdminUser, "name" | "accountStatus" | "staffPermissions">>
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(`/admin/staff/${staffId}`, payload);
  return response.data.data;
}

export async function deleteStaffAccount(staffId: string) {
  const response = await api.delete<ApiEnvelope<{ staffId: string }>>(`/admin/staff/${staffId}`);
  return response.data.data;
}

export async function getAdminNotifications(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminNotification[]>>(
    `/admin/notifications${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function getActivityLogs(dateRange?: DateRangeQuery, limit = 200) {
  const response = await api.get<ApiEnvelope<ActivityLog[]>>(
    `/admin/activity-logs${buildQuery({ ...dateRange, limit })}`
  );
  return response.data.data;
}

export async function getDashboardSettings() {
  const response = await api.get<ApiEnvelope<PlatformSettings>>("/admin/settings");
  return response.data.data;
}

export async function updateDashboardSettings(payload: Partial<PlatformSettings>) {
  const response = await api.patch<ApiEnvelope<PlatformSettings>>("/admin/settings", payload);
  return response.data.data;
}

export async function getAdminCommissionWithdrawals(dateRange?: DateRangeQuery) {
  const response = await api.get<ApiEnvelope<AdminCommissionWithdrawals>>(
    `/admin/commission-withdrawals${buildQuery(dateRange)}`
  );
  return response.data.data;
}

export async function createAdminCommissionWithdrawal(payload: {
  amount: number;
  currency?: string;
}) {
  const response = await api.post<ApiEnvelope<AdminCommissionWithdrawal>>(
    "/admin/commission-withdrawals",
    payload
  );
  return response.data.data;
}


// ════════════════════════════════════════════════════════════════════════
// Training Modules (Provider Academy)
// ════════════════════════════════════════════════════════════════════════

export type AdminTrainingModule = {
  _id: string;
  title: string;
  description?: string;
  topics: string[];
  videoUrl: string;
  cloudinaryPublicId?: string;
  durationSeconds?: number | null;
  order: number;
  isMandatory: boolean;
  isActive: boolean;
  trainingVersion?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TrainingCompletionOverviewProvider = {
  provider: { _id: string; name?: string; email?: string };
  lastActivityAt: string;
  completedCount: number;
  totalModules: number;
  completedModuleIds: string[];
  status: "completed" | "in_progress" | "not_started";
};

export type TrainingCompletionOverview = {
  modules: Array<{ _id: string; title: string; trainingVersion?: string }>;
  providers: TrainingCompletionOverviewProvider[];
};

export async function getAdminTrainingModules() {
  const response = await api.get<ApiEnvelope<AdminTrainingModule[]>>(
    "/admin/training-modules"
  );
  return response.data.data;
}

export async function createTrainingModule(params: {
  title: string;
  description?: string;
  topics: string[];
  isMandatory: boolean;
  video: File;
}) {
  const formData = new FormData();
  formData.append("title", params.title);
  if (params.description) formData.append("description", params.description);
  formData.append("topics", JSON.stringify(params.topics));
  formData.append("isMandatory", String(params.isMandatory));
  formData.append("video", params.video);

  const response = await api.post<ApiEnvelope<AdminTrainingModule>>(
    "/admin/training-modules",
    formData
  );
  return response.data.data;
}

export async function updateTrainingModule(
  id: string,
  payload: {
    title?: string;
    description?: string;
    topics?: string[];
    isMandatory?: boolean;
    isActive?: boolean;
    trainingVersion?: string;
  }
) {
  const response = await api.patch<ApiEnvelope<AdminTrainingModule>>(
    `/admin/training-modules/${id}`,
    payload
  );
  return response.data.data;
}

export async function replaceTrainingModuleVideo(id: string, video: File) {
  const formData = new FormData();
  formData.append("video", video);

  const response = await api.patch<ApiEnvelope<AdminTrainingModule>>(
    `/admin/training-modules/${id}/replace-video`,
    formData
  );
  return response.data.data;
}

export async function reorderTrainingModules(orderedIds: string[]) {
  const response = await api.patch<ApiEnvelope<AdminTrainingModule[]>>(
    "/admin/training-modules/reorder",
    { order: orderedIds }
  );
  return response.data.data;
}

export async function deactivateTrainingModule(id: string) {
  const response = await api.delete<ApiEnvelope<AdminTrainingModule>>(
    `/admin/training-modules/${id}`
  );
  return response.data.data;
}

export async function getTrainingCompletionOverview() {
  const response = await api.get<ApiEnvelope<TrainingCompletionOverview>>(
    "/admin/training-modules/completion-overview"
  );
  return response.data.data;
}

export async function resetProviderTraining(providerId: string) {
  const response = await api.patch<ApiEnvelope<{ trainingResetAt: string }>>(
    `/admin/providers/${providerId}/training/reset`
  );
  return response.data.data;
}

export type AdminBookingDetail = AdminBooking & {
  addons?: { title?: string; price?: number }[];
  addonsTotal?: number;
  price?: number;
  discountPrice?: number;
  coupon?: { code?: string };
  payment?: { status?: string; stripePaymentIntentId?: string; paidAt?: string };
  vehicle?: { registrationNo?: string; make?: string; model?: string; year?: number; size?: string };
  vehicleSnapshot?: { registrationNo?: string; make?: string; model?: string };
  arrivedAt?: string; completedAt?: string; cancelledAt?: string;
  cancellationReason?: string; cancelledBy?: string;
  user?: AdminBooking["user"] & { phoneNumber?: string };
  provider?: AdminBooking["provider"] & { phoneNumber?: string };
  service?: AdminBooking["service"] & { price?: number };
};

export async function createAdminBooking(data: {
  customerId: string;
  providerId: string;
  serviceId: string;
  bookingDate: string;
  address: string;
  notes?: string;
}) {
  const response = await api.post<ApiEnvelope<any>>("/admin/bookings", data);
  return response.data.data;
}

export async function getAdminBookingById(bookingId: string) {
  const response = await api.get<ApiEnvelope<AdminBookingDetail>>(
    `/admin/bookings/${bookingId}`
  );
  return response.data.data;
}


// ─── Support Tickets ───
export type SupportTicket = {
  _id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  type: "complaint" | "refund" | "dispute" | "technical" | "cancellation" | "payment";
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved" | "closed";
  reporter?: { _id: string; name?: string; email?: string; phoneNumber?: string; role?: string };
  reporterRole?: string;
  booking?: { _id: string; bookingDate?: string; status?: string; finalPrice?: number };
  reportedUser?: { _id: string; name?: string; role?: string };
  assignedTo?: { _id: string; name?: string; email?: string };
  adminNotes?: string;
  resolutionNote?: string;
  resolvedAt?: string;
  messages?: { sender?: { name?: string; role?: string }; senderRole?: string; text?: string; createdAt?: string }[];
  createdAt?: string;
  updatedAt?: string;
};

export type AdminTicketsResponse = {
  items: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  statusCounts: { open: number; in_progress: number; resolved: number; closed: number; total: number };
};

export async function getAdminTickets(params?: { status?: string; type?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.type && params.type !== "all") query.set("type", params.type);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";
  const response = await api.get<ApiEnvelope<AdminTicketsResponse>>(`/admin/tickets${qs}`);
  return response.data.data;
}

export async function getAdminTicketById(ticketId: string) {
  const response = await api.get<ApiEnvelope<SupportTicket>>(`/admin/tickets/${ticketId}`);
  return response.data.data;
}

export async function updateAdminTicket(ticketId: string, data: {
  status?: string; priority?: string; assignedTo?: string | null; adminNotes?: string; resolutionNote?: string;
}) {
  const response = await api.patch<ApiEnvelope<SupportTicket>>(`/admin/tickets/${ticketId}`, data);
  return response.data.data;
}

export async function adminReplyToTicket(ticketId: string, text: string) {
  const response = await api.post<ApiEnvelope<SupportTicket>>(`/admin/tickets/${ticketId}/messages`, { text });
  return response.data.data;
}



// ─── Opportunities ───
export type Opportunity = {
  _id: string;
  name: string;
  description?: string;
  type: "daily" | "weekly" | "custom" | "location" | "service" | "milestone" | "referral";
  target: number;
  targetUnit?: string;
  rewardAmount: number;
  location?: string;
  audience?: string;
  startDate: string;
  endDate: string;
  status: "active" | "scheduled" | "paused" | "ended";
  participants?: number;
  createdAt?: string;
};

export type OpportunitiesResponse = {
  items: Opportunity[];
  stats: { activeCampaigns: number; totalParticipants: number; rewardsEarned: number };
  statusBreakdown: { all: number; active: number; scheduled: number; paused: number; ended: number };
};

export async function getAdminOpportunities(params?: { status?: string; type?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.type && params.type !== "all") query.set("type", params.type);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";
  const response = await api.get<ApiEnvelope<OpportunitiesResponse>>(`/admin/opportunities${qs}`);
  return response.data.data;
}

export async function createOpportunity(data: {
  name: string; description?: string; type: string; target: number;
  rewardAmount: number; audience?: string; startDate: string; endDate: string;
}) {
  const response = await api.post<ApiEnvelope<Opportunity>>("/admin/opportunities", data);
  return response.data.data;
}

export async function updateOpportunity(id: string, data: Partial<Opportunity>) {
  const response = await api.patch<ApiEnvelope<Opportunity>>(`/admin/opportunities/${id}`, data);
  return response.data.data;
}

export async function deleteOpportunity(id: string) {
  const response = await api.delete<ApiEnvelope<any>>(`/admin/opportunities/${id}`);
  return response.data.data;
}

export async function getBonusPayouts() {
  const response = await api.get<ApiEnvelope<any[]>>(`/admin/opportunities/payouts`);
  return response.data.data;
}

export async function approvePayout(payoutId: string) {
  const response = await api.patch<ApiEnvelope<any>>(`/admin/opportunities/payouts/${payoutId}`, {});
  return response.data.data;
}

export async function getOpportunityProgress(opportunityId?: string) {
  const qs = opportunityId ? `?opportunityId=${opportunityId}` : "";
  const response = await api.get<ApiEnvelope<any[]>>(`/admin/opportunities/progress${qs}`);
  return response.data.data;
}


// ─── Providers Step 3: account status + soft delete ─────────────────────────
export async function updateUserAccountStatus(
  userId: string,
  accountStatus: "active" | "disabled"
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(
    `/admin/users/${userId}/status`,
    { accountStatus }
  );
  return response.data.data;
}

export async function deleteAdminProvider(providerId: string) {
  const response = await api.delete<ApiEnvelope<{ _id: string }>>(
    `/admin/providers/${providerId}`
  );
  return response.data.data;
}


export interface AdminProviderDetail {
  provider: AdminUser & {
    residentialAddress?: string;
    providerAddress?: {
      streetAddress?: string;
      city?: string;
      country?: string;
      postcode?: string;
    };
    serviceLocationAddress?: {
      streetAddress?: string;
      city?: string;
      postcode?: string;
      sameAsHomeAddress?: boolean;
    };
    location?: { type?: string; coordinates?: number[] };
    identityVerification?: {
      documentType?: string;
      status?: string;
      idFile?: { url?: string };
      passportOrDrivingLicenseFile?: { url?: string };
    };
    insurance?: { document?: { url?: string } };
    publicLiabilityInsurance?: { document?: { url?: string } };
    isBankCompleted?: boolean;
    bankDetails?: { accountNumber?: string };
  };
  services: Array<{
    _id: string;
    title: string;
    price: number;
    isActive: boolean;
    serviceType?: string;
    carSize?: string;
  }>;
  stats: {
    totalJobs: number;
    ratingAverage: number;
    ratingCount: number;
    completionRate: number | null;
    counts: {
      completed: number;
      cancelled: number;
      cancelledByProvider: number;
      declined: number;
      active: number;
    };
  };
  earnings: {
    totalGross: number;
    totalEarnings: number;
    todayNet: number;
    weekNet: number;
    tipsTotal: number;
    paidOut: number;
    pendingPayouts: number;
    walletBalance: number;
    commissionRate: number;
  };
  recentBookings: Array<{
    _id: string;
    status: string;
    bookingDate?: string;
    finalPrice?: number;
    price?: number;
    paymentStatus?: string | null;
    serviceTitle: string;
    customerName: string;
    customerPhoto?: string;
    createdAt?: string;
  }>;
  recentActivity: Array<{
    type: string;
    title: string;
    ref?: string;
    amount?: number | null;
    stars?: number | null;
    createdAt?: string;
  }>;
}

export async function getAdminProviderDetail(providerId: string) {
  const response = await api.get<ApiEnvelope<AdminProviderDetail>>(
    `/admin/providers/${providerId}`
  );
  return response.data.data;
}

export interface ProviderNoteItem {
  _id: string;
  text: string;
  authorName: string;
  authorRole?: string;
  createdAt: string;
}

export async function getProviderNotes(providerId: string) {
  const response = await api.get<ApiEnvelope<ProviderNoteItem[]>>(
    `/admin/providers/${providerId}/notes`
  );
  return response.data.data;
}

export async function addProviderNote(providerId: string, text: string) {
  const response = await api.post<ApiEnvelope<ProviderNoteItem>>(
    `/admin/providers/${providerId}/notes`,
    { text }
  );
  return response.data.data;
}

export async function deleteProviderNote(providerId: string, noteId: string) {
  const response = await api.delete<ApiEnvelope<{ _id: string }>>(
    `/admin/providers/${providerId}/notes/${noteId}`
  );
  return response.data.data;
}

export async function sendProviderMessage(
  providerId: string,
  payload: { title?: string; message: string }
) {
  const response = await api.post<ApiEnvelope<{ providerId: string }>>(
    `/admin/providers/${providerId}/message`,
    payload
  );
  return response.data.data;
}

export async function createAdminProvider(payload: {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  serviceArea?: string;
}) {
  const response = await api.post<ApiEnvelope<AdminUser>>(
    "/admin/providers",
    payload
  );
  return response.data.data;
}

export async function updateAdminProviderProfile(
  providerId: string,
  payload: {
    name?: string;
    phoneNumber?: string;
    serviceArea?: string;
    providerAddress?: {
      streetAddress?: string;
      city?: string;
      country?: string;
      postcode?: string;
    };
  }
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(
    `/admin/providers/${providerId}/profile`,
    payload
  );
  return response.data.data;
}


// ─── Customers redesign: detail, notes, message, add/edit, actions ─────────
export interface AdminCustomerDetailBooking {
  _id: string;
  ref: string;
  status: string;
  bookingDate?: string;
  finalPrice?: number;
  price?: number;
  paymentStatus?: string | null;
  serviceTitle: string;
  providerName: string;
  providerPhoto?: string;
  vehicle: {
    registrationNo?: string;
    make?: string;
    model?: string;
    image?: string;
  };
  address?: string;
  createdAt?: string;
}

export interface AdminCustomerDetail {
  customer: AdminUser & {
    accountStatus?: string;
    residentialAddress?: string;
    dateOfBirth?: string;
    location?: { type?: string; coordinates?: number[] };
    verificationInfo?: { verified?: boolean };
  };
  stats: {
    totalBookings: number;
    counts: {
      completed: number;
      cancelled: number;
      declined: number;
      active: number;
    };
    totalSpent: number;
    tipsGiven: number;
    ratingReceived: { average: number; count: number };
    ratingGiven: { average: number; count: number };
  };
  bookings: AdminCustomerDetailBooking[];
  vehicles: Array<{
    _id: string;
    registrationNo?: string;
    make?: string;
    model?: string;
    year?: number | null;
    size?: string;
    colour?: string;
    image?: string;
    isDefault?: boolean;
  }>;
  payments: Array<{
    _id: string;
    ref: string;
    type?: string;
    amount: number;
    currency?: string;
    status?: string;
    method?: string;
    transactionId?: string;
    createdAt?: string;
  }>;
  reviewsReceived: Array<{
    _id: string;
    rating: number;
    review?: string;
    providerName: string;
    providerPhoto?: string;
    bookingRef?: string;
    createdAt?: string;
  }>;
  reviewsGiven: Array<{
    _id: string;
    rating: number;
    review?: string;
    providerName: string;
    providerPhoto?: string;
    serviceTitle?: string;
    bookingRef?: string;
    createdAt?: string;
  }>;
}

export async function getAdminCustomerDetail(customerId: string) {
  const response = await api.get<ApiEnvelope<AdminCustomerDetail>>(
    `/admin/customers/${customerId}`
  );
  return response.data.data;
}

export async function createAdminCustomer(payload: {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  residentialAddress?: string;
  dateOfBirth?: string;
}) {
  const response = await api.post<ApiEnvelope<AdminUser>>(
    "/admin/customers",
    payload
  );
  return response.data.data;
}

export async function updateAdminCustomerProfile(
  customerId: string,
  payload: {
    name?: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    residentialAddress?: string;
  }
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(
    `/admin/customers/${customerId}/profile`,
    payload
  );
  return response.data.data;
}

export async function updateCustomerEnforcement(
  customerId: string,
  payload: { status: string; reason?: string }
) {
  const response = await api.patch<ApiEnvelope<AdminUser>>(
    `/admin/customers/${customerId}/enforcement`,
    payload
  );
  return response.data.data;
}

export async function deleteAdminCustomer(customerId: string) {
  const response = await api.delete<ApiEnvelope<{ _id: string }>>(
    `/admin/customers/${customerId}`
  );
  return response.data.data;
}

export interface CustomerNoteItem {
  _id: string;
  text: string;
  authorName: string;
  authorRole?: string;
  createdAt: string;
}

export async function getCustomerNotes(customerId: string) {
  const response = await api.get<ApiEnvelope<CustomerNoteItem[]>>(
    `/admin/customers/${customerId}/notes`
  );
  return response.data.data;
}

export async function addCustomerNote(customerId: string, text: string) {
  const response = await api.post<ApiEnvelope<CustomerNoteItem>>(
    `/admin/customers/${customerId}/notes`,
    { text }
  );
  return response.data.data;
}

export async function deleteCustomerNote(customerId: string, noteId: string) {
  const response = await api.delete<ApiEnvelope<{ _id: string }>>(
    `/admin/customers/${customerId}/notes/${noteId}`
  );
  return response.data.data;
}

export async function sendCustomerMessage(
  customerId: string,
  payload: { title?: string; message: string }
) {
  const response = await api.post<ApiEnvelope<{ customerId: string }>>(
    `/admin/customers/${customerId}/message`,
    payload
  );
  return response.data.data;
}

export async function sendCustomerResetPassword(customerId: string) {
  const response = await api.post<ApiEnvelope<{ customerId: string }>>(
    `/admin/customers/${customerId}/reset-password`
  );
  return response.data.data;
}

// ─── Customers fix: detail response me map location (live / saved / booking)
export interface AdminCustomerMapLocation {
  lat: number;
  lng: number;
  source: "live" | "profile" | "booking";
  updatedAt?: string | null;
}

export interface AdminCustomerDetail {
  latestBookingAddress?: string;
  mapLocation?: AdminCustomerMapLocation | null;
}

// ─── Bookings redesign (v2) ───
// Naye types/functions puranay walon ke sath rehte hain; Bookings page aur
// detail panel sirf ye v2 wale use karte hain.

export type AdminBookingV2 = AdminBooking & {
  postalCode?: string;
  address?: {
    addressLine?: string;
    latitude?: number;
    longitude?: number;
  };
  payment?: { method?: string; status?: string; trxId?: string };
  refund?: {
    status?: string;
    amount?: number;
    refundId?: string;
    reason?: string;
    at?: string;
  } | null;
  vehicleSnapshot?: {
    registrationNo?: string;
    make?: string;
    model?: string;
    year?: number | null;
    size?: string;
    image?: string;
  };
  addons?: Array<{ name?: string; price?: number }>;
  addonsTotal?: number;
  price?: number;
  discountPrice?: number;
  couponCode?: string;
  providerRating?: { average: number; count: number };
  hasOpenDispute?: boolean;
  user?: AdminBooking["user"] & { phoneNumber?: string };
  provider?: AdminBooking["provider"] & {
    phoneNumber?: string;
    isOnline?: boolean;
  };
};

export type AdminBookingsListParams = {
  status?: string;
  from?: string;
  to?: string;
  range?: string;
  search?: string;
  serviceId?: string;
  paymentStatus?: string;
  location?: string;
  disputed?: boolean;
  day?: string;
  bookingType?: string;
  upcoming?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
};

export type AdminBookingsListResult = {
  items: AdminBookingV2[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary?: {
    total: number;
    byStatus: Record<string, number>;
    newThisMonth: number;
  };
  locations?: Array<{ value: string; label: string }>;
};

export async function getAdminBookingsV2(params: AdminBookingsListParams) {
  const query = buildQuery({
    status: params.status && params.status !== "all" ? params.status : undefined,
    from: params.from,
    to: params.to,
    range: params.range,
    search: params.search?.trim() || undefined,
    serviceId: params.serviceId,
    paymentStatus: params.paymentStatus,
    location: params.location,
    disputed: params.disputed ? "1" : undefined,
    day: params.day,
    bookingType: params.bookingType,
    upcoming: params.upcoming ? "1" : undefined,
    sort: params.sort,
    page: params.page,
    limit: params.limit,
  });
  const response = await api.get<ApiEnvelope<AdminBookingsListResult>>(
    `/admin/bookings${query}`
  );
  return response.data.data;
}

export type AdminBookingPaymentRecord = {
  _id: string;
  type?: string;
  price?: number;
  paymentStatus?: string;
  status?: string;
  paymentMethod?: string;
  transactionId?: string;
  createdAt?: string;
};

export type AdminBookingTimelineEntry = {
  status: string;
  at?: string | null;
  by?: string;
  note?: string;
  source?: string;
};

export type AdminBookingV2Detail = Omit<AdminBookingV2, "providerRating"> & {
  notes?: string;
  estimatedArrival?: string | null;
  customerLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    updatedAt?: string | null;
  } | null;
  customerEtaMinutes?: number | null;
  customerDistanceMiles?: number | null;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  coupon?: { code?: string } | string;
  payments?: AdminBookingPaymentRecord[];
  tipsTotal?: number;
  providerRating?: {
    rating: number;
    review?: string;
    at?: string;
  } | null;
  customerRating?: {
    rating: number;
    review?: string;
    at?: string;
  } | null;
  providerStats?: {
    ratingAverage: number;
    ratingCount: number;
    completedJobs: number;
  };
  openDispute?: {
    _id: string;
    ticketNumber?: string;
    status?: string;
    priority?: string;
    createdAt?: string;
  } | null;
  timeline?: AdminBookingTimelineEntry[];
};

export async function getAdminBookingByIdV2(bookingId: string) {
  const response = await api.get<ApiEnvelope<AdminBookingV2Detail>>(
    `/admin/bookings/${bookingId}`
  );
  return response.data.data;
}

export type AdminBookingStatusPayload = {
  status: string;
  reason?: string;
  notes?: string;
  notifyCustomer?: boolean;
  notifyProvider?: boolean;
  providerId?: string;
  estimatedArrival?: string;
};

export async function updateAdminBookingStatusV2(
  bookingId: string,
  payload: AdminBookingStatusPayload
) {
  const response = await api.patch<ApiEnvelope<AdminBookingV2>>(
    `/admin/bookings/${bookingId}/status`,
    payload
  );
  return response.data.data;
}

export async function exportAdminBookingsCsv(
  params: AdminBookingsListParams & { ids?: string[] }
) {
  const query = buildQuery({
    status: params.status && params.status !== "all" ? params.status : undefined,
    from: params.from,
    to: params.to,
    range: params.range,
    search: params.search?.trim() || undefined,
    serviceId: params.serviceId,
    paymentStatus: params.paymentStatus,
    location: params.location,
    disputed: params.disputed ? "1" : undefined,
    day: params.day,
    bookingType: params.bookingType,
    upcoming: params.upcoming ? "1" : undefined,
    ids: params.ids && params.ids.length ? params.ids.join(",") : undefined,
  });
  const response = await api.get(`/admin/bookings/export${query}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

// ─── Booking chat (admin) ───
export type AdminChatMessage = {
  _id: string;
  text: string;
  attachment?: {
    url?: string;
    type?: string;
    name?: string;
    mimeType?: string;
    size?: number;
  } | null;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  isAdmin?: boolean;
  createdAt?: string;
};

export async function getAdminBookingMessages(bookingId: string) {
  const response = await api.get<ApiEnvelope<AdminChatMessage[]>>(
    `/admin/bookings/${bookingId}/messages`
  );
  return response.data.data;
}

export async function sendAdminBookingMessage(bookingId: string, text: string) {
  const response = await api.post<ApiEnvelope<AdminChatMessage>>(
    `/admin/bookings/${bookingId}/messages`,
    { text }
  );
  return response.data.data;
}

// ─── Booking notes (admin) ───
export type AdminBookingNoteItem = {
  _id: string;
  text: string;
  authorName?: string;
  createdAt?: string;
};

export async function getAdminBookingNotes(bookingId: string) {
  const response = await api.get<ApiEnvelope<AdminBookingNoteItem[]>>(
    `/admin/bookings/${bookingId}/notes`
  );
  return response.data.data;
}

export async function addAdminBookingNote(bookingId: string, text: string) {
  const response = await api.post<ApiEnvelope<AdminBookingNoteItem>>(
    `/admin/bookings/${bookingId}/notes`,
    { text }
  );
  return response.data.data;
}

export async function deleteAdminBookingNote(bookingId: string, noteId: string) {
  const response = await api.delete<ApiEnvelope<{ _id: string }>>(
    `/admin/bookings/${bookingId}/notes/${noteId}`
  );
  return response.data.data;
}

// ─── Booking dispute ───
export type AdminBookingDispute = {
  _id: string;
  ticketNumber?: string;
  subject?: string;
  description?: string;
  priority?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getAdminBookingDispute(bookingId: string) {
  const response = await api.get<
    ApiEnvelope<{ dispute: AdminBookingDispute | null }>
  >(`/admin/bookings/${bookingId}/dispute`);
  return response.data.data;
}

export async function createAdminBookingDispute(
  bookingId: string,
  payload: { subject?: string; description: string; priority?: string }
) {
  const response = await api.post<
    ApiEnvelope<{ dispute: AdminBookingDispute | null }>
  >(`/admin/bookings/${bookingId}/dispute`, payload);
  return response.data.data;
}

export async function sendAdminBookingNotification(
  bookingId: string,
  payload: { message: string; notifyCustomer?: boolean; notifyProvider?: boolean }
) {
  const response = await api.post<ApiEnvelope<{ notified: string[] }>>(
    `/admin/bookings/${bookingId}/notify`,
    payload
  );
  return response.data.data;
}

// ─── Booking refund + create v2 ───
export async function refundAdminBooking(bookingId: string, reason?: string) {
  const response = await api.post<
    ApiEnvelope<{ booking: AdminBookingV2; refund: AdminBookingV2["refund"] }>
  >(`/admin/bookings/${bookingId}/refund`, { reason: reason || "" });
  return response.data.data;
}

export async function createAdminBookingV2(data: {
  customerId: string;
  providerId: string;
  serviceId: string;
  vehicleId?: string;
  addonIds?: string[];
  bookingDate: string;
  address: { addressLine: string; latitude: number; longitude: number };
  notes?: string;
}) {
  const response = await api.post<ApiEnvelope<AdminBookingV2>>(
    "/admin/bookings",
    data
  );
  return response.data.data;
}

// ─── Payments & Refunds (unified) ───
// Unified transactions list, refund queue, payout actions,
// transaction notes aur reconciliation. Purane getAdminPayments /
// getAdminPayouts / getAdminEarnings waisay hi rehte hain.

export interface AdminTransactionRow {
  id: string;
  sourceType: "payment" | "payout" | "refund";
  txnNumber: string;
  kind: string;
  direction: "in" | "out";
  amount: number;
  currency: string;
  status: string;
  rawStatus?: string;
  method: string;
  customer: { id: string; name: string; email: string } | null;
  provider: { id: string; name: string; email: string } | null;
  bookingId: string | null;
  failureReason?: string;
  createdAt: string;
}

export interface AdminTransactionsResult {
  transactions: AdminTransactionRow[];
  counts: { all: number; payment: number; payout: number; refund: number; failed: number };
  summary: {
    totalPayments: number;
    pendingPayouts: number;
    refundRequestsAmount: number;
    refundRequestsCount: number;
    failedAmount: number;
  };
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function getAdminTransactions(
  params: DateRangeQuery & {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
) {
  const query = buildQuery({
    ...params,
    type: params.type === "all" ? undefined : params.type,
    status: params.status || undefined,
    search: params.search || undefined,
  });
  const response = await api.get<ApiEnvelope<AdminTransactionsResult>>(
    `/admin/transactions${query}`
  );
  return response.data.data;
}

export interface AdminTransactionNote {
  _id: string;
  sourceType: string;
  sourceId: string;
  text: string;
  visibility: "internal" | "customer";
  author?: { _id: string; name?: string; email?: string };
  createdAt: string;
}

export interface AdminTransactionDetail {
  record: Record<string, unknown>;
  booking: Record<string, unknown> | null;
  bookings?: Record<string, unknown>[];
  payment: Record<string, unknown> | null;
  notes: AdminTransactionNote[];
}

export async function getAdminTransactionDetail(
  sourceType: "payment" | "payout" | "refund",
  id: string
) {
  const response = await api.get<ApiEnvelope<AdminTransactionDetail>>(
    `/admin/transactions/${sourceType}/${id}`
  );
  return response.data.data;
}

export async function createAdminTransactionNote(payload: {
  sourceType: "payment" | "payout" | "refund";
  sourceId: string;
  text: string;
  visibility: "internal" | "customer";
}) {
  const response = await api.post<ApiEnvelope<AdminTransactionNote>>(
    `/admin/transactions/notes`,
    payload
  );
  return response.data.data;
}

export async function issueAdminRefund(
  bookingId: string,
  payload: { amount?: number; reason?: string; reasonCategory?: string }
) {
  const response = await api.post<ApiEnvelope<Record<string, unknown>>>(
    `/admin/bookings/${bookingId}/refund`,
    payload
  );
  return response.data.data;
}

export interface AdminRefund {
  _id: string;
  txnNumber?: string;
  booking?: string | { _id: string; finalPrice?: number };
  customer?: { _id: string; name?: string; email?: string };
  provider?: { _id: string; name?: string; email?: string };
  amount: number;
  walletPortion: number;
  cardPortion: number;
  status: string;
  source: string;
  reason?: string;
  reasonCategory?: string;
  createdAt: string;
  refundedAt?: string;
}

export interface AdminRefundsResult {
  refunds: AdminRefund[];
  counts: Record<string, { count: number; amount: number }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function getAdminRefunds(
  params: DateRangeQuery & { status?: string; search?: string; page?: number; limit?: number }
) {
  const query = buildQuery({
    ...params,
    status: params.status || undefined,
    search: params.search || undefined,
  });
  const response = await api.get<ApiEnvelope<AdminRefundsResult>>(`/admin/refunds${query}`);
  return response.data.data;
}

export async function decideAdminRefund(
  refundId: string,
  payload: { decision: "approve" | "reject" | "more_info"; amount?: number; note?: string }
) {
  const response = await api.post<ApiEnvelope<AdminRefund>>(
    `/admin/refunds/${refundId}/decide`,
    payload
  );
  return response.data.data;
}

export async function processAdminRefund(refundId: string) {
  const response = await api.post<ApiEnvelope<AdminRefund>>(
    `/admin/refunds/${refundId}/process`
  );
  return response.data.data;
}

export async function updateAdminPayoutStatusV2(
  payoutId: string,
  payload: { status: "pending" | "processing" | "paid" | "failed"; failureReason?: string }
) {
  const response = await api.patch<ApiEnvelope<AdminPayout>>(
    `/admin/payouts/${payoutId}/status`,
    payload
  );
  return response.data.data;
}

export async function retryAdminPayout(payoutId: string) {
  const response = await api.post<ApiEnvelope<AdminPayout>>(
    `/admin/payouts/${payoutId}/retry`
  );
  return response.data.data;
}

export async function payAdminPayoutManually(
  payoutId: string,
  payload: { reference?: string; note?: string }
) {
  const response = await api.post<ApiEnvelope<AdminPayout>>(
    `/admin/payouts/${payoutId}/pay-manually`,
    payload
  );
  return response.data.data;
}

export interface AdminReconciliation {
  issues: {
    stripeRefundsNotRecorded: {
      stripeRefundId: string;
      amount: number;
      paymentIntentId: string;
      bookingId: string | null;
      at: string;
    }[];
    stuckPayouts: { _id: string; txnNumber?: string; amount?: number }[];
    paidPaymentsBookingNotPaid: { _id: string; transactionId?: string; price?: number }[];
    stuckRefunds: { _id: string; txnNumber?: string; amount?: number }[];
  };
  counts: {
    stripeRefundsNotRecorded: number;
    stuckPayouts: number;
    paidPaymentsBookingNotPaid: number;
    stuckRefunds: number;
    total: number;
  };
  stripeBalance: {
    available: { currency: string; amount: number }[];
    pending: { currency: string; amount: number }[];
  } | null;
  stripeError?: string;
  checkedAt: string;
}

export async function getAdminReconciliation() {
  const response = await api.get<ApiEnvelope<AdminReconciliation>>(`/admin/reconciliation`);
  return response.data.data;
}


// ─── Earnings v2 ───
// Snapshot-based kamai: cards, trend series, per-provider rollup,
// booking entries (status ke sath), manual adjustments, earning
// holds aur CSV export. Purana getAdminEarnings bhi maujood hai.

export type AdminEarningEntry = {
  bookingId: string;
  displayId: string;
  date?: string;
  customer?: { _id: string; name?: string; email?: string } | null;
  provider?: { _id: string; name?: string; email?: string } | null;
  service?: { _id: string; title?: string; serviceType?: string } | null;
  grossAmount: number;
  commissionRate?: number | null;
  hasSnapshot: boolean;
  commissionAmount: number;
  netAmount: number;
  tip: number;
  reversalAmount: number;
  totalToProvider: number;
  currency?: string;
  status: "Available" | "Paid Out" | "Processing" | "On Hold" | "Refunded";
  hold?: {
    source: "manual" | "dispute";
    amount?: number;
    reason?: string;
    at?: string;
  } | null;
};

export type AdminEarningsV2 = {
  commissionRate: number;
  summary: {
    range: {
      gross: number;
      commission: number;
      providerNet: number;
      tips: number;
      jobs: number;
      refunds: number;
      refundsCount: number;
      paidOut: number;
      effectiveRate: number;
    };
    pendingPayouts: number;
    paidOut: number;
    netProfit: number;
  };
  series: {
    key: string;
    label: string;
    gross: number;
    commission: number;
    refunds: number;
  }[];
  providers: {
    provider: { _id: string; name?: string; email?: string };
    jobs: number;
    gross: number;
    commission: number;
    net: number;
    tips: number;
    paidOut: number;
    heldAmount: number;
    manualAdjustments: number;
    available: number;
  }[];
  entries: AdminEarningEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export type AdminEarningsV2Params = DateRangeQuery & {
  search?: string;
  providerId?: string;
  page?: number;
  limit?: number;
  granularity?: "daily" | "weekly" | "monthly";
};

export async function getAdminEarningsV2(params: AdminEarningsV2Params = {}) {
  const query = buildQuery({
    from: params.from,
    to: params.to,
    range: params.range,
    search: params.search?.trim() || undefined,
    providerId: params.providerId || undefined,
    page: params.page,
    limit: params.limit,
    granularity: params.granularity,
  });
  const response = await api.get<ApiEnvelope<AdminEarningsV2>>(
    `/admin/earnings${query}`
  );
  return response.data.data;
}

export async function exportAdminEarningsCsv(
  params: AdminEarningsV2Params = {}
) {
  const query = buildQuery({
    from: params.from,
    to: params.to,
    range: params.range,
    search: params.search?.trim() || undefined,
    providerId: params.providerId || undefined,
  });
  const response = await api.get(`/admin/earnings/export${query}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export type EarningAdjustmentRow = {
  _id: string;
  provider: { _id: string; name?: string; email?: string };
  booking?: { _id: string } | null;
  type: "bonus" | "deduction";
  amount: number;
  reason: string;
  createdBy?: { _id: string; name?: string; email?: string };
  createdAt?: string;
};

export async function getEarningAdjustments(
  params: { providerId?: string; search?: string } = {}
) {
  const query = buildQuery({
    providerId: params.providerId || undefined,
    search: params.search?.trim() || undefined,
  });
  const response = await api.get<
    ApiEnvelope<{ adjustments: EarningAdjustmentRow[]; total: number }>
  >(`/admin/earnings/adjustments${query}`);
  return response.data.data;
}

export async function createEarningAdjustment(payload: {
  providerId: string;
  bookingId?: string;
  type: "bonus" | "deduction";
  amount: number;
  reason: string;
}) {
  const response = await api.post<ApiEnvelope<EarningAdjustmentRow>>(
    "/admin/earnings/adjustments",
    payload
  );
  return response.data.data;
}

export async function holdBookingEarning(
  bookingId: string,
  payload: { amount?: number; reason: string }
) {
  const response = await api.post<ApiEnvelope<Record<string, unknown>>>(
    `/admin/bookings/${bookingId}/hold-earnings`,
    payload
  );
  return response.data.data;
}

export async function releaseBookingEarning(bookingId: string) {
  const response = await api.post<ApiEnvelope<Record<string, unknown>>>(
    `/admin/bookings/${bookingId}/release-hold`,
    {}
  );
  return response.data.data;
}

// Payout banana Earnings page se — autoAttempt true ho to backend
// Stripe Connect par koshish karta hai, warna pending rehta hai
// jise Pay Manually se band kiya jata hai.
export async function createEarningsPayout(payload: {
  providerId: string;
  amount: number;
  autoAttempt: boolean;
}) {
  const response = await api.post<ApiEnvelope<AdminPayout>>(
    "/admin/payouts",
    payload
  );
  return response.data.data;
}


/* ═══════════════ Reports & Analytics (REP) ═══════════════ */

export type AnalyticsKpi = {
  key: string;
  value: number;
  prev: number | null;
  changePct: number | null;
  money: boolean;
};

export type AnalyticsOverview = {
  range: { from: string | null; to: string; label: string };
  kpis: AnalyticsKpi[];
  statusDistribution: { status: string; count: number }[];
  byService: { serviceId: string; title: string; count: number; pct: number }[];
  topProviders: {
    providerId: string;
    number: string;
    name: string;
    profileImage?: string;
    earnings: number;
    jobs: number;
  }[];
  topServices: { serviceId: string; title: string; revenue: number; jobs: number }[];
  openDisputes: number;
};

export type AnalyticsTrendPoint = { label: string; gross: number; commission: number };

export type AnalyticsBookings = {
  counts: Record<string, number>;
  total: number;
  completionRate: number | null;
  cancelRate: number | null;
  nowLater: { now: number; later: number };
  trend: { date: string; created: number; completed: number }[];
  cancelledBy: { by: string; count: number }[];
  byHour: { hour: number; count: number }[];
  byWeekday: { day: string; count: number }[];
  recentCancellations: {
    id: string;
    customer: string;
    provider: string;
    service: string;
    amount: number;
    at: string;
  }[];
};

export type AnalyticsRevenuePeriod = {
  date: string;
  gross: number;
  commission: number;
  net: number;
  jobs: number;
  tips: number;
  refunds: number;
  netRevenue: number;
};

export type AnalyticsRevenue = {
  grouping: string;
  periods: AnalyticsRevenuePeriod[];
  byService: {
    serviceId: string;
    title: string;
    jobs: number;
    gross: number;
    commission: number;
    net: number;
  }[];
  methodSplit: { card: number; wallet: number; splitBookings: number; walletBookings: number };
  totals: {
    gross: number;
    commission: number;
    net: number;
    tips: number;
    refunds: number;
    netRevenue: number;
  };
};

export type AnalyticsProviderRow = {
  providerId: string;
  number: string;
  name: string;
  profileImage?: string;
  isOnline: boolean;
  accountStatus: string;
  jobs: number;
  gross: number;
  commission: number;
  net: number;
  tips: number;
  rating: number | null;
  ratingCount: number;
  completionRate: number | null;
};

export type AnalyticsCustomers = {
  totalCustomers: number;
  newSignups: number;
  signupSeries: { date: string; count: number }[];
  bookingCustomers: number;
  repeatCustomers: number;
  repeatRate: number | null;
  topCustomers: {
    customerId: string;
    name: string;
    profileImage?: string;
    bookings: number;
    spent: number;
    lastBooking: string;
  }[];
  inactiveCount: number | null;
};

export type AnalyticsServices = {
  services: {
    serviceId: string;
    title: string;
    basePrice: number | null;
    isActive: boolean | null;
    bookings: number;
    share: number;
    revenue: number;
    commission: number;
  }[];
  addons: { name: string; times: number; revenue: number }[];
  attachRate: number | null;
  totalBookings: number;
};

export type AnalyticsFinancial = {
  methodSplit: { card: number; wallet: number; splitBookings: number; walletBookings: number };
  payoutsByStatus: { status: string; count: number; total: number }[];
  refundsByStatus: { status: string; count: number; total: number }[];
  refundsProcessed: { total: number; count: number };
  paidOut: { total: number; count: number };
  walletTopups: { total: number; count: number };
  walletPayments: { total: number; count: number };
  commissionWithdrawals: { total: number; count: number };
  stripe: { available: number; pending: number; currency: string } | null;
};

export type GeneratedReportRow = {
  id: string;
  name: string;
  type: string;
  groupBy: string;
  filters: Record<string, string>;
  rangeLabel: string;
  rangeFrom: string | null;
  rangeTo: string | null;
  format: "pdf" | "xlsx" | "csv";
  sizeBytes: number;
  rowCount: number;
  generatedBy: string | null;
  createdAt: string;
};

export type AnalyticsReportPreview = {
  id: string;
  name: string;
  format: string;
  columns: string[];
  rows: string[][];
  totalRows: number;
  truncated: boolean;
};

export type GenerateReportPayload = {
  type: string;
  format: "pdf" | "xlsx" | "csv";
  groupBy?: string;
  range?: string;
  from?: string;
  to?: string;
  filters?: { status?: string; providerId?: string; serviceId?: string; paymentStatus?: string };
};

const withQuery = (path: string, rangeQuery?: string) =>
  rangeQuery ? `${path}${rangeQuery.startsWith("?") ? rangeQuery : `?${rangeQuery}`}` : path;

export async function getAnalyticsOverview(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<AnalyticsOverview>>(
    withQuery("/admin/analytics/overview", rangeQuery)
  );
  return response.data.data;
}

export async function getAnalyticsTrend(rangeQuery: string | undefined, grouping: string) {
  const base = withQuery("/admin/analytics/trend", rangeQuery);
  const sep = base.includes("?") ? "&" : "?";
  const response = await api.get<ApiEnvelope<{ grouping: string; series: AnalyticsTrendPoint[] }>>(
    `${base}${sep}grouping=${grouping}`
  );
  return response.data.data;
}

export async function getAnalyticsBookings(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<AnalyticsBookings>>(
    withQuery("/admin/analytics/bookings", rangeQuery)
  );
  return response.data.data;
}

export async function getAnalyticsRevenue(rangeQuery: string | undefined, grouping: string) {
  const base = withQuery("/admin/analytics/revenue", rangeQuery);
  const sep = base.includes("?") ? "&" : "?";
  const response = await api.get<ApiEnvelope<AnalyticsRevenue>>(
    `${base}${sep}grouping=${grouping}`
  );
  return response.data.data;
}

export async function getAnalyticsProviders(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<{ signupCount: number; leaderboard: AnalyticsProviderRow[] }>>(
    withQuery("/admin/analytics/providers", rangeQuery)
  );
  return response.data.data;
}

export async function getAnalyticsCustomers(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<AnalyticsCustomers>>(
    withQuery("/admin/analytics/customers", rangeQuery)
  );
  return response.data.data;
}

export async function getAnalyticsServices(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<AnalyticsServices>>(
    withQuery("/admin/analytics/services", rangeQuery)
  );
  return response.data.data;
}

export async function getAnalyticsFinancial(rangeQuery?: string) {
  const response = await api.get<ApiEnvelope<AnalyticsFinancial>>(
    withQuery("/admin/analytics/financial", rangeQuery)
  );
  return response.data.data;
}

export async function generateAnalyticsReport(payload: GenerateReportPayload) {
  const response = await api.post<ApiEnvelope<GeneratedReportRow>>(
    "/admin/analytics/reports/generate",
    payload
  );
  return response.data.data;
}

export async function listAnalyticsReports(params: { search?: string; type?: string; page?: number; limit?: number } = {}) {
  const query = buildQuery({
    search: params.search?.trim() || undefined,
    type: params.type || undefined,
    page: params.page,
    limit: params.limit,
  });
  const response = await api.get<
    ApiEnvelope<{ reports: GeneratedReportRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>
  >(`/admin/analytics/reports${query}`);
  return response.data.data;
}

export async function downloadAnalyticsReport(id: string) {
  const response = await api.get(`/admin/analytics/reports/${id}/download`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function previewAnalyticsReportFile(id: string) {
  const response = await api.get(`/admin/analytics/reports/${id}/preview`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function previewAnalyticsReport(id: string) {
  const response = await api.get<ApiEnvelope<AnalyticsReportPreview>>(
    `/admin/analytics/reports/${id}/preview`
  );
  return response.data.data;
}

export async function renameAnalyticsReport(id: string, name: string) {
  const response = await api.patch<ApiEnvelope<GeneratedReportRow>>(
    `/admin/analytics/reports/${id}`,
    { name }
  );
  return response.data.data;
}

export async function duplicateAnalyticsReport(id: string) {
  const response = await api.post<ApiEnvelope<GeneratedReportRow>>(
    `/admin/analytics/reports/${id}/duplicate`,
    {}
  );
  return response.data.data;
}

export async function deleteAnalyticsReport(id: string) {
  const response = await api.delete<ApiEnvelope<{ id: string }>>(
    `/admin/analytics/reports/${id}`
  );
  return response.data.data;
}

export async function exportAnalyticsTab(tab: string, format: string, rangeQuery?: string) {
  const base = withQuery("/admin/analytics/export", rangeQuery);
  const sep = base.includes("?") ? "&" : "?";
  const response = await api.get(`${base}${sep}tab=${tab}&format=${format}`, {
    responseType: "blob",
  });
  return response.data as Blob;
}
