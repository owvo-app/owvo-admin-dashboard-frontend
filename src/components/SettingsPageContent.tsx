"use client";

import {
  changeAdminPassword,
  getDashboardSettingsV2,
  sendSettingsTestAlertEmail,
  updateAdminMe,
  updateDashboardSettingsV2,
  type PlatformSettingsV2,
} from "@/lib/admin-api";
import { useDashboardUser } from "@/hooks/useDashboardUser";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, Loader2, MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* Settings — grouped into clear sections, each with its own Save and  */
/* honest success/error feedback. Platform money settings are admin-   */
/* only on the backend, so staff see them read-only here too.          */
/* ------------------------------------------------------------------ */

type SectionMsg = { kind: "success" | "error"; text: string } | null;

function errorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return maybe?.response?.data?.message || maybe?.message || fallback;
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : format(d, "dd MMM yyyy, HH:mm");
}

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function SettingsPageContent({ bareHeader = false }: { bareHeader?: boolean } = {}) {
  const queryClient = useQueryClient();
  const user = useDashboardUser();
  const canEdit = user?.role === "admin";

  const settingsQuery = useQuery({
    queryKey: ["dashboard-settings-v2"],
    queryFn: () => getDashboardSettingsV2(),
    retry: false,
  });
  const settings = settingsQuery.data;

  // Profile
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState<SectionMsg>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Platform
  const [commissionPct, setCommissionPct] = useState("");
  const [dailyLimit, setDailyLimit] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [platformMsg, setPlatformMsg] = useState<SectionMsg>(null);
  const [platformSaving, setPlatformSaving] = useState(false);

  // Payouts & Stripe
  const [autoPayout, setAutoPayout] = useState(false);
  const [payoutDay, setPayoutDay] = useState("Friday");
  const [payoutMsg, setPayoutMsg] = useState<SectionMsg>(null);
  const [payoutSaving, setPayoutSaving] = useState(false);

  // Support & alerts
  const [supportEmail, setSupportEmail] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [alertTicket, setAlertTicket] = useState(true);
  const [alertDataRequest, setAlertDataRequest] = useState(true);
  const [alertPayoutFailed, setAlertPayoutFailed] = useState(true);
  const [alertsMsg, setAlertsMsg] = useState<SectionMsg>(null);
  const [alertsSaving, setAlertsSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<SectionMsg>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const hydrated = useRef(false);
  useEffect(() => {
    if (!settings || hydrated.current) return;
    hydrated.current = true;
    setCommissionPct(String(Math.round((settings.commissionRate ?? 0.25) * 100)));
    setDailyLimit(String(settings.dailyWashLimitMax ?? 7));
    setVerificationRequired(settings.providerVerificationRequired ?? true);
    setAutoPayout(settings.autoPayoutEnabled ?? false);
    setPayoutDay(settings.nextPayoutDay || "Friday");
    setSupportEmail(settings.supportEmail || "");
    setAlertEmail(settings.adminAlertEmail || "");
    setAlertTicket(settings.alertOnNewTicket ?? true);
    setAlertDataRequest(settings.alertOnDataRequest ?? true);
    setAlertPayoutFailed(settings.alertOnPayoutFailed ?? true);
  }, [settings]);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileEmail(user.email || "");
    }
  }, [user]);

  const refreshSettings = () =>
    queryClient.invalidateQueries({ queryKey: ["dashboard-settings-v2"] });

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateAdminMe({ name: profileName.trim(), email: profileEmail.trim() });
      setProfileMsg({ kind: "success", text: "Profile saved." });
      queryClient.invalidateQueries({ queryKey: ["dashboard-user"] });
    } catch (error) {
      setProfileMsg({
        kind: "error",
        text: errorMessage(error, "Could not save your profile. Please try again."),
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const savePlatform = async () => {
    const pct = Number(commissionPct);
    const limit = Number(dailyLimit);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setPlatformMsg({ kind: "error", text: "Commission must be between 0% and 100%." });
      return;
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      setPlatformMsg({ kind: "error", text: "Daily wash limit must be a whole number between 1 and 50." });
      return;
    }
    setPlatformSaving(true);
    setPlatformMsg(null);
    try {
      await updateDashboardSettingsV2({
        commissionRate: pct / 100,
        dailyWashLimitMax: limit,
        providerVerificationRequired: verificationRequired,
      });
      setPlatformMsg({ kind: "success", text: "Platform settings saved." });
      refreshSettings();
    } catch (error) {
      setPlatformMsg({
        kind: "error",
        text: errorMessage(error, "Could not save platform settings. Please try again."),
      });
    } finally {
      setPlatformSaving(false);
    }
  };

  const savePayouts = async () => {
    setPayoutSaving(true);
    setPayoutMsg(null);
    try {
      await updateDashboardSettingsV2({
        autoPayoutEnabled: autoPayout,
        nextPayoutDay: payoutDay,
      });
      setPayoutMsg({ kind: "success", text: "Payout settings saved." });
      refreshSettings();
    } catch (error) {
      setPayoutMsg({
        kind: "error",
        text: errorMessage(error, "Could not save payout settings. Please try again."),
      });
    } finally {
      setPayoutSaving(false);
    }
  };

  const saveAlerts = async () => {
    setAlertsSaving(true);
    setAlertsMsg(null);
    try {
      await updateDashboardSettingsV2({
        supportEmail: supportEmail.trim(),
        adminAlertEmail: alertEmail.trim(),
        alertOnNewTicket: alertTicket,
        alertOnDataRequest: alertDataRequest,
        alertOnPayoutFailed: alertPayoutFailed,
      });
      setAlertsMsg({ kind: "success", text: "Support and alert settings saved." });
      refreshSettings();
    } catch (error) {
      setAlertsMsg({
        kind: "error",
        text: errorMessage(error, "Could not save these settings. Please try again."),
      });
    } finally {
      setAlertsSaving(false);
    }
  };

  const sendTestEmail = async () => {
    setTestSending(true);
    setAlertsMsg(null);
    try {
      const result = await sendSettingsTestAlertEmail();
      setAlertsMsg({
        kind: "success",
        text: `Test email sent to ${result?.to || alertEmail || supportEmail}. Please check that inbox.`,
      });
    } catch (error) {
      setAlertsMsg({
        kind: "error",
        text: errorMessage(error, "The test email could not be sent. Please check the mail settings on the server."),
      });
    } finally {
      setTestSending(false);
    }
  };

  const savePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setPwMsg({ kind: "error", text: "Please fill in all three password fields." });
      return;
    }
    if (newPw.length < 6) {
      setPwMsg({ kind: "error", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ kind: "error", text: "New password and confirmation do not match." });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await changeAdminPassword({ oldPassword: currentPw, newPassword: newPw });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ kind: "success", text: "Password changed." });
    } catch (error) {
      setPwMsg({
        kind: "error",
        text: errorMessage(error, "Could not change the password. Please try again."),
      });
    } finally {
      setPwSaving(false);
    }
  };

  const msgNode = (msg: SectionMsg) =>
    msg ? (
      <p className={msg.kind === "success" ? "set-success" : "set-error"}>
        {msg.text}
      </p>
    ) : null;

  const updatedByName =
    settings?.updatedBy && typeof settings.updatedBy === "object"
      ? settings.updatedBy.fullName || settings.updatedBy.name || settings.updatedBy.email
      : null;

  return (
    <div>
      {bareHeader ? null : (
        <section className="data-page">
          <div className="data-page-header">
            <div>
              <h1>Settings</h1>
              <p>Admin-controlled platform settings connected to the backend.</p>
            </div>
          </div>
        </section>
      )}

      {settingsQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={22} /> Loading settings...
        </div>
      ) : settingsQuery.isError ? (
        <div className="error-state">
          We could not load the settings. Please check your internet
          connection and try again.
          <button
            className="booking-filter-reset"
            onClick={() => settingsQuery.refetch()}
            style={{ marginLeft: 10 }}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="set-grid">
            <div className="set-card">
              <div className="set-card-head">
                <h2>Admin Profile</h2>
                <p>The account you use to sign in to this dashboard.</p>
              </div>
              <label className="set-field">
                <span>Admin name</span>
                <input
                  className="modal-input"
                  onChange={(e) => setProfileName(e.target.value)}
                  value={profileName}
                />
              </label>
              <label className="set-field">
                <span>Admin email</span>
                <input
                  className="modal-input"
                  onChange={(e) => setProfileEmail(e.target.value)}
                  type="email"
                  value={profileEmail}
                />
              </label>
              {msgNode(profileMsg)}
              <div className="set-card-foot">
                <button
                  className="booking-create-btn"
                  disabled={profileSaving}
                  onClick={saveProfile}
                  type="button"
                >
                  {profileSaving ? <Loader2 size={15} /> : null} Save Profile
                </button>
              </div>
            </div>

            <div className="set-card">
              <div className="set-card-head">
                <h2>Change Password</h2>
                <p>Your current password is required to set a new one.</p>
              </div>
              <label className="set-field">
                <span>Current password</span>
                <input autoComplete="current-password"
                  className="modal-input"
                  onChange={(e) => setCurrentPw(e.target.value)}
                  type="password"
                  value={currentPw}
                />
              </label>
              <label className="set-field">
                <span>New password</span>
                <input autoComplete="new-password"
                  className="modal-input"
                  onChange={(e) => setNewPw(e.target.value)}
                  type="password"
                  value={newPw}
                />
              </label>
              <label className="set-field">
                <span>Confirm new password</span>
                <input autoComplete="new-password"
                  className="modal-input"
                  onChange={(e) => setConfirmPw(e.target.value)}
                  type="password"
                  value={confirmPw}
                />
              </label>
              {msgNode(pwMsg)}
              <div className="set-card-foot">
                <button
                  className="booking-create-btn"
                  disabled={pwSaving}
                  onClick={savePassword}
                  type="button"
                >
                  {pwSaving ? <Loader2 size={15} /> : null} Change Password
                </button>
              </div>
            </div>

            <div className="set-card">
              <div className="set-card-head">
                <h2>Platform</h2>
                <p>Money rules and limits for the whole platform.</p>
              </div>
              <fieldset disabled={!canEdit} style={{ border: 0, margin: 0, padding: 0 }}>
                <label className="set-field">
                  <span>OWVO Commission %</span>
                  <input
                    className="modal-input"
                    max={100}
                    min={0}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    type="number"
                    value={commissionPct}
                  />
                </label>
                <p className="set-note">
                  Applies to new bookings only. Bookings already made keep the
                  rate they were created with.
                </p>
                <label className="set-field">
                  <span>Provider daily wash limit</span>
                  <input
                    className="modal-input"
                    max={50}
                    min={1}
                    onChange={(e) => setDailyLimit(e.target.value)}
                    type="number"
                    value={dailyLimit}
                  />
                </label>
                <label className="set-toggle">
                  <input
                    checked={verificationRequired}
                    onChange={(e) => setVerificationRequired(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Require provider verification before going online</span>
                </label>
              </fieldset>
              {msgNode(platformMsg)}
              <div className="set-card-foot">
                <button
                  className="booking-create-btn"
                  disabled={!canEdit || platformSaving}
                  onClick={savePlatform}
                  type="button"
                >
                  {platformSaving ? <Loader2 size={15} /> : null} Save Platform
                  Settings
                </button>
                {!canEdit ? (
                  <span className="muted">Only admins can change these settings.</span>
                ) : null}
              </div>
            </div>

            <div className="set-card">
              <div className="set-card-head">
                <h2>Payouts &amp; Stripe</h2>
                <p>How provider earnings are paid out each week.</p>
              </div>
              <fieldset disabled={!canEdit} style={{ border: 0, margin: 0, padding: 0 }}>
                <label className="set-toggle">
                  <input
                    checked={autoPayout}
                    onChange={(e) => setAutoPayout(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Auto payout enabled (weekly run)</span>
                </label>
                <label className="set-field">
                  <span>Next payout day</span>
                  <select
                    className="modal-input"
                    onChange={(e) => setPayoutDay(e.target.value)}
                    value={payoutDay}
                  >
                    {WEEK_DAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <dl className="set-kv">
                  <dt>Stripe account</dt>
                  <dd>{settings?.stripeAccountId || "Not recorded"}</dd>
                  <dt>Stripe payouts</dt>
                  <dd>{settings?.stripePayoutsEnabled ? "Enabled" : "Not enabled"}</dd>
                </dl>
              </fieldset>
              {msgNode(payoutMsg)}
              <div className="set-card-foot">
                <button
                  className="booking-create-btn"
                  disabled={!canEdit || payoutSaving}
                  onClick={savePayouts}
                  type="button"
                >
                  {payoutSaving ? <Loader2 size={15} /> : null} Save Payout
                  Settings
                </button>
                <a
                  className="booking-filter-reset"
                  href={settings?.stripeDashboardUrl || "https://dashboard.stripe.com/"}
                  rel="noreferrer"
                  style={{ alignItems: "center", display: "inline-flex", gap: 6, textDecoration: "none" }}
                  target="_blank"
                >
                  <ExternalLink size={14} /> Open Stripe Dashboard
                </a>
              </div>
            </div>

            <div className="set-card">
              <div className="set-card-head">
                <h2>Support &amp; Notification Alerts</h2>
                <p>
                  Where support email goes, and which events send an email
                  alert to the admin.
                </p>
              </div>
              <fieldset disabled={!canEdit} style={{ border: 0, margin: 0, padding: 0 }}>
                <label className="set-field">
                  <span>Support email (shown to customers and providers)</span>
                  <input
                    className="modal-input"
                    onChange={(e) => setSupportEmail(e.target.value)}
                    type="email"
                    value={supportEmail}
                  />
                </label>
                <label className="set-field">
                  <span>Admin alert email</span>
                  <input
                    className="modal-input"
                    onChange={(e) => setAlertEmail(e.target.value)}
                    placeholder="Leave empty to use the support email"
                    type="email"
                    value={alertEmail}
                  />
                </label>
                <label className="set-toggle">
                  <input
                    checked={alertTicket}
                    onChange={(e) => setAlertTicket(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Email me when a new support ticket or dispute is opened</span>
                </label>
                <label className="set-toggle">
                  <input
                    checked={alertDataRequest}
                    onChange={(e) => setAlertDataRequest(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Email me when a new data request arrives (30-day GDPR deadline)</span>
                </label>
                <label className="set-toggle">
                  <input
                    checked={alertPayoutFailed}
                    onChange={(e) => setAlertPayoutFailed(e.target.checked)}
                    type="checkbox"
                  />
                  <span>Email me when a provider payout fails</span>
                </label>
              </fieldset>
              {msgNode(alertsMsg)}
              <div className="set-card-foot">
                <button
                  className="booking-create-btn"
                  disabled={!canEdit || alertsSaving}
                  onClick={saveAlerts}
                  type="button"
                >
                  {alertsSaving ? <Loader2 size={15} /> : null} Save Alert
                  Settings
                </button>
                <button
                  className="booking-filter-reset"
                  disabled={!canEdit || testSending}
                  onClick={sendTestEmail}
                  type="button"
                >
                  {testSending ? <Loader2 size={15} /> : <MailCheck size={15} />}{" "}
                  Send Test Email
                </button>
                {!canEdit ? (
                  <span className="muted">Only admins can change these settings.</span>
                ) : null}
              </div>
            </div>
          </div>

          {updatedByName || settings?.updatedAt ? (
            <p className="muted" style={{ marginTop: 14 }}>
              Last updated
              {updatedByName ? ` by ${updatedByName}` : ""}
              {settings?.updatedAt ? ` on ${fmtDate(settings.updatedAt)}` : ""}.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

