import { useState, type FormEvent } from "react";
import { useAdminRiskQuestions, useCreateRiskQuestion, useUpdateRiskQuestion } from "../../api/riskQuestions";
import { ApiError } from "../../api/client";
import type { QuestionOption } from "../../api/types";

const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

function emptyOptions(dimension: 1 | 2): QuestionOption[] {
  return dimension === 1
    ? [
        { label: "No", points: 0 },
        { label: "Yes", points: 1 },
      ]
    : [
        { label: "", points: 1 },
        { label: "", points: 3 },
        { label: "", points: 5 },
      ];
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: QuestionOption[];
  onChange: (options: QuestionOption[]) => void;
}) {
  function updateOption(i: number, patch: Partial<QuestionOption>) {
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }
  function removeOption(i: number) {
    onChange(options.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            required
            placeholder="Option label"
            value={o.label}
            onChange={(e) => updateOption(i, { label: e.target.value })}
            className={`${inputClass} flex-1`}
          />
          <input
            required
            type="number"
            min={0}
            placeholder="Points"
            value={o.points}
            onChange={(e) => updateOption(i, { points: Number(e.target.value) })}
            className={`${inputClass} w-24`}
          />
          {options.length > 2 && (
            <button
              type="button"
              onClick={() => removeOption(i)}
              className="shrink-0 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...options, { label: "", points: 0 }])}
        className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
      >
        + Add Option
      </button>
    </div>
  );
}

function CreateQuestionForm({ dimension, onDone }: { dimension: 1 | 2; onDone: () => void }) {
  const createQuestion = useCreateRiskQuestion();
  const [text, setText] = useState("");
  const [helpText, setHelpText] = useState("");
  const [options, setOptions] = useState<QuestionOption[]>(emptyOptions(dimension));
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createQuestion.mutateAsync({ dimension, text, helpText, options });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this question.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
      <input required placeholder="Question text" value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
      <input
        placeholder="Help text (optional)"
        value={helpText}
        onChange={(e) => setHelpText(e.target.value)}
        className={inputClass}
      />
      <OptionsEditor options={options} onChange={setOptions} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={createQuestion.isPending}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {createQuestion.isPending ? "Adding..." : "Add Question"}
        </button>
        <button type="button" onClick={onDone} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">
          Cancel
        </button>
      </div>
    </form>
  );
}

function QuestionRow({ question }: { question: import("../../api/types").Question }) {
  const updateQuestion = useUpdateRiskQuestion();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);
  const [helpText, setHelpText] = useState(question.helpText);
  const [options, setOptions] = useState<QuestionOption[]>(question.options);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await updateQuestion.mutateAsync({ id: question.id, text, helpText, options });
      setEditing(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save.");
    }
  }

  const isActive = question.isActive;

  if (editing) {
    return (
      <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 p-4">
        <input value={text} onChange={(e) => setText(e.target.value)} className={inputClass} />
        <input value={helpText} onChange={(e) => setHelpText(e.target.value)} className={inputClass} placeholder="Help text" />
        <OptionsEditor options={options} onChange={setOptions} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={updateQuestion.isPending}
            className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {updateQuestion.isPending ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 p-4">
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}>
          {question.text}
        </p>
        {question.helpText && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{question.helpText}</p>}
        <ul className="mt-2 flex flex-wrap gap-2">
          {question.options.map((o) => (
            <li
              key={o.label}
              className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
            >
              {o.label} <span className="text-slate-400 dark:text-slate-500">({o.points} pts)</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isActive && (
          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            Inactive
          </span>
        )}
        <button onClick={() => setEditing(true)} className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline">
          Edit
        </button>
        <ToggleActiveButton questionId={question.id} isActive={isActive} />
      </div>
    </div>
  );
}

function ToggleActiveButton({ questionId, isActive }: { questionId: string; isActive: boolean }) {
  const updateQuestion = useUpdateRiskQuestion();
  return (
    <button
      onClick={() => updateQuestion.mutate({ id: questionId, isActive: !isActive })}
      disabled={updateQuestion.isPending}
      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}

function DimensionSection({
  dimension,
  title,
  description,
  questions,
}: {
  dimension: 1 | 2;
  title: string;
  description: string;
  questions: import("../../api/types").Question[];
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="shrink-0 rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {showCreate ? "Cancel" : "+ Add Question"}
        </button>
      </div>

      {showCreate && <CreateQuestionForm dimension={dimension} onDone={() => setShowCreate(false)} />}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {questions.length === 0 ? (
          <p className="p-4 text-sm text-slate-400 dark:text-slate-500">No questions yet.</p>
        ) : (
          questions.map((q) => <QuestionRow key={q.id} question={q} />)
        )}
      </div>
    </div>
  );
}

export function AdminRiskQuestionsPanel() {
  const { data: questions, isLoading } = useAdminRiskQuestions();

  if (isLoading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  const dimension1 = (questions ?? []).filter((q) => q.dimension === 1).sort((a, b) => a.order - b.order);
  const dimension2 = (questions ?? []).filter((q) => q.dimension === 2).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        These questions drive the risk assessment score and approval routing. Changes only apply to assessments
        started after the change — finalized assessments keep showing exactly what they were scored against.
        Deactivating a question hides it from new assessments without breaking history.
      </p>
      <DimensionSection
        dimension={1}
        title="Dimension 1 — Trigger Questions"
        description='Informational yes/no gates. Any answer worth more than 0 points flags the assessment for additional review.'
        questions={dimension1}
      />
      <DimensionSection
        dimension={2}
        title="Dimension 2 — Risk Scoring"
        description="Each question's chosen option contributes its points to the total score, which determines approval authority."
        questions={dimension2}
      />
    </div>
  );
}
