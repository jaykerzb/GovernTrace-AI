import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from "../api/comments";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { ApiError } from "../api/client";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  SYSTEM_OWNER: "System Owner",
  APPROVER: "Approver",
  VIEWER: "Viewer",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const textareaClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

export function CommentsPanel({ systemId }: { systemId: string }) {
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: comments } = useComments(systemId);
  const createComment = useCreateComment(systemId);
  const updateComment = useUpdateComment(systemId);
  const deleteComment = useDeleteComment(systemId);
  const location = useLocation();

  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightedRef = useRef(false);

  // Deep-links from a notification email land on #comment-<id> — since this
  // is client-side routing (no full page load), the browser's native
  // scroll-to-anchor never fires, so we do it ourselves once the comment
  // list has actually loaded and briefly highlight the target.
  useEffect(() => {
    if (highlightedRef.current || !comments) return;
    const hash = location.hash;
    if (!hash.startsWith("#comment-")) return;
    const id = hash.slice("#comment-".length);
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    highlightedRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    const timer = setTimeout(() => setHighlightedId(null), 2500);
    return () => clearTimeout(timer);
  }, [comments, location.hash]);

  async function handlePost() {
    if (!draft.trim()) return;
    setError(null);
    try {
      await createComment.mutateAsync(draft.trim());
      setDraft("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post this comment.");
    }
  }

  async function handleSaveEdit(id: string) {
    if (!editValue.trim()) return;
    setError(null);
    try {
      await updateComment.mutateAsync({ id, body: editValue.trim() });
      setEditingId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this comment.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteComment.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this comment.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Comments</h2>

      {(!comments || comments.length === 0) && (
        <p className="mb-4 text-sm text-slate-400 dark:text-slate-500">No comments yet.</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="mb-4 space-y-4">
          {comments.map((c) => {
            const canEdit = user?.id === c.authorId;
            const canDelete = canEdit || has("DELETE_ANY_COMMENT");
            const isEditing = editingId === c.id;
            return (
              <li
                key={c.id}
                id={`comment-${c.id}`}
                className={`border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0 -mx-2 px-2 rounded-md transition-colors duration-500 ${
                  highlightedId === c.id ? "bg-amber-50 dark:bg-amber-950/40" : ""
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.author.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{ROLE_LABELS[c.author.role]}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      &middot; {timeAgo(c.createdAt)}
                      {c.editedAt && " (edited)"}
                    </span>
                  </div>
                  {!isEditing && (canEdit || canDelete) && (
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingId(c.id);
                            setEditValue(c.body);
                          }}
                          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
                        >
                          Edit
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deleteComment.isPending}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className={textareaClass} rows={2} />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleSaveEdit(c.id)}
                        disabled={updateComment.isPending}
                        className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{c.body}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          className={textareaClass}
          rows={2}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={createComment.isPending || !draft.trim()}
            className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {createComment.isPending ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
