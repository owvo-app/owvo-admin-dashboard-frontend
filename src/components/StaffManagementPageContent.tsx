"use client";

import {
  createStaffAccountV2,
  createStaffNote,
  deleteStaffAccount,
  deleteStaffNote,
  getStaffAccountsV2,
  getStaffActivity,
  getStaffMeta,
  getStaffNotes,
  resetStaffPassword,
  updateStaffAccountV2,
  uploadStaffPhoto,
  type StaffAccountFull,
  type StaffMeta,
} from "@/lib/admin-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Staff Management v2 — role-based staff accounts. One Super Admin    */
/* (the admin account, managed outside this page) plus staff accounts  */
/* with named roles: Operations Manager, Support Agent, Finance Staff, */
/* Dispatch Staff, or Custom. Menus decide what a staff member can     */
/* open; actions record what they may do inside those modules.         */
/* ------------------------------------------------------------------ */

const LIMIT = 20;

const ROLE_CHIP: Record<string, string> = {
  operations_manager: "stf-chip purple",
  support_agent: "stf-chip blue",
  finance_staff: "stf-chip green",
  dispatch_staff: "stf-chip orange",
  custom: "stf-chip grey",
};

const ROLE_COLORS: Record<string, string> = {
  operations_manager: "#7c3aed",
  support_agent: "#2563eb",
  finance_staff: "#059669",
  dispatch_staff: "#d97706",
  custom: "#64748b",
};

function errorMessage(error: unknown, fallback: string) {
  const maybe = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return maybe?.response?.data?.message || maybe?.message || fallback;
}

function staffName(s: StaffAccountFull) {
  return s.name || (s as { fullName?: string }).fullName || s.email || "Staff";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function statusOf(s: StaffAccountFull) {
  if (s.accountStatus === "disabled")
    return { label: "Inactive", cls: "inactive" };
  if (s.staffStatus === "on_leave")
    return { label: "On Leave", cls: "onleave" };
  return { label: "Active", cls: "active" };
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : format(d, "dd MMM yyyy");
}

function humanize(value?: string) {
  if (!value) return "—";
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/* ------------------------------------------------------------------ */
/* Add / Edit Staff wizard (4 steps)                                   */
/* ------------------------------------------------------------------ */

type WizardProps = {
  meta: StaffMeta;
  editing?: StaffAccountFull | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

function StaffWizard({ meta, editing, onClose, onSaved }: WizardProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(editing);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");

  const nameParts = (editing?.name || "").split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [email, setEmail] = useState(editing?.email || "");
  const [phone, setPhone] = useState(editing?.phoneNumber || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(editing?.photo?.url || "");
  const [photoBusy, setPhotoBusy] = useState(false);

  const [role, setRole] = useState(editing?.staffRole || "custom");
  const [menus, setMenus] = useState<string[]>(
    editing?.staffPermissions?.menus || []
  );
  const [actions, setActions] = useState<string[]>(
    editing?.staffPermissions?.actions || []
  );

  const [department, setDepartment] = useState(editing?.department || "");
  const [location, setLocation] = useState(editing?.staffLocation || "");
  const [reportingTo, setReportingTo] = useState(
    typeof editing?.reportingTo === "object" && editing?.reportingTo
      ? editing.reportingTo._id
      : ""
  );
  const [staffStatus, setStaffStatus] = useState(
    editing?.staffStatus || "active"
  );
  const [saving, setSaving] = useState(false);

  const optionsQuery = useQuery({
    queryKey: ["staff-options"],
    queryFn: () => getStaffAccountsV2({ limit: 100, includeAdmins: true }),
  });
  const managerOptions = (optionsQuery.data?.items || []).filter(
    (s) => s._id !== editing?._id
  );

  const applyRole = (key: string) => {
    setRole(key);
    const preset = meta.presets[key];
    if (preset) {
      setMenus(preset.menus);
      setActions(preset.actions);
    }
  };

  const toggleMenu = (key: string, checked: boolean) => {
    setMenus((cur) => (checked ? [...cur, key] : cur.filter((m) => m !== key)));
    if (!checked) {
      const group = meta.actions.find((g) => g.module === key);
      if (group) {
        const keys = group.actions.map((a) => a.key);
        setActions((cur) => cur.filter((a) => !keys.includes(a)));
      }
    }
  };

  const toggleAction = (key: string, checked: boolean) =>
    setActions((cur) => (checked ? [...cur, key] : cur.filter((a) => a !== key)));

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      const result = await uploadStaffPhoto(file);
      setPhotoUrl(result.url);
    } catch (err) {
      setError(errorMessage(err, "Photo upload failed. Please try again."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!firstName.trim()) return "First name is required.";
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
        return "A valid email address is required.";
      if (!isEdit && password.length < 6)
        return "Password must be at least 6 characters.";
    }
    if (step === 2 && menus.length === 0)
      return "Please give this staff member access to at least one menu.";
    return "";
  };

  const submit = async () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    setSaving(true);
    setError("");
    try {
      if (isEdit && editing) {
        await updateStaffAccountV2(editing._id, {
          name: fullName,
          phone: phone.trim(),
          staffRole: role,
          department,
          location: location.trim(),
          reportingTo: reportingTo || null,
          staffStatus,
          photoUrl: photoUrl || undefined,
          staffPermissions: { menus, actions },
        });
        onSaved("Staff member updated.");
      } else {
        await createStaffAccountV2({
          name: fullName,
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
          staffRole: role,
          department,
          location: location.trim(),
          reportingTo: reportingTo || null,
          photoUrl: photoUrl || undefined,
          staffPermissions: { menus, actions },
        });
        onSaved("Staff account created. They can now sign in to the dashboard.");
      }
      queryClient.invalidateQueries({ queryKey: ["staff-accounts-v2"] });
      queryClient.invalidateQueries({ queryKey: ["staff-options"] });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Could not save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = meta.roles.find((r) => r.key === role)?.label || role;

  return (
    <div className="stf-modal-backdrop" onClick={onClose}>
      <div className="stf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stf-modal-head">
          <h2>{isEdit ? "Edit Staff" : "Add New Staff"}</h2>
          <button className="stf-icon-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="stf-steps">
          {["Basic Information", "Role & Permissions", "Department & Location", "Review"].map(
            (label, i) => (
              <span
                key={label}
                className={`stf-step ${step === i + 1 ? "active" : ""} ${step > i + 1 ? "done" : ""}`}
              >
                {i + 1}. {label}
              </span>
            )
          )}
        </div>

        {step === 1 ? (
          <div className="stf-form">
            <div className="stf-photo-row">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="stf-avatar-img" src={photoUrl} />
              ) : (
                <span className="stf-avatar">
                  {initials(`${firstName} ${lastName}`) || "?"}
                </span>
              )}
              <label className="booking-filter-reset" style={{ cursor: "pointer" }}>
                {photoBusy ? <Loader2 size={14} /> : null} Upload Photo
                <input
                  accept="image/*"
                  hidden
                  onChange={(e) => uploadPhoto(e.target.files?.[0] || null)}
                  type="file"
                />
              </label>
              <span className="muted">JPG or PNG, optional.</span>
            </div>
            <div className="stf-two">
              <label className="set-field">
                <span>First Name *</span>
                <input name="stf-first-name" autoComplete="off"
                  className="modal-input"
                  onChange={(e) => setFirstName(e.target.value)}
                  value={firstName}
                />
              </label>
              <label className="set-field">
                <span>Last Name</span>
                <input name="stf-last-name" autoComplete="off"
                  className="modal-input"
                  onChange={(e) => setLastName(e.target.value)}
                  value={lastName}
                />
              </label>
            </div>
            <label className="set-field">
              <span>Email *</span>
              <input name="stf-email" autoComplete="off"
                className="modal-input"
                disabled={isEdit}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="set-field">
              <span>Phone</span>
              <input name="stf-phone" autoComplete="off"
                className="modal-input"
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44..."
                value={phone}
              />
            </label>
            {!isEdit ? (
              <label className="set-field">
                <span>Password *</span>
                <span className="password-input-shell">
                  <input name="stf-new-password" autoComplete="new-password"
                    className="modal-input"
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPw ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((v) => !v)}
                    type="button"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </span>
              </label>
            ) : (
              <p className="set-note">
                To change this staff member&apos;s password, use Reset Password
                from their row menu.
              </p>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stf-form">
            <label className="set-field">
              <span>Role *</span>
              <select
                className="modal-input"
                onChange={(e) => applyRole(e.target.value)}
                value={role}
              >
                {meta.roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="set-note">
              Choosing a role fills in its standard permissions below. You can
              adjust any of them for this person.
            </p>
            <div className="stf-perm-tree">
              {meta.menus.map((menu) => {
                const group = meta.actions.find((g) => g.module === menu.key);
                const menuChecked = menus.includes(menu.key);
                return (
                  <div className="stf-perm-module" key={menu.key}>
                    <label className="set-toggle" style={{ marginBottom: 4 }}>
                      <input
                        checked={menuChecked}
                        onChange={(e) => toggleMenu(menu.key, e.target.checked)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{menu.label}</strong>
                        {menu.hint ? (
                          <span className="muted"> — {menu.hint}</span>
                        ) : null}
                      </span>
                    </label>
                    {group && menuChecked ? (
                      <div className="stf-perm-actions">
                        {group.actions.map((a) => (
                          <label className="set-toggle" key={a.key} style={{ marginBottom: 4 }}>
                            <input
                              checked={actions.includes(a.key)}
                              onChange={(e) => toggleAction(a.key, e.target.checked)}
                              type="checkbox"
                            />
                            <span>{a.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="stf-form">
            <label className="set-field">
              <span>Department</span>
              <select
                className="modal-input"
                onChange={(e) => setDepartment(e.target.value)}
                value={department}
              >
                <option value="">— Select —</option>
                {meta.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="set-field">
              <span>Location</span>
              <input
                className="modal-input"
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. HQ London"
                value={location}
              />
            </label>
            <label className="set-field">
              <span>Reporting To</span>
              <select
                className="modal-input"
                onChange={(e) => setReportingTo(e.target.value)}
                value={reportingTo}
              >
                <option value="">— None —</option>
                {managerOptions.map((s) => (
                  <option key={s._id} value={s._id}>
                    {staffName(s)} ({s.email}){s.role === "admin" ? " — Admin" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="set-field">
              <span>Employment Status</span>
              <select
                className="modal-input"
                onChange={(e) => setStaffStatus(e.target.value)}
                value={staffStatus}
              >
                <option value="active">Active</option>
                <option value="on_leave">On Leave</option>
              </select>
            </label>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="stf-form">
            <dl className="set-kv">
              <dt>Name</dt>
              <dd>{`${firstName} ${lastName}`.trim() || "—"}</dd>
              <dt>Email</dt>
              <dd>{email}</dd>
              <dt>Phone</dt>
              <dd>{phone || "—"}</dd>
              <dt>Role</dt>
              <dd>{roleLabel}</dd>
              <dt>Menus</dt>
              <dd>{menus.length} selected</dd>
              <dt>Department</dt>
              <dd>{department || "—"}</dd>
              <dt>Location</dt>
              <dd>{location || "—"}</dd>
              <dt>Status</dt>
              <dd>{staffStatus === "on_leave" ? "On Leave" : "Active"}</dd>
            </dl>
            <p className="set-note">
              {isEdit
                ? "Saving updates this staff member's account and permissions."
                : "Creating the account lets this person sign in to the dashboard right away with the email and password you set."}
            </p>
          </div>
        ) : null}

        {error ? <p className="set-error">{error}</p> : null}

        <div className="stf-modal-foot">
          {step > 1 ? (
            <button
              className="booking-filter-reset"
              onClick={() => {
                setError("");
                setStep(step - 1);
              }}
              type="button"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 4 ? (
            <button
              className="booking-create-btn"
              onClick={() => {
                const problem = validateStep();
                if (problem) {
                  setError(problem);
                  return;
                }
                setError("");
                setStep(step + 1);
              }}
              type="button"
            >
              Next
            </button>
          ) : (
            <button
              className="booking-create-btn"
              disabled={saving}
              onClick={submit}
              type="button"
            >
              {saving ? <Loader2 size={15} /> : null}{" "}
              {isEdit ? "Save Changes" : "Create Staff"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff detail panel (slide-in): Overview / Permissions / Activity /  */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

type PanelProps = {
  staff: StaffAccountFull;
  meta: StaffMeta;
  onClose: () => void;
  onEdit: () => void;
  onResetPw: () => void;
  notify: (kind: "success" | "error", text: string) => void;
};

function StaffPanel({ staff, meta, onClose, onEdit, onResetPw, notify }: PanelProps) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "permissions" | "activity" | "notes">("overview");
  const [menus, setMenus] = useState<string[]>(staff.staffPermissions?.menus || []);
  const [actions, setActions] = useState<string[]>(staff.staffPermissions?.actions || []);
  const [permSaving, setPermSaving] = useState(false);
  const [noteText, setNoteText] = useState("");

  const activityQuery = useQuery({
    queryKey: ["staff-activity", staff._id],
    queryFn: () => getStaffActivity(staff._id),
    enabled: tab === "activity",
  });
  const notesQuery = useQuery({
    queryKey: ["staff-notes", staff._id],
    queryFn: () => getStaffNotes(staff._id),
    enabled: tab === "notes",
  });

  const name = staffName(staff);
  const status = statusOf(staff);
  const roleLabel = meta.roles.find((r) => r.key === staff.staffRole)?.label || "Custom";
  const reportingName =
    typeof staff.reportingTo === "object" && staff.reportingTo
      ? staff.reportingTo.name || staff.reportingTo.fullName || staff.reportingTo.email
      : null;

  const savePermissions = async () => {
    setPermSaving(true);
    try {
      await updateStaffAccountV2(staff._id, { staffPermissions: { menus, actions } });
      notify("success", "Permissions updated.");
      queryClient.invalidateQueries({ queryKey: ["staff-accounts-v2"] });
    } catch (err) {
      notify("error", errorMessage(err, "Could not update permissions."));
    } finally {
      setPermSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await createStaffNote(staff._id, noteText.trim());
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["staff-notes", staff._id] });
    } catch (err) {
      notify("error", errorMessage(err, "Could not add the note."));
    }
  };

  return (
    <div className="stf-panel-backdrop" onClick={onClose}>
      <aside className="stf-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stf-panel-head">
          <div className="stf-panel-id">
            {staff.photo?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="stf-avatar-img" src={staff.photo.url} />
            ) : (
              <span className="stf-avatar">{initials(name)}</span>
            )}
            <div>
              <h2>{name}</h2>
              <p className="muted">
                {staff.staffNumber ? `#ST${String(staff.staffNumber).padStart(3, "0")} · ` : ""}
                {staff.email}
              </p>
              <p>
                <span className={ROLE_CHIP[staff.staffRole || "custom"] || ROLE_CHIP.custom}>
                  {roleLabel}
                </span>{" "}
                <span className={`table-status ${status.cls}`}>{status.label}</span>
              </p>
            </div>
          </div>
          <button className="stf-icon-btn" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        <div className="stf-tabs">
          {(["overview", "permissions", "activity", "notes"] as const).map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
              type="button"
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <div className="stf-panel-body">
            <h3>Contact Information</h3>
            <dl className="set-kv">
              <dt>Email</dt>
              <dd>{staff.email}</dd>
              <dt>Phone</dt>
              <dd>{staff.phoneNumber || "—"}</dd>
              <dt>Location</dt>
              <dd>{staff.staffLocation || "—"}</dd>
            </dl>
            <h3>Employment Details</h3>
            <dl className="set-kv">
              <dt>Department</dt>
              <dd>{staff.department || "—"}</dd>
              <dt>Role</dt>
              <dd>{roleLabel}</dd>
              <dt>Reporting To</dt>
              <dd>{reportingName || "—"}</dd>
              <dt>Joined</dt>
              <dd>{fmtDate(staff.createdAt)}</dd>
              <dt>Last Login</dt>
              <dd>
                {staff.lastLoginAt
                  ? `${formatDistanceToNow(new Date(staff.lastLoginAt), { addSuffix: true })} (${fmtDate(staff.lastLoginAt)})`
                  : "Never"}
              </dd>
            </dl>
            <h3>Permissions Summary</h3>
            <div className="stf-chip-row">
              {(staff.staffPermissions?.menus || []).map((key) => (
                <span className="stf-mini-chip" key={key}>
                  {meta.menus.find((m) => m.key === key)?.label || humanize(key)}
                </span>
              ))}
              {(staff.staffPermissions?.menus || []).length === 0 ? (
                <span className="muted">No menus assigned.</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "permissions" ? (
          <div className="stf-panel-body">
            <div className="stf-perm-tree">
              {meta.menus.map((menu) => {
                const group = meta.actions.find((g) => g.module === menu.key);
                const menuChecked = menus.includes(menu.key);
                return (
                  <div className="stf-perm-module" key={menu.key}>
                    <label className="set-toggle" style={{ marginBottom: 4 }}>
                      <input
                        checked={menuChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setMenus((cur) =>
                            checked ? [...cur, menu.key] : cur.filter((m) => m !== menu.key)
                          );
                          if (!checked && group) {
                            const keys = group.actions.map((a) => a.key);
                            setActions((cur) => cur.filter((a) => !keys.includes(a)));
                          }
                        }}
                        type="checkbox"
                      />
                      <span>
                        <strong>{menu.label}</strong>
                        {menu.hint ? <span className="muted"> — {menu.hint}</span> : null}
                      </span>
                    </label>
                    {group && menuChecked ? (
                      <div className="stf-perm-actions">
                        {group.actions.map((a) => (
                          <label className="set-toggle" key={a.key} style={{ marginBottom: 4 }}>
                            <input
                              checked={actions.includes(a.key)}
                              onChange={(e) =>
                                setActions((cur) =>
                                  e.target.checked
                                    ? [...cur, a.key]
                                    : cur.filter((x) => x !== a.key)
                                )
                              }
                              type="checkbox"
                            />
                            <span>{a.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <button
              className="booking-create-btn"
              disabled={permSaving}
              onClick={savePermissions}
              type="button"
            >
              {permSaving ? <Loader2 size={15} /> : null} Save Permissions
            </button>
          </div>
        ) : null}

        {tab === "activity" ? (
          <div className="stf-panel-body">
            {activityQuery.isLoading ? (
              <div className="empty-state">
                <Loader2 size={20} /> Loading activity...
              </div>
            ) : activityQuery.isError ? (
              <div className="error-state">
                We could not load this staff member&apos;s activity.
                <button
                  className="booking-filter-reset"
                  onClick={() => activityQuery.refetch()}
                  style={{ marginLeft: 10 }}
                  type="button"
                >
                  Retry
                </button>
              </div>
            ) : (activityQuery.data || []).length === 0 ? (
              <div className="empty-state">No recorded activity yet.</div>
            ) : (
              <ul className="stf-activity">
                {(activityQuery.data || []).map((log) => (
                  <li key={log._id}>
                    <strong>{humanize(log.action)}</strong>
                    <span className="muted">
                      {log.createdAt
                        ? `${formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })} · ${fmtDate(log.createdAt)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="stf-panel-body">
            <div className="stf-note-form">
              <textarea
                className="modal-input"
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a private note about this staff member..."
                rows={3}
                value={noteText}
              />
              <button
                className="booking-create-btn"
                disabled={!noteText.trim()}
                onClick={addNote}
                type="button"
              >
                Add Note
              </button>
            </div>
            {notesQuery.isLoading ? (
              <div className="empty-state">
                <Loader2 size={20} /> Loading notes...
              </div>
            ) : (notesQuery.data || []).length === 0 ? (
              <div className="empty-state">No notes yet.</div>
            ) : (
              <ul className="stf-notes">
                {(notesQuery.data || []).map((note) => (
                  <li key={note._id}>
                    <p>{note.text}</p>
                    <span className="muted">
                      {note.author?.fullName || note.author?.name || "Admin"} ·{" "}
                      {note.createdAt ? fmtDate(note.createdAt) : ""}
                    </span>
                    <button
                      className="stf-icon-btn"
                      onClick={async () => {
                        try {
                          await deleteStaffNote(staff._id, note._id);
                          queryClient.invalidateQueries({
                            queryKey: ["staff-notes", staff._id],
                          });
                        } catch (err) {
                          notify("error", errorMessage(err, "Could not delete the note."));
                        }
                      }}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="stf-panel-foot">
          <button className="booking-filter-reset" onClick={onEdit} type="button">
            <Pencil size={14} /> Edit
          </button>
          <button className="booking-filter-reset" onClick={onResetPw} type="button">
            <KeyRound size={14} /> Reset Password
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                           */
/* ------------------------------------------------------------------ */

export function StaffManagementPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [selected, setSelected] = useState<StaffAccountFull | null>(null);
  const [wizard, setWizard] = useState<{ editing: StaffAccountFull | null } | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffAccountFull | null>(null);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [showResetPw, setShowResetPw] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetError, setResetError] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    kind: "deactivate" | "activate" | "delete";
    staff: StaffAccountFull;
  } | null>(null);
  const [menuFor, setMenuFor] = useState<{ staff: StaffAccountFull; x: number; y: number } | null>(null);

  const notify = (kind: "success" | "error", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4200);
  };

  const metaQuery = useQuery({ queryKey: ["staff-meta"], queryFn: () => getStaffMeta() });
  const meta = metaQuery.data;

  const listQuery = useQuery({
    queryKey: ["staff-accounts-v2", search, roleFilter, deptFilter, statusFilter, page],
    queryFn: () =>
      getStaffAccountsV2({
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        department: deptFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      }),
    retry: false,
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const counts = listQuery.data?.counts ?? { total: 0, active: 0, onLeave: 0, inactive: 0 };
  const pageCount = Math.max(1, Math.ceil(total / LIMIT));

  const donut = useMemo(() => {
    const dist = listQuery.data?.roleDistribution || {};
    const entries = Object.entries(dist).filter(([, n]) => n > 0);
    const sum = entries.reduce((acc, [, n]) => acc + n, 0);
    let offset = 0;
    const C = 2 * Math.PI * 34;
    const segments = entries.map(([key, n]) => {
      const frac = sum ? n / sum : 0;
      const seg = { key, n, dash: `${frac * C} ${C}`, offset: -offset * C, color: ROLE_COLORS[key] || "#94a3b8" };
      offset += frac;
      return seg;
    });
    return { segments, sum };
  }, [listQuery.data?.roleDistribution]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuFor]);

  const runConfirm = async () => {
    if (!confirmAction) return;
    const { kind, staff } = confirmAction;
    try {
      if (kind === "delete") {
        await deleteStaffAccount(staff._id);
        notify("success", "Staff account deleted.");
      } else {
        await updateStaffAccountV2(staff._id, {
          accountStatus: kind === "deactivate" ? "disabled" : "active",
        });
        notify("success", kind === "deactivate" ? "Staff account deactivated." : "Staff account activated.");
      }
      queryClient.invalidateQueries({ queryKey: ["staff-accounts-v2"] });
      if (selected?._id === staff._id) setSelected(null);
    } catch (err) {
      notify("error", errorMessage(err, "That action could not be completed."));
    } finally {
      setConfirmAction(null);
    }
  };

  const runReset = async () => {
    if (!resetTarget) return;
    if (newPw.length < 6) {
      setResetError("New password must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetBusy(true);
    setResetError("");
    try {
      await resetStaffPassword(resetTarget._id, newPw);
      notify("success", `Password reset for ${staffName(resetTarget)}.`);
      setResetTarget(null);
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setResetError(errorMessage(err, "Could not reset the password."));
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Staff Management</h1>
          <p>Manage your team members, roles, permissions and access to OWVO.</p>
        </div>
        <button
          className="booking-create-btn"
          disabled={!meta}
          onClick={() => setWizard({ editing: null })}
          type="button"
        >
          <Plus size={16} /> Add Staff
        </button>
      </div>

      {toast ? (
        <p className={toast.kind === "success" ? "set-success" : "set-error"} style={{ marginBottom: 14 }}>
          {toast.text}
        </p>
      ) : null}

      <div className="stf-cards">
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Staff</span>
            <Users size={18} />
          </div>
          <div className="dash-stat-value">{counts.total}</div>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Active Staff</span>
            <UserCheck size={18} />
          </div>
          <div className="dash-stat-value">{counts.active}</div>
          <span className="muted">
            {counts.total ? `${Math.round((counts.active / counts.total) * 100)}% of total` : "—"}
          </span>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">On Leave</span>
            <Clock size={18} />
          </div>
          <div className="dash-stat-value">{counts.onLeave}</div>
          <span className="muted">
            {counts.total ? `${Math.round((counts.onLeave / counts.total) * 100)}% of total` : "—"}
          </span>
        </div>
        <div className="dash-stat-card">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Inactive</span>
            <UserX size={18} />
          </div>
          <div className="dash-stat-value">{counts.inactive}</div>
          <span className="muted">
            {counts.total ? `${Math.round((counts.inactive / counts.total) * 100)}% of total` : "—"}
          </span>
        </div>
        <div className="dash-stat-card stf-donut-card">
          <span className="dash-stat-label">Role Distribution</span>
          {donut.sum === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>No staff yet.</p>
          ) : (
            <div className="stf-donut-wrap">
              <svg height="84" viewBox="0 0 84 84" width="84">
                <circle cx="42" cy="42" fill="none" r="34" stroke="#e5e7eb" strokeWidth="10" />
                {donut.segments.map((seg) => (
                  <circle
                    cx="42"
                    cy="42"
                    fill="none"
                    key={seg.key}
                    r="34"
                    stroke={seg.color}
                    strokeDasharray={seg.dash}
                    strokeDashoffset={seg.offset}
                    strokeWidth="10"
                    transform="rotate(-90 42 42)"
                  />
                ))}
                <text fontSize="15" fontWeight="700" textAnchor="middle" x="42" y="47">
                  {donut.sum}
                </text>
              </svg>
              <ul className="stf-donut-legend">
                {donut.segments.map((seg) => (
                  <li key={seg.key}>
                    <span className="stf-dot" style={{ background: seg.color }} />
                    {meta?.roles.find((r) => r.key === seg.key)?.label || humanize(seg.key)} — {seg.n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="slog-filters">
        <label className="booking-search">
          <Search size={16} />
          <input
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email"
            value={search}
          />
        </label>
        <select
          className="modal-input slog-entity-select"
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          value={roleFilter}
        >
          <option value="">All Roles</option>
          {(meta?.roles || []).map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          className="modal-input slog-entity-select"
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          value={deptFilter}
        >
          <option value="">All Departments</option>
          {(meta?.departments || []).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          className="modal-input slog-entity-select"
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          value={statusFilter}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
        {search || roleFilter || deptFilter || statusFilter ? (
          <button
            className="booking-filter-reset"
            onClick={() => {
              setSearch("");
              setRoleFilter("");
              setDeptFilter("");
              setStatusFilter("");
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
              <th>ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last Login</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((staff) => {
              const status = statusOf(staff);
              const name = staffName(staff);
              return (
                <tr key={staff._id}>
                  <td>{staff.staffNumber ? `#ST${String(staff.staffNumber).padStart(3, "0")}` : "—"}</td>
                  <td>
                    <span className="stf-name-cell">
                      {staff.photo?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="stf-avatar-img small" src={staff.photo.url} />
                      ) : (
                        <span className="stf-avatar small">{initials(name)}</span>
                      )}
                      <strong>{name}</strong>
                    </span>
                  </td>
                  <td>{staff.email}</td>
                  <td>
                    <span className={ROLE_CHIP[staff.staffRole || "custom"] || ROLE_CHIP.custom}>
                      {meta?.roles.find((r) => r.key === staff.staffRole)?.label || "Custom"}
                    </span>
                  </td>
                  <td>{staff.department || "—"}</td>
                  <td>{staff.staffLocation || "—"}</td>
                  <td>
                    <span className={`table-status ${status.cls}`}>{status.label}</span>
                  </td>
                  <td>
                    {staff.lastLoginAt
                      ? formatDistanceToNow(new Date(staff.lastLoginAt), { addSuffix: true })
                      : "Never"}
                  </td>
                  <td>
                    <button
                      className="stf-icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setMenuFor({ staff, x: rect.right - 190, y: rect.bottom + 6 });
                      }}
                      type="button"
                    >
                      <MoreVertical size={17} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {listQuery.isLoading || metaQuery.isLoading ? (
          <div className="empty-state">
            <Loader2 size={22} /> Loading staff...
          </div>
        ) : listQuery.isError ? (
          <div className="error-state">
            We could not load the staff list. Please check your internet
            connection and try again.
            <button
              className="booking-filter-reset"
              onClick={() => listQuery.refetch()}
              style={{ marginLeft: 10 }}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            {search || roleFilter || deptFilter || statusFilter
              ? "No staff match your filters. Try clearing them."
              : "No staff accounts yet. Use Add Staff to create the first one — the admin account itself is the Super Admin and is managed separately."}
          </div>
        ) : null}
      </div>

      {total > 0 ? (
        <div className="sup-pagination">
          <span className="muted">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(total, page * LIMIT)} of {total} staff
          </span>
          <div className="sup-pagination-buttons">
            <button
              disabled={page <= 1 || listQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="muted">
              Page {page} of {pageCount}
            </span>
            <button
              disabled={page >= pageCount || listQuery.isFetching}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              type="button"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      ) : null}

      {menuFor ? (
        <div
          className="stf-menu"
          style={{ left: menuFor.x, top: menuFor.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setSelected(menuFor.staff);
              setMenuFor(null);
            }}
            type="button"
          >
            <Eye size={14} /> View Details
          </button>
          <button
            onClick={() => {
              setWizard({ editing: menuFor.staff });
              setMenuFor(null);
            }}
            type="button"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={() => {
              setResetTarget(menuFor.staff);
              setResetError("");
              setMenuFor(null);
            }}
            type="button"
          >
            <KeyRound size={14} /> Reset Password
          </button>
          {menuFor.staff.accountStatus === "disabled" ? (
            <button
              onClick={() => {
                setConfirmAction({ kind: "activate", staff: menuFor.staff });
                setMenuFor(null);
              }}
              type="button"
            >
              <CheckCircle2 size={14} /> Activate
            </button>
          ) : (
            <button
              onClick={() => {
                setConfirmAction({ kind: "deactivate", staff: menuFor.staff });
                setMenuFor(null);
              }}
              type="button"
            >
              <Ban size={14} /> Deactivate
            </button>
          )}
          <button
            className="danger"
            onClick={() => {
              setConfirmAction({ kind: "delete", staff: menuFor.staff });
              setMenuFor(null);
            }}
            type="button"
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      ) : null}

      {selected && meta ? (
        <StaffPanel
          meta={meta}
          notify={notify}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setWizard({ editing: selected });
            setSelected(null);
          }}
          onResetPw={() => {
            setResetTarget(selected);
            setResetError("");
            setSelected(null);
          }}
          staff={selected}
        />
      ) : null}

      {wizard && meta ? (
        <StaffWizard
          editing={wizard.editing}
          meta={meta}
          onClose={() => setWizard(null)}
          onSaved={(msg) => notify("success", msg)}
        />
      ) : null}

      {resetTarget ? (
        <div className="stf-modal-backdrop" onClick={() => setResetTarget(null)}>
          <div className="stf-modal small" onClick={(e) => e.stopPropagation()}>
            <div className="stf-modal-head">
              <h2>Reset Password</h2>
              <button className="stf-icon-btn" onClick={() => setResetTarget(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <p className="set-note">
              Set a new password for {staffName(resetTarget)} ({resetTarget.email}).
              Share it with them securely — they will use it at the next sign-in.
            </p>
            <label className="set-field">
              <span>New password</span>
              <span className="password-input-shell">
                <input name="stf-reset-password" autoComplete="new-password"
                  className="modal-input"
                  onChange={(e) => setNewPw(e.target.value)}
                  type={showResetPw ? "text" : "password"}
                  value={newPw}
                />
                <button
                  aria-label={showResetPw ? "Hide password" : "Show password"}
                  onClick={() => setShowResetPw((v) => !v)}
                  type="button"
                >
                  {showResetPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            <label className="set-field">
              <span>Confirm new password</span>
              <span className="password-input-shell">
                <input name="stf-reset-confirm" autoComplete="new-password"
                  className="modal-input"
                  onChange={(e) => setConfirmPw(e.target.value)}
                  type={showResetConfirm ? "text" : "password"}
                  value={confirmPw}
                />
                <button
                  aria-label={showResetConfirm ? "Hide password" : "Show password"}
                  onClick={() => setShowResetConfirm((v) => !v)}
                  type="button"
                >
                  {showResetConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </span>
            </label>
            {resetError ? <p className="set-error">{resetError}</p> : null}
            <div className="stf-modal-foot">
              <button className="booking-filter-reset" onClick={() => setResetTarget(null)} type="button">
                Cancel
              </button>
              <button className="booking-create-btn" disabled={resetBusy} onClick={runReset} type="button">
                {resetBusy ? <Loader2 size={15} /> : null} Reset Password
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAction ? (
        <div className="stf-modal-backdrop" onClick={() => setConfirmAction(null)}>
          <div className="stf-modal small" onClick={(e) => e.stopPropagation()}>
            <div className="stf-modal-head">
              <h2>
                {confirmAction.kind === "delete"
                  ? "Delete staff account?"
                  : confirmAction.kind === "deactivate"
                    ? "Deactivate staff account?"
                    : "Activate staff account?"}
              </h2>
              <button className="stf-icon-btn" onClick={() => setConfirmAction(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <p className="set-note">
              {confirmAction.kind === "delete"
                ? `${staffName(confirmAction.staff)} will be permanently deleted and will no longer be able to sign in. This cannot be undone.`
                : confirmAction.kind === "deactivate"
                  ? `${staffName(confirmAction.staff)} will no longer be able to sign in to the dashboard. You can activate the account again later.`
                  : `${staffName(confirmAction.staff)} will be able to sign in to the dashboard again.`}
            </p>
            <div className="stf-modal-foot">
              <button className="booking-filter-reset" onClick={() => setConfirmAction(null)} type="button">
                Cancel
              </button>
              <button className="booking-create-btn" onClick={runConfirm} type="button">
                {confirmAction.kind === "delete"
                  ? "Delete"
                  : confirmAction.kind === "deactivate"
                    ? "Deactivate"
                    : "Activate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
