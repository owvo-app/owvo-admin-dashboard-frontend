"use client";

import { useDashboardUser } from "@/hooks/useDashboardUser";
import {
  checkAdminServiceAreaCoverage,
  createAdminServiceArea,
  deleteAdminServiceArea,
  getAdminServiceAreas,
  updateAdminServiceArea,
  type ServiceAreaCoverageCheck,
  type ServiceAreaItem,
} from "@/lib/admin-api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

type AreaForm = { city: string; areaName: string; postcode: string };

const EMPTY_FORM: AreaForm = { city: "", areaName: "", postcode: "" };

function errText(e: unknown, fallback: string) {
  const anyE = e as { response?: { data?: { message?: string } }; message?: string };
  return anyE?.response?.data?.message || anyE?.message || fallback;
}

export function ServiceAreasPageContent() {
  const user = useDashboardUser();
  const canEdit = user?.role === "admin";
  const queryClient = useQueryClient();

  const areasQuery = useQuery({
    queryKey: ["admin-service-areas"],
    queryFn: getAdminServiceAreas,
  });

  const [notice, setNotice] = useState("");
  const [checkPostcode, setCheckPostcode] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkResult, setCheckResult] = useState<ServiceAreaCoverageCheck | null>(null);
  const [checkError, setCheckError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceAreaItem | null>(null);
  const [form, setForm] = useState<AreaForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formBusy, setFormBusy] = useState(false);

  // Postcode madad (postcodes.io — free, koi key nahi): type karne par
  // suggestions + jagah ki tasdeeq ke liye map preview. Ye sirf madad
  // hai — service band ho to bhi form pehle ki tarah chalta hai.
  type PcPlace = { lat: number; lng: number; label: string };
  const [pcPlace, setPcPlace] = useState<PcPlace | null>(null);
  const [pcSuggestions, setPcSuggestions] = useState<string[]>([]);
  const [pcDistrict, setPcDistrict] = useState("");
  const pcSeq = useRef(0);
  const pcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetPc = () => {
    pcSeq.current += 1;
    if (pcTimer.current) clearTimeout(pcTimer.current);
    setPcPlace(null);
    setPcSuggestions([]);
    setPcDistrict("");
  };

  const resolvePcPlace = async (raw: string, seq: number) => {
    const v = raw.trim().toUpperCase().replace(/\s+/g, " ");
    const compact = v.replace(/\s/g, "");
    try {
      if (/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(v)) {
        const r = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(v)}`
        );
        const j = await r.json();
        if (pcSeq.current !== seq) return;
        if (j?.result) {
          setPcPlace({
            lat: j.result.latitude,
            lng: j.result.longitude,
            label: `${j.result.outcode} \u00b7 ${j.result.admin_district}`,
          });
          setPcDistrict(j.result.outcode || "");
        } else {
          setPcPlace(null);
        }
      } else if (/^[A-Z]{1,2}\d[A-Z\d]?$/.test(compact)) {
        const r = await fetch(
          `https://api.postcodes.io/outcodes/${encodeURIComponent(compact)}`
        );
        const j = await r.json();
        if (pcSeq.current !== seq) return;
        if (j?.result) {
          const districts: string[] = j.result.admin_district || [];
          setPcPlace({
            lat: j.result.latitude,
            lng: j.result.longitude,
            label: `${compact} district \u00b7 ${districts[0] || ""}`,
          });
          setPcDistrict(compact);
        } else {
          setPcPlace(null);
          setPcDistrict("");
        }
      } else {
        setPcPlace(null);
      }
    } catch {
      // khamosh — map/suggestion na aye to bhi form chalta hai
    }
  };

  const lookupPostcode = (raw: string) => {
    const v = raw.trim().toUpperCase();
    if (pcTimer.current) clearTimeout(pcTimer.current);
    if (v.length < 2) {
      setPcSuggestions([]);
      setPcDistrict("");
      setPcPlace(null);
      return;
    }
    pcTimer.current = setTimeout(() => {
      const seq = ++pcSeq.current;
      fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(v)}/autocomplete`
      )
        .then((r) => r.json())
        .then((j) => {
          if (pcSeq.current === seq) {
            setPcSuggestions(Array.isArray(j?.result) ? j.result.slice(0, 8) : []);
          }
        })
        .catch(() => {});
      void resolvePcPlace(v, seq);
    }, 350);
  };

  const pickPc = (value: string) => {
    setForm((f) => ({ ...f, postcode: value }));
    setPcSuggestions([]);
    const seq = ++pcSeq.current;
    void resolvePcPlace(value, seq);
  };

  const [pauseTarget, setPauseTarget] = useState<ServiceAreaItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceAreaItem | null>(null);
  const [rowBusy, setRowBusy] = useState("");

  const items = areasQuery.data?.items ?? [];
  const restricted = areasQuery.data?.restricted ?? false;
  const anyActive = items.some((a) => a.isActive);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-service-areas"] });

  const runCheck = async () => {
    const pc = checkPostcode.trim();
    if (!pc) {
      setCheckError("Enter a full postcode first, e.g. BR6 2AB.");
      setCheckResult(null);
      return;
    }
    setCheckBusy(true);
    setCheckError("");
    try {
      const { result } = await checkAdminServiceAreaCoverage(pc);
      setCheckResult(result);
    } catch (e) {
      setCheckResult(null);
      setCheckError(errText(e, "Could not check coverage. Please try again."));
    } finally {
      setCheckBusy(false);
    }
  };

  const openAdd = () => {
    resetPc();
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (area: ServiceAreaItem) => {
    resetPc();
    if (area.postcode) {
      const seq = ++pcSeq.current;
      void resolvePcPlace(area.postcode, seq);
    }
    setEditing(area);
    setForm({ city: area.city, areaName: area.areaName, postcode: area.postcode });
    setFormError("");
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.city.trim() || !form.areaName.trim()) {
      setFormError("City and area name are required.");
      return;
    }
    setFormBusy(true);
    setFormError("");
    try {
      const payload = {
        city: form.city.trim(),
        areaName: form.areaName.trim(),
        postcode: form.postcode.trim(),
      };
      const res = editing
        ? await updateAdminServiceArea(editing._id, payload)
        : await createAdminServiceArea(payload);
      setNotice(res.message || "Saved.");
      setFormOpen(false);
      refresh();
    } catch (e) {
      setFormError(errText(e, "Could not save the area. Please try again."));
    } finally {
      setFormBusy(false);
    }
  };

  const setActive = async (area: ServiceAreaItem, next: boolean) => {
    setRowBusy(area._id);
    try {
      const res = await updateAdminServiceArea(area._id, { isActive: next });
      setNotice(res.message || "Saved.");
      refresh();
    } catch (e) {
      setNotice(errText(e, "Could not change the area status."));
    } finally {
      setRowBusy("");
      setPauseTarget(null);
    }
  };

  const onToggle = (area: ServiceAreaItem) => {
    if (!canEdit || rowBusy) return;
    if (area.isActive) {
      setPauseTarget(area);
    } else {
      void setActive(area, true);
    }
  };

  const runDelete = async () => {
    if (!deleteTarget) return;
    setRowBusy(deleteTarget._id);
    try {
      await deleteAdminServiceArea(deleteTarget._id);
      setNotice("Service area deleted.");
      refresh();
    } catch (e) {
      setNotice(errText(e, "Could not delete the area."));
    } finally {
      setRowBusy("");
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="sa-toolbar">
        <div>
          <h2 className="sa-title">Service Areas</h2>
          <p className="sa-sub">Choose where providers can accept bookings.</p>
        </div>
        {canEdit ? (
          <button type="button" className="sa-add-btn" onClick={openAdd}>
            <Plus size={16} /> Add area
          </button>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="sa-note">Only admins can change service areas. You can view the list and check coverage.</p>
      ) : null}

      {areasQuery.data && !restricted ? (
        <p className="sa-note">
          No restriction is in effect yet: until an area is switched on, bookings stay
          open everywhere, exactly as today. Areas start inactive when added.
        </p>
      ) : null}
      {areasQuery.data && restricted && !anyActive ? (
        <p className="sa-note sa-note-warn">
          Areas exist but none is Active right now — that means no provider can take
          new bookings anywhere. Activate an area to open bookings there.
        </p>
      ) : null}

      <div className="sa-check-card">
        <div className="sa-check-row">
          <input
            className="modal-input sa-check-input"
            placeholder="Enter a postcode"
            value={checkPostcode}
            onChange={(e) => setCheckPostcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runCheck();
            }}
          />
          <button
            type="button"
            className="sa-check-btn"
            onClick={() => void runCheck()}
            disabled={checkBusy}
          >
            {checkBusy ? <Loader2 size={16} className="sa-spin" /> : <Search size={16} />}
            Check coverage
          </button>
        </div>
        {checkError ? <p className="sa-check-error">{checkError}</p> : null}
        {checkResult ? (
          <p
            className={`sa-check-result ${
              checkResult.status === "active"
                ? "sa-ok"
                : checkResult.status === "inactive"
                  ? "sa-warn"
                  : "sa-muted"
            }`}
          >
            {checkResult.status === "active"
              ? `${checkResult.postcode} is covered — ${checkResult.area?.postcode} (${checkResult.area?.areaName}, ${checkResult.area?.city}) is Active.`
              : checkResult.status === "inactive"
                ? `${checkResult.postcode} is not open yet — ${checkResult.area?.postcode} (${checkResult.area?.areaName}, ${checkResult.area?.city}) is Inactive.`
                : `${checkResult.postcode} is not in any service area.`}
          </p>
        ) : null}
      </div>

      {notice ? <p className="sa-notice">{notice}</p> : null}

      {areasQuery.isLoading ? (
        <div className="empty-state">
          <Loader2 size={22} className="sa-spin" /> Loading service areas...
        </div>
      ) : areasQuery.isError && !areasQuery.data ? (
        <div className="error-state">
          <p>We could not load service areas. Check your connection and try again.</p>
          <button type="button" className="sa-check-btn" onClick={() => void areasQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <MapPin size={22} />
          <p>
            No service areas yet. Add the first area to start controlling where
            bookings can be taken.
          </p>
        </div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table">
            <thead>
              <tr>
                <th>City</th>
                <th>Area</th>
                <th>Postcode</th>
                <th>Status</th>
                <th>Customer waitlist</th>
                <th>Provider waitlist</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((area) => (
                <tr key={area._id}>
                  <td>{area.city}</td>
                  <td>{area.areaName}</td>
                  <td>{area.postcode || "—"}</td>
                  <td>
                    <button
                      type="button"
                      className={`sa-switch ${area.isActive ? "sa-on" : ""}`}
                      onClick={() => onToggle(area)}
                      disabled={!canEdit || rowBusy === area._id}
                      aria-label={`${area.postcode || area.areaName} active toggle`}
                    >
                      <span className="sa-knob" />
                    </button>
                    <span className="sa-status-text">
                      {rowBusy === area._id ? "Saving..." : area.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{area.customerWaitlist || "—"}</td>
                  <td>{area.providerWaitlist || "—"}</td>
                  {canEdit ? (
                    <td>
                      <div className="sa-actions">
                        <button type="button" className="sa-icon-btn" onClick={() => openEdit(area)} aria-label="Edit area">
                          <Pencil size={15} />
                        </button>
                        <button type="button" className="sa-icon-btn" onClick={() => setDeleteTarget(area)} aria-label="Delete area">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="sa-foot">Coverage is based on the provider&apos;s approved wash address.</p>

      {formOpen ? (
        <div className="sa-modal-backdrop" onClick={() => !formBusy && setFormOpen(false)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? "Edit area" : "Add area"}</h3>
            <label className="sa-field">
              <span>City</span>
              <input
                className="modal-input"
                placeholder="e.g. London"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <label className="sa-field">
              <span>Area name</span>
              <input
                className="modal-input"
                placeholder="e.g. South East London"
                value={form.areaName}
                onChange={(e) => setForm({ ...form, areaName: e.target.value })}
              />
            </label>
            <div className="sa-field">
              <span>Postcode (district or full)</span>
              <input
                className="modal-input"
                placeholder="e.g. BR5 or BR5 3DA — leave empty for a placeholder"
                value={form.postcode}
                onChange={(e) => {
                  setForm({ ...form, postcode: e.target.value });
                  lookupPostcode(e.target.value);
                }}
              />
              {pcDistrict || pcSuggestions.length ? (
                <div className="sa-suggest">
                  {pcDistrict &&
                  form.postcode.trim().toUpperCase().replace(/\s/g, "") !==
                    pcDistrict ? (
                    <button
                      type="button"
                      className="sa-suggest-item"
                      onClick={() => pickPc(pcDistrict)}
                    >
                      <strong>{pcDistrict}</strong> — whole district
                    </button>
                  ) : null}
                  {pcSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="sa-suggest-item"
                      onClick={() => pickPc(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
              {pcPlace ? (
                <div className="sa-map-wrap">
                  <iframe
                    title="Area map preview"
                    className="sa-map"
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${pcPlace.lng - 0.035},${pcPlace.lat - 0.018},${pcPlace.lng + 0.035},${pcPlace.lat + 0.018}&layer=mapnik&marker=${pcPlace.lat},${pcPlace.lng}`}
                  />
                  <p className="sa-map-caption">
                    {pcPlace.label} — check the map shows the area you mean
                    before saving.
                  </p>
                </div>
              ) : null}
            </div>
            <p className="sa-hint">New areas start Inactive. Switch them on from the list when you are ready to launch.</p>
            {formError ? <p className="sa-check-error">{formError}</p> : null}
            <div className="sa-modal-actions">
              <button type="button" className="sa-btn-ghost" onClick={() => setFormOpen(false)} disabled={formBusy}>
                Cancel
              </button>
              <button type="button" className="sa-add-btn" onClick={() => void saveForm()} disabled={formBusy}>
                {formBusy ? <Loader2 size={16} className="sa-spin" /> : null}
                {editing ? "Save changes" : "Add area"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pauseTarget ? (
        <div className="sa-modal-backdrop" onClick={() => setPauseTarget(null)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Pause {pauseTarget.postcode || pauseTarget.areaName}?</h3>
            <p className="sa-hint">
              New bookings in this area will stop. Existing confirmed bookings are
              not affected.
            </p>
            <div className="sa-modal-actions">
              <button type="button" className="sa-btn-ghost" onClick={() => setPauseTarget(null)}>
                Keep active
              </button>
              <button
                type="button"
                className="sa-btn-danger"
                onClick={() => void setActive(pauseTarget, false)}
                disabled={rowBusy === pauseTarget._id}
              >
                {rowBusy === pauseTarget._id ? <Loader2 size={16} className="sa-spin" /> : null}
                Pause area
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="sa-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {deleteTarget.postcode || deleteTarget.areaName}?</h3>
            <p className="sa-hint">
              This removes the area from the list.
              {deleteTarget.isActive
                ? " It is currently Active, so new bookings there will stop. Existing confirmed bookings are not affected."
                : ""}
            </p>
            <div className="sa-modal-actions">
              <button type="button" className="sa-btn-ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="sa-btn-danger"
                onClick={() => void runDelete()}
                disabled={rowBusy === deleteTarget._id}
              >
                {rowBusy === deleteTarget._id ? <Loader2 size={16} className="sa-spin" /> : null}
                Delete area
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
