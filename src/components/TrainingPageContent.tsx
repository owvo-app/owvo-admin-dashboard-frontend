"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Video,
} from "lucide-react";
import {
  AdminTrainingModule,
  createTrainingModule,
  deactivateTrainingModule,
  getAdminTrainingModules,
  getTrainingCompletionOverview,
  replaceTrainingModuleVideo,
  reorderTrainingModules,
  resetProviderTraining,
  updateTrainingModule,
} from "@/lib/admin-api";

function getApiErrorMessage(error: unknown) {
  const anyError = error as { response?: { data?: { message?: string } }; message?: string };
  return anyError?.response?.data?.message || anyError?.message || "Something went wrong.";
}

function relativeDate(value?: string) {
  if (!value) return "—";
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "—";
  }
}

/** Client ke "Completion date: Date/Time" ke liye — exact, relative nahi. */
function exactDateTime(value?: string) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

const statusLabels: Record<string, string> = {
  completed: "✓ Completed",
  in_progress: "In Progress",
  not_started: "Not Started",
};

function formatDuration(seconds?: number | null) {
  if (!seconds && seconds !== 0) return "—:—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

type Tab = "modules" | "progress";

export function TrainingPageContent() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("modules");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingModule, setEditingModule] = useState<AdminTrainingModule | null>(null);
  const [replacingVideoFor, setReplacingVideoFor] = useState<AdminTrainingModule | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const modulesQuery = useQuery({
    queryKey: ["admin-training-modules"],
    queryFn: getAdminTrainingModules,
  });

  const progressQuery = useQuery({
    queryKey: ["admin-training-completion"],
    queryFn: getTrainingCompletionOverview,
    enabled: tab === "progress",
  });

  const modules = useMemo(
    () => (modulesQuery.data ?? []).slice().sort((a, b) => a.order - b.order),
    [modulesQuery.data]
  );

  const invalidateModules = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-training-modules"] });

  const createMutation = useMutation({
    mutationFn: createTrainingModule,
    onSuccess: () => {
      invalidateModules();
      setShowAddForm(false);
      setMutationError(null);
    },
    onError: (error) => setMutationError(getApiErrorMessage(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateTrainingModule>[1] }) =>
      updateTrainingModule(id, payload),
    onSuccess: () => {
      invalidateModules();
      setEditingModule(null);
      setMutationError(null);
    },
    onError: (error) => setMutationError(getApiErrorMessage(error)),
  });

  const replaceVideoMutation = useMutation({
    mutationFn: ({ id, video }: { id: string; video: File }) => replaceTrainingModuleVideo(id, video),
    onSuccess: () => {
      invalidateModules();
      setReplacingVideoFor(null);
      setMutationError(null);
    },
    onError: (error) => setMutationError(getApiErrorMessage(error)),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderTrainingModules,
    onSuccess: invalidateModules,
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateTrainingModule,
    onSuccess: invalidateModules,
  });

  const resetMutation = useMutation({
    mutationFn: resetProviderTraining,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-training-completion"] }),
  });

  function moveModule(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const reordered = modules.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved);
    reorderMutation.mutate(reordered.map((m) => m._id));
  }

  return (
    <section className="data-page">
      <div className="data-page-header">
        <div>
          <h1>Training</h1>
          <p>Provider Academy videos — upload, reorder, and track who has completed each module.</p>
        </div>
        {tab === "modules" ? (
          <button className="header-action-button" onClick={() => setShowAddForm(true)} type="button">
            <Plus size={16} />
            Add module
          </button>
        ) : null}
      </div>

      <div className="page-tabs">
        <button
          className={tab === "modules" ? "page-tab active" : "page-tab"}
          onClick={() => setTab("modules")}
          type="button"
        >
          Modules
        </button>
        <button
          className={tab === "progress" ? "page-tab active" : "page-tab"}
          onClick={() => setTab("progress")}
          type="button"
        >
          Provider progress
        </button>
      </div>

      {tab === "modules" ? (
        <div className="training-module-list">
          {modulesQuery.isLoading ? <p>Loading modules…</p> : null}
          {modulesQuery.isError ? (
            <p className="form-error">{getApiErrorMessage(modulesQuery.error)}</p>
          ) : null}
          {!modulesQuery.isLoading && modules.length === 0 ? (
            <div className="training-empty-state">
              <GraduationCap size={28} />
              <p>No training modules yet. Add your first one above.</p>
            </div>
          ) : null}

          {modules.map((module, index) => (
            <div className="training-module-card" key={module._id}>
              <div className="training-module-order">
                <button
                  disabled={index === 0 || reorderMutation.isPending}
                  onClick={() => moveModule(index, -1)}
                  type="button"
                  aria-label="Move up"
                >
                  <ChevronUp size={16} />
                </button>
                <span className="training-module-order-badge">{index + 1}</span>
                <button
                  disabled={index === modules.length - 1 || reorderMutation.isPending}
                  onClick={() => moveModule(index, 1)}
                  type="button"
                  aria-label="Move down"
                >
                  <ChevronDown size={16} />
                </button>
              </div>

              <video
                className="training-module-thumb"
                controls
                preload="metadata"
                src={module.videoUrl}
              />

              <div className="training-module-body">
                <div className="training-module-title-row">
                  <h3>{module.title}</h3>
                  {module.isMandatory ? (
                    <span className="table-status approved">Mandatory</span>
                  ) : (
                    <span className="table-status">Optional</span>
                  )}
                  {!module.isActive ? <span className="table-status rejected">Hidden</span> : null}
                </div>
                <span className="training-module-duration">
                  {formatDuration(module.durationSeconds)} runtime
                  {module.trainingVersion ? ` · v${module.trainingVersion}` : ""}
                </span>
                {module.description ? (
                  <p className="training-module-description">{module.description}</p>
                ) : null}
                {module.topics.length ? (
                  <ul className="training-module-topics">
                    {module.topics.map((topic, i) => (
                      <li key={i}>{topic}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="training-module-actions">
                <button className="table-action" onClick={() => setEditingModule(module)} type="button">
                  <Pencil size={14} />
                  Edit
                </button>
                <button
                  className="table-action"
                  onClick={() => setReplacingVideoFor(module)}
                  type="button"
                >
                  <Video size={14} />
                  Replace video
                </button>
                <button
                  className="table-action danger"
                  disabled={deactivateMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Remove "${module.title}" from the app?`)) {
                      deactivateMutation.mutate(module._id);
                    }
                  }}
                  type="button"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <TableShell>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Status</th>
                <th>Completed</th>
                <th>Completion date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(progressQuery.data?.providers ?? []).map((entry) => (
                <tr key={entry.provider._id}>
                  <td>{entry.provider.name || entry.provider.email || "Unknown"}</td>
                  <td>
                    <span
                      className={
                        entry.status === "completed"
                          ? "table-status approved"
                          : entry.status === "in_progress"
                            ? "table-status pending"
                            : "table-status"
                      }
                    >
                      {statusLabels[entry.status] ?? entry.status}
                    </span>
                  </td>
                  <td>
                    {entry.completedCount} / {entry.totalModules}
                  </td>
                  <td title={relativeDate(entry.lastActivityAt)}>
                    {entry.status === "completed"
                      ? exactDateTime(entry.lastActivityAt)
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="table-action"
                      disabled={resetMutation.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reset training for ${entry.provider.name || "this provider"}? They will need to watch every module again.`
                          )
                        ) {
                          resetMutation.mutate(entry.provider._id);
                        }
                      }}
                      type="button"
                    >
                      <RotateCcw size={14} />
                      Reset training
                    </button>
                  </td>
                </tr>
              ))}
              {!progressQuery.isLoading && (progressQuery.data?.providers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5}>No providers have started training yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </TableShell>
      )}

      {showAddForm ? (
        <AddModuleModal
          error={mutationError}
          isSaving={createMutation.isPending}
          onCancel={() => {
            setShowAddForm(false);
            setMutationError(null);
          }}
          onSubmit={(payload) => createMutation.mutate(payload)}
        />
      ) : null}

      {editingModule ? (
        <EditModuleModal
          error={mutationError}
          isSaving={updateMutation.isPending}
          module={editingModule}
          onCancel={() => {
            setEditingModule(null);
            setMutationError(null);
          }}
          onSubmit={(payload) => updateMutation.mutate({ id: editingModule._id, payload })}
        />
      ) : null}

      {replacingVideoFor ? (
        <ReplaceVideoModal
          error={mutationError}
          isSaving={replaceVideoMutation.isPending}
          moduleTitle={replacingVideoFor.title}
          onCancel={() => {
            setReplacingVideoFor(null);
            setMutationError(null);
          }}
          onSubmit={(video) => replaceVideoMutation.mutate({ id: replacingVideoFor._id, video })}
        />
      ) : null}
    </section>
  );
}

function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="table-card">{children}</div>;
}

function ModalShell({
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
      <div className="training-modal-panel" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AddModuleModal({
  onCancel,
  onSubmit,
  isSaving,
  error,
}: {
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    topics: string[];
    isMandatory: boolean;
    video: File;
  }) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicsText, setTopicsText] = useState("");
  const [isMandatory, setIsMandatory] = useState(true);
  const [video, setVideo] = useState<File | null>(null);

  return (
    <ModalShell onCancel={onCancel} title="Add training module">
      <label className="form-field">
        Title
        <input onChange={(e) => setTitle(e.target.value)} type="text" value={title} />
      </label>
      <label className="form-field">
        Short description
        <textarea
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One or two sentences shown under the title"
          rows={2}
          value={description}
        />
      </label>
      <label className="form-field">
        Topics (one per line)
        <textarea onChange={(e) => setTopicsText(e.target.value)} rows={4} value={topicsText} />
      </label>
      <label className="check-label">
        <input
          checked={isMandatory}
          onChange={(e) => setIsMandatory(e.target.checked)}
          type="checkbox"
        />
        Mandatory before providers can go online
      </label>
      <label className="form-field">
        Video file
        <input
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={isSaving || !title.trim() || !video}
          onClick={() =>
            video &&
            onSubmit({
              title: title.trim(),
              description: description.trim(),
              topics: topicsText
                .split("\n")
                .map((t) => t.trim())
                .filter(Boolean),
              isMandatory,
              video,
            })
          }
          type="button"
        >
          {isSaving ? "Uploading…" : "Create module"}
        </button>
      </div>
    </ModalShell>
  );
}

function EditModuleModal({
  module,
  onCancel,
  onSubmit,
  isSaving,
  error,
}: {
  module: AdminTrainingModule;
  onCancel: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    topics: string[];
    isMandatory: boolean;
    isActive: boolean;
    trainingVersion: string;
  }) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? "");
  const [topicsText, setTopicsText] = useState(module.topics.join("\n"));
  const [isMandatory, setIsMandatory] = useState(module.isMandatory);
  const [isActive, setIsActive] = useState(module.isActive);
  const [trainingVersion, setTrainingVersion] = useState(
    module.trainingVersion ?? "1.0"
  );

  return (
    <ModalShell onCancel={onCancel} title="Edit module">
      <label className="form-field">
        Title
        <input onChange={(e) => setTitle(e.target.value)} type="text" value={title} />
      </label>
      <label className="form-field">
        Short description
        <textarea
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One or two sentences shown under the title"
          rows={2}
          value={description}
        />
      </label>
      <label className="form-field">
        Topics (one per line)
        <textarea onChange={(e) => setTopicsText(e.target.value)} rows={4} value={topicsText} />
      </label>
      <label className="check-label">
        <input
          checked={isMandatory}
          onChange={(e) => setIsMandatory(e.target.checked)}
          type="checkbox"
        />
        Mandatory before providers can go online
      </label>
      <label className="check-label">
        <input checked={isActive} onChange={(e) => setIsActive(e.target.checked)} type="checkbox" />
        Visible to providers
      </label>
      <label className="form-field">
        Training version
        <input onChange={(e) => setTrainingVersion(e.target.value)} type="text" value={trainingVersion} />
      </label>
      <p className="verification-details-subtext">
        Bump this when you significantly revise the content — providers who completed an
        older version will still show as completed, but admin can see which version they saw.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={isSaving || !title.trim()}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              description: description.trim(),
              topics: topicsText
                .split("\n")
                .map((t) => t.trim())
                .filter(Boolean),
              isMandatory,
              isActive,
              trainingVersion: trainingVersion.trim() || "1.0",
            })
          }
          type="button"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </ModalShell>
  );
}

function ReplaceVideoModal({
  moduleTitle,
  onCancel,
  onSubmit,
  isSaving,
  error,
}: {
  moduleTitle: string;
  onCancel: () => void;
  onSubmit: (video: File) => void;
  isSaving: boolean;
  error: string | null;
}) {
  const [video, setVideo] = useState<File | null>(null);

  return (
    <ModalShell onCancel={onCancel} title={`Replace video — ${moduleTitle}`}>
      <p>Providers will see the new video the next time they open training.</p>
      <label className="form-field">
        New video file
        <input
          accept="video/*"
          onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
          type="file"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="modal-actions">
        <button className="secondary-button" disabled={isSaving} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={isSaving || !video}
          onClick={() => video && onSubmit(video)}
          type="button"
        >
          {isSaving ? "Uploading…" : "Replace video"}
        </button>
      </div>
    </ModalShell>
  );
}