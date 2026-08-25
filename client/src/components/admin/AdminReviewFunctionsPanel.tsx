import { useState, type FormEvent } from "react";
import {
  useAdminReviewFunctions,
  useCreateReviewFunction,
  useUpdateReviewFunction,
  useCreateSection,
  useUpdateSection,
  useCreateQuestion,
  useUpdateQuestion,
  type ReviewFunctionDef,
  type ReviewFunctionSection,
  type ReviewFunctionQuestion,
  type Triggers,
} from "../../api/reviewFunctions";
import { TriggerEditor } from "./TriggerEditor";
import { ApiError } from "../../api/client";

const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

const EMPTY_TRIGGERS: Triggers = { deliveryModels: [], capabilityTiers: [], riskFactors: [] };

function StatusPill({ isActive }: { isActive: boolean }) {
  if (isActive) return null;
  return (
    <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
      Inactive
    </span>
  );
}

function QuestionRow({ sectionKey, question }: { sectionKey: string; question: ReviewFunctionQuestion }) {
  const updateQuestion = useUpdateQuestion();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [citation, setCitation] = useState(question.citation);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await updateQuestion.mutateAsync({ key: question.id, text, citation });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  if (editing) {
    return (
      <li className="space-y-2 border-b border-slate-100 dark:border-slate-800 py-2">
        <input value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        <input value={citation} onChange={(e) => setCitation(e.target.value)} placeholder="Citation" className={inputClass} />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateQuestion.isPending}
            className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-2">
      <div className="min-w-0">
        <p className={`text-sm ${question.isActive ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-500"}`}>
          {question.text}
        </p>
        {question.citation && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{question.citation}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill isActive={question.isActive} />
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline">
          Edit
        </button>
        <button
          onClick={() => updateQuestion.mutate({ key: question.id, isActive: !question.isActive })}
          disabled={updateQuestion.isPending}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
        >
          {question.isActive ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </li>
  );
}

function AddQuestionForm({ sectionKey, onDone }: { sectionKey: string; onDone: () => void }) {
  const createQuestion = useCreateQuestion();
  const [text, setText] = useState("");
  const [citation, setCitation] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createQuestion.mutateAsync({ sectionKey, text, citation });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this question.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-b border-slate-100 dark:border-slate-800 py-2">
      <input required placeholder="Question text" value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
      <input placeholder="Citation (optional)" value={citation} onChange={(e) => setCitation(e.target.value)} className={inputClass} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createQuestion.isPending}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {createQuestion.isPending ? "Adding..." : "Add Question"}
        </button>
        <button type="button" onClick={onDone} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

function SectionCard({ functionKey, section }: { functionKey: string; section: ReviewFunctionSection }) {
  const updateSection = useUpdateSection();
  const [expanded, setExpanded] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);
  const [editingTriggers, setEditingTriggers] = useState(false);
  const [triggers, setTriggers] = useState<Triggers>(section.triggers);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveTitle() {
    setError(null);
    try {
      await updateSection.mutateAsync({ key: section.id, title });
      setEditingTitle(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  async function handleSaveTriggers() {
    setError(null);
    try {
      await updateSection.mutateAsync({ key: section.id, triggers });
      setEditingTriggers(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <div className="space-y-2">
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveTitle}
                  className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
                >
                  Save
                </button>
                <button onClick={() => setEditingTitle(false)} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setExpanded((e) => !e)} className="text-left">
              <p className={`text-sm font-medium ${section.isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>
                {expanded ? "▾" : "▸"} {section.title}
              </p>
              <p className="mt-0.5 pl-3.5 text-xs text-slate-400 dark:text-slate-500">
                {section.triggerLabel || "Custom scope"} · {section.questions.length} question
                {section.questions.length === 1 ? "" : "s"}
              </p>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill isActive={section.isActive} />
          {!editingTitle && (
            <button onClick={() => setEditingTitle(true)} className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline">
              Rename
            </button>
          )}
          <button
            onClick={() => updateSection.mutate({ key: section.id, isActive: !section.isActive })}
            disabled={updateSection.isPending}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
          >
            {section.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 p-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <button
              onClick={() => setEditingTriggers((s) => !s)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
            >
              {editingTriggers ? "Hide Scope Editor" : "Edit Scope"}
            </button>
            {editingTriggers && (
              <div className="mt-2 space-y-2">
                <TriggerEditor value={triggers} onChange={setTriggers} />
                <button
                  onClick={handleSaveTriggers}
                  disabled={updateSection.isPending}
                  className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
                >
                  Save Scope
                </button>
              </div>
            )}
          </div>

          <ul>
            {section.questions.map((q) => (
              <QuestionRow key={q.id} sectionKey={section.id} question={q} />
            ))}
          </ul>

          {showAddQuestion ? (
            <AddQuestionForm sectionKey={section.id} onDone={() => setShowAddQuestion(false)} />
          ) : (
            <button
              onClick={() => setShowAddQuestion(true)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
            >
              + Add Question
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddSectionForm({ functionKey, onDone }: { functionKey: string; onDone: () => void }) {
  const createSection = useCreateSection();
  const [title, setTitle] = useState("");
  const [triggers, setTriggers] = useState<Triggers>(EMPTY_TRIGGERS);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createSection.mutateAsync({ functionKey, title, triggers });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this section.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
      <input required placeholder="Section title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      <TriggerEditor value={triggers} onChange={setTriggers} />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createSection.isPending}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {createSection.isPending ? "Adding..." : "Add Section"}
        </button>
        <button type="button" onClick={onDone} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

function FunctionCard({ fn }: { fn: ReviewFunctionDef }) {
  const updateFunction = useUpdateReviewFunction();
  const [expanded, setExpanded] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(fn.label);
  const [editingTriggers, setEditingTriggers] = useState(false);
  const [triggers, setTriggers] = useState<Triggers>(fn.triggers);
  const [showAddSection, setShowAddSection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSaveLabel() {
    setError(null);
    try {
      await updateFunction.mutateAsync({ key: fn.id, label });
      setEditingLabel(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  async function handleSaveTriggers() {
    setError(null);
    try {
      await updateFunction.mutateAsync({ key: fn.id, triggers });
      setEditingTriggers(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  const totalQuestions = fn.sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          {editingLabel ? (
            <div className="space-y-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveLabel}
                  className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
                >
                  Save
                </button>
                <button onClick={() => setEditingLabel(false)} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setExpanded((e) => !e)} className="text-left">
              <p className={`text-sm font-semibold ${fn.isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}>
                {expanded ? "▾" : "▸"} {fn.label}
              </p>
              <p className="mt-0.5 pl-3.5 text-xs text-slate-400 dark:text-slate-500">
                {fn.sections.length} section{fn.sections.length === 1 ? "" : "s"} · {totalQuestions} question
                {totalQuestions === 1 ? "" : "s"}
              </p>
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusPill isActive={fn.isActive} />
          {!editingLabel && (
            <button onClick={() => setEditingLabel(true)} className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline">
              Rename
            </button>
          )}
          <button
            onClick={() => updateFunction.mutate({ key: fn.id, isActive: !fn.isActive })}
            disabled={updateFunction.isPending}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
          >
            {fn.isActive ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 p-4">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <button
              onClick={() => setEditingTriggers((s) => !s)}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
            >
              {editingTriggers ? "Hide Scope Editor" : "Edit Scope (when this function applies to a system)"}
            </button>
            {editingTriggers && (
              <div className="mt-2 space-y-2">
                <TriggerEditor value={triggers} onChange={setTriggers} />
                <button
                  onClick={handleSaveTriggers}
                  disabled={updateFunction.isPending}
                  className="rounded-md bg-slate-900 dark:bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
                >
                  Save Scope
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {fn.sections.map((s) => (
              <SectionCard key={s.id} functionKey={fn.id} section={s} />
            ))}
          </div>

          {showAddSection ? (
            <AddSectionForm functionKey={fn.id} onDone={() => setShowAddSection(false)} />
          ) : (
            <button
              onClick={() => setShowAddSection(true)}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              + Add Section
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AddFunctionForm({ onDone }: { onDone: () => void }) {
  const createFunction = useCreateReviewFunction();
  const [label, setLabel] = useState("");
  const [triggers, setTriggers] = useState<Triggers>(EMPTY_TRIGGERS);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createFunction.mutateAsync({ label, triggers });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this review function.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
      <input
        required
        placeholder='Team name, e.g. "Third-Party Risk"'
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className={inputClass}
      />
      <TriggerEditor value={triggers} onChange={setTriggers} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createFunction.isPending}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {createFunction.isPending ? "Adding..." : "Add Review Function"}
        </button>
        <button type="button" onClick={onDone} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AdminReviewFunctionsPanel() {
  const { data: functions, isLoading } = useAdminReviewFunctions();
  const [showAddFunction, setShowAddFunction] = useState(false);

  if (isLoading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          These are the review teams whose work papers get auto-scoped onto a system based on its risk classification.
          Changes only apply going forward — existing work papers keep the sections/questions they were built with.
          Deactivating hides something from new work papers without breaking history.
        </p>
        <button
          onClick={() => setShowAddFunction((s) => !s)}
          className="shrink-0 rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
        >
          {showAddFunction ? "Cancel" : "+ Add Review Function"}
        </button>
      </div>

      {showAddFunction && <AddFunctionForm onDone={() => setShowAddFunction(false)} />}

      <div className="space-y-3">
        {functions?.map((fn) => (
          <FunctionCard key={fn.id} fn={fn} />
        ))}
      </div>
    </div>
  );
}
